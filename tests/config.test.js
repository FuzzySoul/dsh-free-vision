import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const CONFIG_PATH = homedir() + '/.dsh/free-vision.json'

// Import the plugin module (fresh per test file run)
const mod = await import('../dsh/index.js')

function writeConfig(obj) {
  mkdirSync(homedir() + '/.dsh', { recursive: true })
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
