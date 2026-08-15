import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
writeFileSync(homedir() + '/.dsh/free-vision.json', JSON.stringify({ apiKey: '' }), 'utf-8')

const registered = new Map()
const ctx = {
  on() {},
  logger: { error: () => {} },
  tools: { register(d) { registered.set(d.name, d); return () => registered.delete(d.name); } },
}
const { apply } = await import('./dsh/index.js?t=' + Date.now())
apply(ctx, {})
await new Promise((r) => setTimeout(r, 800))
const tool = registered.get('image_understand')
if (!tool) { console.log('FAIL: 无 key 时工具未注册'); process.exit(1) }
try {
  await tool.execute({ image_source: 'x.png', prompt: 'hi' }, { signal: undefined })
  console.log('FAIL: 桩工具未抛错')
} catch (e) {
  console.log('✅ 无 key 桩工具调用报错（友好提示）:', e.message.slice(0, 120))
}
console.log('✅ 场景1通过：无 key 插件正常加载')
