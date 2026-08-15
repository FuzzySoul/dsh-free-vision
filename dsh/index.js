// DeepSeek Harness (dsh) plugin: FREE vision bridge for text-only models.
// 免费视觉理解插件：让纯文本模型获得看图能力。
//
// Spawns luma-mcp from this package's own dependency tree (no npx, no
// PATH lookup) and registers its image_understand tool on ctx.tools, so
// text-only dsh models can read screenshots, code errors, UI layouts,
// documents and photos — powered by free-tier vision models:
//
//   - qwen        (default) Qwen3-VL-Flash      阿里云百炼限免模型（50万 token 起）
//   - siliconflow           DeepSeek-OCR        硅基流动 OCR（免费）
//   - volcengine            Doubao 视觉模型      火山引擎豆包（20万~50万 token 免费）
//   - zhipu                 GLM-4.6V            智谱
//   - hunyuan               HY-Vision           腾讯混元
//   - custom                任意 OpenAI 兼容端点
//
// Loaded via the cordis.patch.yml row `dsh-free-vision` (see package.json
// `dsh.bundle` manifest). The API key comes from the plugin config
// (`apiKey`) or the provider's environment variable. All these endpoints
// are mainland-China services and must be reached directly — proxy
// environment variables are deliberately stripped from the child process,
// otherwise the API call fails (502 Bad Gateway).
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const LUMA_ENTRY = require.resolve('luma-mcp') // -> build/index.js

const PROXY_VARS = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy',
  'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy',
]

export const name = 'free-vision'
export const inject = ['tools']

/** Provider -> API key env variable. */
const PROVIDER_KEY_ENV = {
  zhipu: 'ZHIPU_API_KEY',
  siliconflow: 'SILICONFLOW_API_KEY',
  qwen: 'DASHSCOPE_API_KEY',
  volcengine: 'VOLCENGINE_API_KEY',
  hunyuan: 'HUNYUAN_API_KEY',
  custom: 'CUSTOM_API_KEY',
}

/** Build the child environment: host env minus proxy vars plus luma config. */
function buildChildEnv(lumaEnv) {
  const env = { ...process.env }
  for (const key of PROXY_VARS) delete env[key]
  Object.assign(env, lumaEnv)
  return env
}

/** Join MCP text blocks into a single string for the Native projection. */
function extractText(content) {
  return (content || [])
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

export function apply(ctx, config = {}) {
  const provider = config.modelProvider || 'qwen'
  const apiKey = config.apiKey || process.env[PROVIDER_KEY_ENV[provider] || 'DASHSCOPE_API_KEY'] || ''
  // Generic tool name by default; override with config.toolName if the host
  // already mounts an image_understand tool.
  const toolName = config.toolName || 'image_understand'
  const label = `free-vision(${provider})`

  const lumaEnv = {
    MODEL_PROVIDER: provider,
    ...(apiKey ? { [PROVIDER_KEY_ENV[provider] || 'DASHSCOPE_API_KEY']: apiKey } : {}),
    ...(config.modelName ? { MODEL_NAME: config.modelName } : {}),
    ...(config.maxTokens ? { MAX_TOKENS: String(config.maxTokens) } : {}),
    ...(config.temperature != null ? { TEMPERATURE: String(config.temperature) } : {}),
    ...(config.multiCrop === false ? { MULTI_CROP: 'false' } : {}),
    ...(config.lumaEnv || {}),
  }

  let client = null
  let transport = null
  let connecting = null
  let disposed = false
  const disposers = []

  function teardown() {
    disposed = true
    for (const dispose of disposers.splice(0)) {
      try { dispose() } catch { /* ignore */ }
    }
    if (client) {
      try { client.close().catch(() => {}) } catch { /* ignore */ }
      client = null
    }
    if (transport) {
      try { transport.close() } catch { /* ignore */ }
      transport = null
    }
  }
  ctx.on('dispose', teardown)

  async function ensureConnected() {
    if (disposed) throw new Error(`${label}: plugin has been disposed`)
    if (client) return client
    if (connecting) return connecting
    connecting = (async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
      const env = buildChildEnv(lumaEnv)
      transport = new StdioClientTransport({
        command: process.execPath,
        args: [LUMA_ENTRY],
        env,
        stderr: 'pipe',
      })
      // Forward luma-mcp's own logs (INFO/WARN/ERROR) to the harness console.
      if (transport.stderr) {
        transport.stderr.on('data', (chunk) => {
          const line = String(chunk).trim()
          if (line) console.error(`[${label}] ${line}`)
        })
      }
      const newClient = new Client({ name: 'dsh-free-vision', version: '0.1.0' })
      await newClient.connect(transport)
      client = newClient
      return client
    })()
    try {
      return await connecting
    } catch (error) {
      connecting = null
      teardown()
      throw error
    }
  }

  // Discover tools and register the generic image_understand tool.
  async function syncTools() {
    const live = await ensureConnected()
    const { tools } = await live.listTools()
    for (const tool of tools) {
      const definition = {
        name: toolName,
        description:
          'Analyze an image with a free-tier vision model (image understanding / OCR / UI / debug). ' +
          'Use whenever the model cannot see an image the user references: local file path, http(s) URL, ' +
          'or data URI of a screenshot, code error, UI layout, document or photo. ' +
          '看图片/截图/报错/OCR/界面分析：传入图片路径、URL 或 base64（PNG/JPG/WebP/GIF，最大约10MB），' +
          '配合 prompt 提问与 task_type 任务类型。',
        parameters: tool.inputSchema || { type: 'object', properties: {} },
        output: {
          schema: {
            type: 'object',
            properties: {
              content: { type: 'array', items: {} },
              structuredContent: {},
            },
            required: ['content'],
            additionalProperties: false,
          },
          render(_args, value) {
            return [{ type: 'text', text: extractText(value?.content) }]
          },
        },
        timeoutMs: config.toolCallTimeoutMs ?? 200_000,
        isConcurrencySafe: () => true,
        presentCall: (args) => ({
          card: 'generic',
          title: toolName,
          kind: 'call',
          rawInput: args,
          ...(typeof args?.image_source === 'string' && !/^https?:\/\//i.test(args.image_source)
            ? { locations: [{ path: args.image_source }] }
            : {}),
        }),
        async execute(args, exec) {
          const live = await ensureConnected()
          // SDK 1.25+ signature: callTool(params, resultSchema?, options?)
          const result = await live.callTool(
            { name: tool.name, arguments: args },
            undefined,
            { signal: exec.signal },
          )
          if (result.isError) {
            throw new Error(extractText(result.content) || `${label}: ${tool.name} failed`)
          }
          return result.structuredContent ?? { content: result.content ?? [] }
        },
      }
      try {
        disposers.push(ctx.tools.register(definition))
      } catch (error) {
        console.error(`[${label}] ${toolName} registration skipped: ${error}`)
      }
    }
  }

  if (!apiKey) {
    console.warn(
      `[${label}] no API key: set config.apiKey or the ${PROVIDER_KEY_ENV[provider] || 'DASHSCOPE_API_KEY'} environment variable; ${toolName} will fail until a key is provided.`,
    )
  }
  // Fire-and-forget: tools appear once the vision engine is connected (a few seconds).
  syncTools().catch((error) => {
    console.error(`[${label}] connection failed, tools not registered: ${error?.message || error}`)
  })
}
