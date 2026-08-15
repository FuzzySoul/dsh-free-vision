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
const r = await client.callTool({ name: 'image_understand', arguments: {
  image_source: 'C:/Users/62003/shot-ui.png',
  prompt: '这是软件设置界面截图。请从 UI/UX 角度详细分析：1.整体布局结构 2.各元素的视觉问题（对齐、间距、对比度、层级）3.功能/交互问题 4.体验不好的地方及原因 5.具体改进建议。请详细。',
  task_type: 'ui'
} })
console.log(JSON.stringify(r.content).slice(0, 6000))
await client.close()
process.exit(0)
