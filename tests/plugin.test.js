import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'

const CONFIG_PATH = process.env.DSH_FREE_VISION_CONFIG_PATH || homedir() + '/.dsh/free-vision.json'

async function loadPlugin() {
  // fresh module each time (config read is at apply time)
  return await import('../dsh/index.js?t=' + Date.now())
}

function mockCtx() {
  const registered = new Map()
  const webRoutes = []
  return {
    registered,
    webRoutes,
    on() {},
    logger: { error: () => {}, warn: () => {}, info: () => {} },
    tools: {
      register(def) {
        registered.set(def.name, def)
        return () => registered.delete(def.name)
      },
    },
    inject(deps, cb) {
      // Only the webServer dependency is mounted in tests; capture the route.
      const scope = {
        webServer: {
          register(route) {
            webRoutes.push(route)
          },
        },
      }
      cb(scope)
    },
  }
}

/** Drive a captured webServer GET route and return the parsed JSON. */
async function getRoute(route, cfgPath, setup = {}) {
  const req = {
    method: 'GET',
    url: route.path,
    ...setup.req,
  }
  let status = 0
  let body = ''
  const res = {
    writeHead(s, h) { status = s },
    end(s) { body = s },
  }
  await route.handler(req, res)
  return { status, body: JSON.parse(body) }
}

describe('plugin surface', () => {
  it('exports name, inject, apply and Config', async () => {
    const mod = await loadPlugin()
    expect(mod.name).toBe('free-vision')
    expect(mod.inject).toContain('tools')
    expect(typeof mod.apply).toBe('function')
    expect(typeof mod.Config?.toJSON).toBe('function')
    expect(JSON.stringify(mod.Config.toJSON())).toContain('baseURLs')
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

describe('config webServer route', () => {
  it('mounts GET /dsh-free-vision/config and returns the resolved allowedDirs', async () => {
    writeFileSync(CONFIG_PATH, JSON.stringify({ allowedDirs: '/a;/b' }), 'utf-8')
    const mod = await loadPlugin()
    const ctx = mockCtx()
    mod.apply(ctx, {})
    await new Promise((r) => setTimeout(r, 50))
    const route = ctx.webRoutes.find((r) => r.path === '/dsh-free-vision/config' && r.kind === 'exact')
    expect(route).toBeTruthy()

    const { status, body } = await getRoute(route, CONFIG_PATH)
    expect(status).toBe(200)
    expect(body).toHaveProperty('allowedDirs')
    // defaults = cwd + homedir
    expect(body.allowedDirs.defaults).toContain(process.cwd())
    expect(body.allowedDirs.defaults).toContain(homedir())
    // extra = user-specified roots
    expect(body.allowedDirs.extra).toEqual(['/a', '/b'])
    // all = defaults + extra, deduped
    expect(body.allowedDirs.all).toEqual([...body.allowedDirs.defaults, '/a', '/b'])
    try { unlinkSync(CONFIG_PATH) } catch {}
  })
})

