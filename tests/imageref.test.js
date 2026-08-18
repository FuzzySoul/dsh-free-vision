import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

// 1x1 transparent PNG (68 bytes after decode) — valid bytes for sniffImageType.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PNG_BUF = Buffer.from(PNG_B64, 'base64')

// NOTE: never use a real attachment's sha here — tests must not write/delete
// anything under ~/.dsh/attachments. A random hex keeps tests hermetic.
const SHA256_HEX = 'aabb'.padEnd(64, '1')
const ID = `sha256:${SHA256_HEX}`

// Isolated temp store root shared by the object-file-fallback tests.
const TMP_ROOT = mkdtempSync(join(tmpdir(), 'dsh-fv-test-att-'))
afterEach(() => {
  try {
    rmSync(TMP_ROOT, { recursive: true, force: true })
  } catch { /* ignore */ }
})

/** Fresh module so module-level state (ATTACHMENT_REF_REGISTRY) resets. */
async function loadPlugin() {
  return await import('../dsh/index.js?t=' + Date.now())
}

function mockAttachments(overrides = {}) {
  return {
    readImage: overrides.readImage || (async () => ({ data: PNG_BUF, ref: { mediaType: 'image/png' } })),
  }
}

function refFor() {
  return {
    attachmentId: ID,
    mediaType: 'image/png',
    bytes: PNG_BUF.byteLength,
    width: 1,
    height: 1,
  }
}

function durableMarkdown() {
  const id = encodeURIComponent(ID) // sha256%3A...
  const ref = encodeURIComponent(JSON.stringify(refFor()))
  return `![图片](/dsh-free-vision/raw/${id}?ref=${ref})`
}

/** Write a content-addressed object under the temp store root. */
async function writeObject(sha = SHA256_HEX) {
  const dir = join(TMP_ROOT, 'objects', sha.slice(0, 2))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, sha), PNG_BUF)
}

describe('parseImageReference', () => {
  it('parses the durable markdown form (with ?ref=)', async () => {
    const mod = await loadPlugin()
    const parsed = mod.parseImageReference(durableMarkdown())
    expect(parsed).not.toBeNull()
    expect(parsed.id).toBe(ID)
    expect(parsed.ref.attachmentId).toBe(ID)
    expect(parsed.ref.bytes).toBe(PNG_BUF.byteLength)
  })

  it('parses a bare route path (no ref query)', async () => {
    const mod = await loadPlugin()
    const parsed = mod.parseImageReference(`/dsh-free-vision/raw/${ID}`)
    expect(parsed).not.toBeNull()
    expect(parsed.id).toBe(ID)
    expect(parsed.ref).toBeNull()
  })

  it('parses the absolute loopback URL form', async () => {
    const mod = await loadPlugin()
    const parsed = mod.parseImageReference(
      `http://127.0.0.1:3082/dsh-free-vision/raw/${encodeURIComponent(ID)}`,
    )
    expect(parsed).not.toBeNull()
    expect(parsed.id).toBe(ID)
  })

  it('parses the [image attachment ...] note form', async () => {
    const mod = await loadPlugin()
    expect(mod.parseImageReference(`[image attachment ${ID}]`).id).toBe(ID)
    expect(mod.parseImageReference(`look at [image attachment ${durableMarkdown()}]`).id).toBe(ID)
  })

  it('parses a bare content id and an attachment object path (absolute or mangled)', async () => {
    const mod = await loadPlugin()
    expect(mod.parseImageReference(ID).id).toBe(ID)
    const absolute = `/home/some/.dsh/attachments/v1/objects/${SHA256_HEX.slice(0, 2)}/${SHA256_HEX}`
    expect(mod.parseImageReference(absolute).id).toBe(ID)
    // host bridge may strip the /home/<user>/. prefix; still resolvable
    const mangled = `dsh/attachments/v1/objects/${SHA256_HEX.slice(0, 2)}/${SHA256_HEX}`
    expect(mod.parseImageReference(mangled).id).toBe(ID)
  })

  it('flags malformed raw-route references instead of returning null', async () => {
    const mod = await loadPlugin()
    const parsed = mod.parseImageReference('/dsh-free-vision/raw/sha256:deadbeef')
    expect(parsed).not.toBeNull()
    expect(parsed.id).toBeNull()
    expect(parsed.malformed).toBe(true)
  })

  it('returns null for non-reference inputs', async () => {
    const mod = await loadPlugin()
    expect(mod.parseImageReference('/home/someone/screenshot.png')).toBeNull()
    expect(mod.parseImageReference('https://example.com/x.png')).toBeNull()
    expect(mod.parseImageReference('not-an-image')).toBeNull()
  })
})

describe('resolveImageSource', () => {
  it('passes through data URIs and external URLs untouched', async () => {
    const mod = await loadPlugin()
    const caseDataUri = 'data:image/png;base64,AAAA'
    const caseExternal = 'https://example.com/x.png'
    expect((await mod.resolveImageSource({ image_source: caseDataUri }, {})).image_source).toBe(caseDataUri)
    expect((await mod.resolveImageSource({ image_source: caseExternal }, {})).image_source).toBe(caseExternal)
  })

  it('resolves a durable markdown reference via ctx.attachments.readImage', async () => {
    const mod = await loadPlugin()
    const ctx = { get: () => mockAttachments() }
    const out = await mod.resolveImageSource({ image_source: durableMarkdown() }, { ctx, allowedDirs: [] })
    expect(out.image_source).toBe(`data:image/png;base64,${PNG_B64}`)
  })

  it('resolves a bare loopback URL via the (temp-root) object-file fallback', async () => {
    await writeObject()
    const mod = await loadPlugin()
    const out = await mod.resolveImageSource(
      { image_source: `http://127.0.0.1:3082/dsh-free-vision/raw/${encodeURIComponent(ID)}` },
      {
        ctx: { get: () => ({ readImage: async () => { throw new Error('not expected') } }) },
        allowedDirs: [],
        attachmentRoot: TMP_ROOT,
      },
    )
    expect(out.image_source).toBe(`data:image/png;base64,${PNG_B64}`)
  })

  it('throws a friendly error for an unresolvable in-store reference', async () => {
    const mod = await loadPlugin()
    await expect(
      mod.resolveImageSource({ image_source: `/dsh-free-vision/raw/sha256:deadbeef` }, { ctx: {}, allowedDirs: [] }),
    ).rejects.toThrow(/无法解析/)
  })

  it('resolves an allowed local path (inside home) to a data URI', async () => {
    const mod = await loadPlugin()
    const p = join(homedir(), `.dsh-free-vision-test-${Date.now()}.png`)
    writeFileSync(p, PNG_BUF)
    try {
      const allowedDirs = [homedir()]
      const out = await mod.resolveImageSource({ image_source: p }, { ctx: {}, allowedDirs })
      expect(out.image_source).toBe(`data:image/png;base64,${PNG_B64}`)
    } finally {
      rmSync(p, { force: true })
    }
  })

  it('denies a local path outside the allowed roots with an actionable message', async () => {
    const mod = await loadPlugin()
    await expect(
      mod.resolveImageSource({ image_source: '/etc/hosts' }, { ctx: {}, allowedDirs: [homedir()] }),
    ).rejects.toThrow(/Access denied/)
  })

  it('reports a useful error for a missing local file', async () => {
    const mod = await loadPlugin()
    await expect(
      mod.resolveImageSource({ image_source: '/no/such/image.png' }, { ctx: {}, allowedDirs: [homedir()] }),
    ).rejects.toThrow(/不存在或不可读/)
  })
})
