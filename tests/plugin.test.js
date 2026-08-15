import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const CONFIG_PATH = homedir() + '/.dsh/free-vision.json'

async function loadPlugin() {
  // fresh module each time (config read is at apply time)
  return await import('../dsh/index.js?t=' + Date.now())
}

function mockCtx() {
  const registered = new Map()
  return {
    registered,
    on() {},
    logger: { error: () => {}, warn: () => {}, info: () => {} },
    tools: {
      register(def) {
        registered.set(def.name, def)
        return () => registered.delete(def.name)
      },
    },
  }
}

describe('plugin surface', () => {
  it('exports name, inject, apply and Config', async () => {
    const mod = await loadPlugin()
    expect(mod.name).toBe('free-vision')
    expect(mod.inject).toContain('tools')
    expect(typeof mod.apply).toBe('function')
    expect(typeof mod.Config?.toJSON).toBe('function')
  })

  it('registers the image_understand tool', async () => {
    writeFileSync(CONFIG_PATH, JSON.stringify({ keys: { qwen: 'sk-x' }, modelProvider: 'qwen' }), 'utf-8')
    const mod = await loadPlugin()
    const ctx = mockCtx()
    mod.apply(ctx, {})
    await new Promise((r) => setTimeout(r, 1500)) // let syncTools run
    expect(ctx.registered.has('image_understand')).toBe(true)
    try { unlinkSync(CONFIG_PATH) } catch {}
  })

  it('registers a stub tool and gives a friendly error without a key', async () => {
    writeFileSync(CONFIG_PATH, JSON.stringify({ modelProvider: 'qwen' }), 'utf-8')
    const mod = await loadPlugin()
    const ctx = mockCtx()
    mod.apply(ctx, {})
    await new Promise((r) => setTimeout(r, 300))
    const tool = ctx.registered.get('image_understand')
    expect(tool).toBeTruthy()
    await expect(tool.execute({ image_source: 'x.png', prompt: 'hi' }, { signal: undefined }))
      .rejects.toThrow(/API Key/)
    try { unlinkSync(CONFIG_PATH) } catch {}
  })
})
