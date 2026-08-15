// Plugin smoke test: mock a cordis ctx and drive dsh/index.js end to end.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const registered = new Map()
const ctx = {
  on() {},
  logger: { error: (...a) => console.error('[ctx.logger]', ...a) },
  tools: {
    register(def) {
      registered.set(def.name, def)
      console.log('[register]', def.name)
      return () => registered.delete(def.name)
    },
  },
}

const { apply } = await import('./dsh/index.js')
const config = {
  apiKey: process.env.DASHSCOPE_API_KEY,
  toolCallTimeoutMs: 190_000,
}
apply(ctx, config)

// wait for connection + tool sync (luma spawns in ~1-3s)
for (let i = 0; i < 40; i++) {
  if (registered.has('image_understand')) break
  await new Promise((r) => setTimeout(r, 500))
}

const tool = registered.get('image_understand')
if (!tool) {
  console.error('FAIL: image_understand not registered')
  process.exit(1)
}
console.log('registered tool:', tool.name)

const exec = { signal: undefined }
const result = await tool.execute(
  { image_source: 'test-img.jpg', prompt: '描述这张图片', task_type: 'describe' },
  exec,
)
console.log('RESULT:', JSON.stringify(result).slice(0, 800))
process.exit(0)
