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
  image_source: 'C:/Users/62003/shot-issue.png',
  prompt: '这是设置界面截图。请描述：1.背景和整体是深色还是浅色主题 2.文字颜色与背景的对比度情况 3.哪些地方看不清/不可读 4.界面布局和内容（尽量转录文字）',
  task_type: 'ui'
} })
console.log(JSON.stringify(r.content).slice(0, 4000))
await client.close()
process.exit(0)
