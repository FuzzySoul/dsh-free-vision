// Integration test: prove the patched luma-mcp engine really sends API
// requests to a custom Base URL (not just saved config). A local mock HTTP
// server records the incoming path; every built-in provider client must hit
// the custom base plus /chat/completions exactly once, without /v1/v1 or
// double /chat/completions.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { loadConfig } from 'luma-mcp/build/config.js'
import { QwenClient } from 'luma-mcp/build/qwen-client.js'
import { HunyuanClient } from 'luma-mcp/build/hunyuan-client.js'
import { SiliconFlowClient } from 'luma-mcp/build/siliconflow-client.js'
import { VolcengineClient } from 'luma-mcp/build/volcengine-client.js'
import { ZhipuClient } from 'luma-mcp/build/zhipu-client.js'

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0XwAAAAASUVORK5CYII='

let server
let port
const requests = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      requests.push({
        url: req.url,
        auth: req.headers.authorization,
        body: body ? JSON.parse(body) : null,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 1 },
      }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  for (const name of ['MODEL_PROVIDER', 'QWEN_BASE_URL', 'DASHSCOPE_API_KEY']) {
    delete process.env[name]
  }
})

const baseConfig = {
  model: 'test-model',
  maxTokens: 10,
  temperature: 0.7,
  topP: 0.9,
  enableThinking: true,
  apiKey: 'test-key',
}

describe('patched luma-mcp base URL override', () => {
  it('loadConfig reads QWEN_BASE_URL from the environment', () => {
    process.env.MODEL_PROVIDER = 'qwen'
    process.env.QWEN_BASE_URL = `http://127.0.0.1:${port}/v1`
    process.env.DASHSCOPE_API_KEY = 'test-key'
    const config = loadConfig()
    expect(config.provider).toBe('qwen')
    expect(config.baseUrl).toBe(`http://127.0.0.1:${port}/v1`)
  })

  it('every provider client sends requests to the custom base URL', async () => {
    const clients = [
      ['qwen', QwenClient],
      ['hunyuan', HunyuanClient],
      ['siliconflow', SiliconFlowClient],
      ['volcengine', VolcengineClient],
      ['zhipu', ZhipuClient],
    ]
    for (const [name, Client] of clients) {
      const client = new Client({ ...baseConfig, model: `${name}-model`, baseUrl: `http://127.0.0.1:${port}/v1` })
      const result = await client.analyzeImage(DATA_URI, 'describe', true)
      expect(result).toBe('ok')
    }

    expect(requests).toHaveLength(clients.length)
    for (const request of requests) {
      expect(request.url).toBe('/v1/chat/completions')
      expect(request.auth).toBe('Bearer test-key')
    }
  })

  it('does not duplicate /chat/completions when the full URL is provided', async () => {
    const before = requests.length
    const client = new QwenClient({ ...baseConfig, model: 'qwen-model', baseUrl: `http://127.0.0.1:${port}/v1/chat/completions` })
    await client.analyzeImage(DATA_URI, 'describe', true)
    expect(requests).toHaveLength(before + 1)
    expect(requests[requests.length - 1].url).toBe('/v1/chat/completions')
  })

  it('keeps the official default base URL when no override is configured', () => {
    const client = new QwenClient({ ...baseConfig, baseUrl: undefined })
    expect(client.client.defaults.baseURL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(client.options.path).toBe('/chat/completions')
  })
})