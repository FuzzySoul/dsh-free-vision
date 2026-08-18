import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'

const CONFIG_PATH = process.env.DSH_FREE_VISION_CONFIG_PATH || homedir() + '/.dsh/free-vision.json'

// Import the plugin module (fresh per test file run)
const mod = await import('../dsh/index.js')

function writeConfig(obj) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(obj), 'utf-8')
}

describe('effectiveConfig', () => {
  it('merges cordis config with the settings file (file wins)', () => {
    writeConfig({ modelProvider: 'volcengine' })
    const merged = mod.effectiveConfig({ modelProvider: 'qwen', toolName: 'image_understand' })
    expect(merged.modelProvider).toBe('volcengine')
    expect(merged.toolName).toBe('image_understand')
  })

  it('returns cordis config when no file exists', () => {
    try { unlinkSync(CONFIG_PATH) } catch {}
    const merged = mod.effectiveConfig({ toolName: 'see' })
    expect(merged.toolName).toBe('see')
  })
})

describe('migrateKeys', () => {
  it('migrates legacy flat apiKey into keys[provider]', () => {
    const out = mod.migrateKeys({ apiKey: 'sk-abc', modelProvider: 'qwen' })
    expect(out.keys).toEqual({ qwen: 'sk-abc' })
    expect(out.apiKey).toBe('sk-abc') // legacy kept for backward compat
  })

  it('keeps an existing keys map untouched', () => {
    const cfg = { keys: { qwen: 'sk-1', volcengine: 'sk-2' }, modelProvider: 'volcengine' }
    expect(mod.migrateKeys(cfg)).toBe(cfg)
  })
})

describe('keyFor', () => {
  beforeEach(() => writeConfig({}))
  afterEach(() => { try { unlinkSync(CONFIG_PATH) } catch {} })

  it('prefers keys[provider] over legacy apiKey', () => {
    writeConfig({ keys: { qwen: 'sk-new' }, apiKey: 'sk-legacy', modelProvider: 'qwen' })
    expect(mod.keyFor(mod.effectiveConfig({}))).toBe('sk-new')
  })

  it('falls back to legacy apiKey', () => {
    writeConfig({ apiKey: 'sk-legacy', modelProvider: 'qwen' })
    expect(mod.keyFor(mod.effectiveConfig({}))).toBe('sk-legacy')
  })

  it('falls back to the provider env var', () => {
    writeConfig({ modelProvider: 'qwen' })
    const prev = process.env.DASHSCOPE_API_KEY
    process.env.DASHSCOPE_API_KEY = 'sk-env'
    try {
      expect(mod.keyFor(mod.effectiveConfig({}))).toBe('sk-env')
    } finally {
      if (prev === undefined) delete process.env.DASHSCOPE_API_KEY
      else process.env.DASHSCOPE_API_KEY = prev
    }
  })

  it('returns empty string when nothing is configured', () => {
    writeConfig({ modelProvider: 'qwen' })
    expect(mod.keyFor(mod.effectiveConfig({}))).toBe('')
  })
})

describe('keySourceOf', () => {
  beforeEach(() => writeConfig({}))
  afterEach(() => { try { unlinkSync(CONFIG_PATH) } catch {} })

  it('reports file when keys[provider] exists', () => {
    writeConfig({ keys: { qwen: 'sk-x' }, modelProvider: 'qwen' })
    expect(mod.keySourceOf({})).toBe('file')
  })

  it('reports none when nothing is configured', () => {
    writeConfig({ modelProvider: 'qwen' })
    expect(mod.keySourceOf({})).toBe('none')
  })
})

describe('baseURLFor', () => {
  afterEach(() => {
    for (const name of Object.values(mod.PROVIDER_BASE_URL_ENV || {})) {
      delete process.env[name]
    }
  })

  it('returns the official default when no override is set', () => {
    expect(mod.baseURLFor({ modelProvider: 'qwen' }, 'qwen')).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(mod.baseURLFor({}, 'siliconflow')).toBe('https://api.siliconflow.cn/v1')
  })

  it('prefers baseURLs[provider] over the official default', () => {
    const cfg = { baseURLs: { qwen: 'https://proxy.example.com/v1/' } }
    expect(mod.baseURLFor(cfg, 'qwen')).toBe('https://proxy.example.com/v1')
  })

  it('falls back to the provider base URL env var', () => {
    process.env.QWEN_BASE_URL = 'https://env-proxy.example.com/v1'
    expect(mod.baseURLFor({}, 'qwen')).toBe('https://env-proxy.example.com/v1')
  })

  it('keeps legacy configs working when baseURLs is missing', () => {
    expect(mod.baseURLFor({ modelProvider: 'qwen' }, 'qwen')).toBe(mod.PROVIDER_BASE_URLS.qwen)
  })

  it('falls back to the default when a saved base URL is invalid', () => {
    expect(mod.baseURLFor({ baseURLs: { qwen: 'not a url' } }, 'qwen')).toBe(mod.PROVIDER_BASE_URLS.qwen)
  })
})

describe('normalizeSettings', () => {
  it('strips trailing slashes from baseURLs', () => {
    const out = mod.normalizeSettings({ baseURLs: { qwen: 'https://proxy.example.com/v1////' } })
    expect(out.baseURLs.qwen).toBe('https://proxy.example.com/v1')
  })

  it('drops empty baseURL values (use default)', () => {
    const out = mod.normalizeSettings({ baseURLs: { qwen: '', volcengine: '   ' } })
    expect(out.baseURLs).toEqual({})
  })

  it('rejects non-http(s) base URLs', () => {
    expect(() => mod.normalizeSettings({ baseURLs: { qwen: 'ftp://example.com/v1' } }))
      .toThrow(/http/)
  })

  it('rejects malformed URLs', () => {
    expect(() => mod.normalizeSettings({ baseURLs: { qwen: 'not a url' } }))
      .toThrow(/Invalid Base URL/)
  })
})

describe('resolveAllowedDirs', () => {
  it('always includes cwd and homedir as defaults', () => {
    const r = mod.resolveAllowedDirs({})
    expect(r.defaults).toContain(process.cwd())
    expect(r.defaults).toContain(homedir())
    expect(r.extra).toEqual([])
    expect(r.all).toEqual(r.defaults)
  })

  it('splits allowedDirs on ; and , and strips empties', () => {
    const r = mod.resolveAllowedDirs({ allowedDirs: ' /a ; /b ,  ' })
    expect(r.extra).toEqual(['/a', '/b'])
    expect(r.all).toEqual([...r.defaults, '/a', '/b'])
  })

  it('dedupes repeated dirs and allows the empty string', () => {
    const r = mod.resolveAllowedDirs({ allowedDirs: '/a, /a;' })
    expect(r.extra).toEqual(['/a'])
    expect(mod.resolveAllowedDirs({ allowedDirs: '' }).extra).toEqual([])
  })
})
