import { describe, it, expect } from 'vitest'
import { buildShowImageTool, dataUriToBytes, formatShowImageResult } from '../dsh/index.js?test=showimage'

// 1x1 transparent PNG (same fixture as imageref tests).
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PNG_DATA_URI = `data:image/png;base64,${PNG_B64}`

function mockAttachments(overrides = {}) {
  return {
    imageLimits: { maxImageBytes: 10 * 1024 * 1024 },
    readImage: async () => ({ data: Buffer.from('x') }),
    saveImage: overrides.saveImage || (async ({ data, mediaType }) => ({
      attachmentId: 'sha256:' + 'aa'.repeat(32),
      mediaType,
      bytes: data.length,
      width: 1,
      height: 1,
    })),
  }
}

function mockCtx(attachments) {
  return { get: (name) => (name === 'attachments' ? attachments : undefined) }
}

const helpers = (overrides) => ({ getEffective: () => ({ ...overrides }) })

describe('dataUriToBytes', () => {
  it('decodes a data:image uri into buffer + mime', () => {
    const decoded = dataUriToBytes(PNG_DATA_URI)
    expect(decoded).not.toBeNull()
    expect(decoded.mimeType).toBe('image/png')
    expect(decoded.buffer.length).toBeGreaterThan(10)
  })
  it('returns null for non-data input', () => {
    expect(dataUriToBytes(null)).toBeNull()
    expect(dataUriToBytes('http://x/y.png')).toBeNull()
  })
})

describe('formatShowImageResult', () => {
  it('summarizes path/caption/metadata as text only', () => {
    const text = formatShowImageResult({ path: '/a/b.png', caption: '测试截图', mediaType: 'image/png', width: 10, height: 5, bytes: 100 })
    expect(text).toContain('/a/b.png')
    expect(text).toContain('测试截图')
    expect(text).toContain('10x5px')
  })
})

describe('buildShowImageTool', () => {
  it('defaults to the show_image wire name', () => {
    const tool = buildShowImageTool(mockCtx(), helpers())
    expect(tool.name).toBe('show_image')
  })

  it('renames the wire name from config to dodge collisions', () => {
    const tool = buildShowImageTool(mockCtx(), helpers({ showImageToolName: 'show_pic' }))
    expect(tool.name).toBe('show_pic')
  })

  it('rejects an empty image_source', async () => {
    const tool = buildShowImageTool(mockCtx(), helpers())
    await expect(tool.execute({ image_source: '' }, {})).rejects.toThrow()
  })

  it('rejects a remote http(s) URL', async () => {
    const tool = buildShowImageTool(mockCtx(), helpers())
    await expect(tool.execute({ image_source: 'https://example.com/a.png' }, {})).rejects.toThrow(/http\(s\)/)
  })

  it('saves a data-uri image through the attachment store and returns meta', async () => {
    let saved
    const attachments = mockAttachments({
      saveImage: async ({ data, mediaType }) => {
        saved = { data, mediaType }
        return { attachmentId: 'sha256:' + 'ab'.repeat(32), mediaType, bytes: data.length, width: 2, height: 3 }
      },
    })
    const tool = buildShowImageTool(mockCtx(attachments), helpers())
    const value = await tool.execute({ image_source: PNG_DATA_URI, caption: '这是测试图' }, {})
    expect(value.path).toBe(PNG_DATA_URI)
    expect(value.attachmentId).toBe('sha256:' + 'ab'.repeat(32))
    expect(value.mediaType).toBe('image/png')
    expect(value.bytes).toBeGreaterThan(10)
    expect(value.width).toBe(2)
    expect(value.height).toBe(3)
    // saveImage received decoded bytes + declared mediaType
    expect(saved.mediaType).toBe('image/png')
    expect(saved.data.length).toBeGreaterThan(10)

    // presentationMeta is threaded with the display payload (never model-visible text)
    const meta = tool.output.presentationMeta(null, value)
    expect(meta.attachmentId).toBe(value.attachmentId)
    expect(meta.caption).toBe('这是测试图')
    // model-visible render is text-only, no image block
    const rendered = tool.output.render(null, value)
    expect(rendered.every((b) => b.type === 'text')).toBe(true)
  })

  it('rejects when the per-image byte cap is exceeded', async () => {
    const tool = buildShowImageTool(
      mockCtx(mockAttachments()),
      helpers({ showImageMaxBytes: 4 }),
    )
    await expect(tool.execute({ image_source: PNG_DATA_URI }, {})).rejects.toThrow(/超过上限/)
  })

  it('rejects when the pixel cap is exceeded', async () => {
    const attachments = mockAttachments({
      saveImage: async ({ data, mediaType }) => ({
        attachmentId: 'sha256:' + 'ac'.repeat(32),
        mediaType,
        bytes: data.length,
        width: 4000,
        height: 3000,
      }),
    })
    const tool = buildShowImageTool(mockCtx(attachments), helpers({ showImagePixels: 1_000_000 }))
    await expect(tool.execute({ image_source: PNG_DATA_URI }, {})).rejects.toThrow(/像素上限/)
  })

  it('fails cleanly when the attachment store is not mounted', async () => {
    const tool = buildShowImageTool(mockCtx(null), helpers())
    await expect(tool.execute({ image_source: PNG_DATA_URI }, {})).rejects.toThrow(/附件服务未挂载/)
  })
})
