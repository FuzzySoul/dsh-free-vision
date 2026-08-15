import { createRequire } from 'node:module'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
const require = createRequire(import.meta.url)
const LUMA = require.resolve('luma-mcp')
const env = { ...process.env, MODEL_PROVIDER: 'qwen', DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY }
for (const k of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy']) delete env[k]
const transport = new StdioClientTransport({ command: process.execPath, args: [LUMA], env, stderr: 'pipe' })
const client = new Client({ name: 'dbg', version: '0.0.1' })
await client.connect(transport)
for (const [path, label] of [['C:/Users/62003/shot1.png', '截图1'], ['C:/Users/62003/shot2.png', '截图2']]) {
  const r = await client.callTool({ name: 'image_understand', arguments: { image_source: path, prompt: '这是 DeepSeek Harness 设置界面的截图，请详细描述：1.界面布局（左侧导航有哪些项）2.主要区域内容（表单字段、报错信息）3.所有可见文字尽量完整转录', task_type: 'ui' } })
  console.log('=== ' + label + ' ===')
  console.log(JSON.stringify(r.content).slice(0, 3000))
}
await client.close()
process.exit(0)
