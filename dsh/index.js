// DeepSeek Harness (dsh) plugin: vision bridge for text-only models.
// Spawns luma-mcp from this package's own dependency tree (no npx, no
// PATH lookup — the plugin and its engine version-lock together) and
// registers its image_understand tool on ctx.tools as
// `luma__image_understand`, so text-only dsh models can read screenshots,
// code errors, UI layouts, documents and photos.
//
// Loaded via the cordis.patch.yml row `dsh-luma-vision` (see package.json
// `dsh.bundle` manifest). The API key comes from the plugin config
// (`apiKey`) or the DASHSCOPE_API_KEY environment variable. The default
// provider is Qwen (qwen3-vl-flash, free tier); dashscope.aliyuncs.com is a
// mainland-China endpoint and must be reached directly — proxy environment
// variables are deliberately stripped from the child process, otherwise
// luma-mcp fails with 502 (Bad Gateway).
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const LUMA_ENTRY = require.resolve('luma-mcp') // -> build/index.js

const PROXY_VARS = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy',
  'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy',
]

export const name = 'luma-vision'
export const inject = ['tools']

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
  const apiKey = config.apiKey || process.env.DASHSCOPE_API_KEY || ''
  const provider = config.modelProvider || 'qwen'
  const prefix = config.toolPrefix || 'luma'
  const label = `luma-vision(${provider})`

  const lumaEnv = {
    MODEL_PROVIDER: provider,
    ...(apiKey ? { DASHSCOPE_API_KEY: apiKey } : {}),
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
      const newClient = new Client({ name: 'dsh-luma-vision', version: '0.1.0' })
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

  // Discover tools and register them under `<prefix>__<rawName>`.
  async function syncTools() {
    const live = await ensureConnected()
    const { tools } = await live.listTools()
    for (const tool of tools) {
      const publicName = `${prefix}__${tool.name}`
      const definition = {
        name: publicName,
        description: tool.description || `Analyze an image with the ${tool.name} vision tool.`,
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
          title: publicName,
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
        console.error(`[${label}] ${publicName} registration skipped: ${error}`)
      }
    }
  }

  if (!apiKey) {
    console.warn(`[${label}] no API key: set config.apiKey or the DASHSCOPE_API_KEY environment variable; image_understand will fail until a key is provided.`)
  }
  // Fire-and-forget: tools appear once luma-mcp is connected (a few seconds).
  syncTools().catch((error) => {
    console.error(`[${label}] connection failed, tools not registered: ${error?.message || error}`)
  })
}
