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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import z from '@deepseek-ai/schemastery'

const require = createRequire(import.meta.url)
const LUMA_ENTRY = require.resolve('luma-mcp') // -> build/index.js


/** Plugin config schema — rendered as a form in the dsh web settings UI.
 *  配置项会在 dsh web 设置界面中自动渲染为表单。 */
export const Config = z.object({
  apiKey: z
    .string()
    .description('API Key（缺省回退到对应提供商的环境变量，如 DASHSCOPE_API_KEY）/ API key; falls back to the provider env var')
    .default(''),
  baseURLs: z
    .dict(String)
    .description('每个 Provider 可选 API Base URL 覆盖，留空使用官方默认地址 / per-provider optional API base URL override (empty = official default)')
    .default({}),
  modelProvider: z
    .union([
      z.const('qwen'),
      z.const('volcengine'),
      z.const('siliconflow'),
      z.const('zhipu'),
      z.const('hunyuan'),
      z.const('custom'),
    ])
    .description('模型提供商 / provider (free tiers: qwen, volcengine, siliconflow)')
    .default('qwen'),
  modelName: z
    .string()
    .description('模型名覆盖，默认按提供商自动选择 / optional model override')
    .default(''),
  toolName: z
    .string()
    .description('工具公开名（与宿主冲突时改名）/ public tool name')
    .default('image_understand'),
  maxTokens: z
    .number()
    .description('最大生成 token 数 / max output tokens')
    .default(8192),
  temperature: z
    .number()
    .description('采样温度 / sampling temperature')
    .default(0.7),
  multiCrop: z
    .boolean()
    .description('大图自动多裁剪提升细节 / multi-crop large images')
    .default(true),
  toolCallTimeoutMs: z
    .number()
    .description('单次调用超时（毫秒）/ per-call timeout (ms)')
    .default(200000),
  lumaEnv: z
    .dict(String)
    .description('传递给视觉引擎的额外环境变量 / extra env vars for the engine')
    .default({}),
  allowedDirs: z
    .string()
    .description('允许读取图片的额外目录（;或,分隔，默认仅引擎工作目录与用户主目录）/ extra allowed image root dirs (semicolon/comma separated)')
    .default(''),
})

const PROXY_VARS = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy',
  'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy',
]

/** Persistent settings file (written by the web settings UI). */
const CONFIG_PATH = process.env.DSH_FREE_VISION_CONFIG_PATH || homedir() + '/.dsh/free-vision.json'

/** Read the persistent settings file; {} on any failure. */
function readSettingsFile() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Merge order: cordis patch config < persistent settings file. */
function effectiveConfig(baseConfig) {
  return { ...baseConfig, ...readSettingsFile() }
}

/** Migrate the old flat apiKey into the per-provider keys map. */
function migrateKeys(cfg) {
  if (cfg.apiKey && !cfg.keys) {
    const provider = cfg.modelProvider || 'qwen'
    return { ...cfg, keys: { [provider]: cfg.apiKey } }
  }
  return cfg
}

/** Live key for the active provider: keys[provider] > legacy apiKey > env. */
function keyFor(cfg) {
  const migrated = migrateKeys(cfg)
  const provider = migrated.modelProvider || 'qwen'
  const envName = PROVIDER_KEY_ENV[provider] || 'DASHSCOPE_API_KEY'
  return (
    (migrated.keys && migrated.keys[provider]) ||
    migrated.apiKey ||
    process.env[envName] ||
    ''
  )
}

/** Where the live API key comes from: settings file or environment. */
function keySourceOf(baseConfig) {
  const cfg = migrateKeys(effectiveConfig(baseConfig))
  const provider = cfg.modelProvider || 'qwen'
  if (cfg.keys && cfg.keys[provider]) return 'file'
  if (cfg.apiKey) return 'file'
  const envName = PROVIDER_KEY_ENV[provider] || 'DASHSCOPE_API_KEY'
  if (process.env[envName]) return 'env'
  return 'none'
}

/** Persist settings (server side, called from the web UI route). */
function writeSettingsFile(next) {
  mkdirSync(homedir() + '/.dsh', { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8')
}

/**
 * Split the user-configurable allowedDirs string into an array of paths.
 * Accepted separators: ';' or ','. Empty entries are dropped.
 */
function parseDirs(dirs) {
  if (!dirs || typeof dirs !== 'string') return []
  return dirs
    .split(/[;,]/)
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .filter((p, i, arr) => arr.indexOf(p) === i)
}

/**
 * The effective image read whitelist forwarded to the engine's
 * LUMA_ALLOWED_DIRS. The engine always allows process.cwd() and the user
 * home; extra roots come from the `allowedDirs` config. Returned as
 * `{ defaults: string[], extra: string[], all: string[] }` so the settings
 * UI can show exactly what is in force and what the user added.
 */
function resolveAllowedDirs(cfg) {
  const defaults = [process.cwd(), homedir()].filter(Boolean)
  const extra = parseDirs(cfg && cfg.allowedDirs)
  const all = defaults.concat(extra).filter((p, i, arr) => arr.indexOf(p) === i)
  return { defaults, extra, all }
}

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

/** Provider -> default API base URL (without /chat/completions). */
const PROVIDER_BASE_URLS = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  siliconflow: 'https://api.siliconflow.cn/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1',
  custom: '',
}

/** Provider -> base URL env var consumed by the patched luma-mcp engine. */
const PROVIDER_BASE_URL_ENV = {
  qwen: 'QWEN_BASE_URL',
  volcengine: 'VOLCENGINE_BASE_URL',
  siliconflow: 'SILICONFLOW_BASE_URL',
  zhipu: 'ZHIPU_BASE_URL',
  hunyuan: 'HUNYUAN_BASE_URL',
  custom: 'CUSTOM_BASE_URL',
}

function normalizeBaseUrl(raw) {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed
}

/**
 * Resolve the live API base URL for a provider:
 * saved baseURLs[provider] > provider base URL env var > official default.
 */
function baseURLFor(cfg, provider) {
  const prov = provider || cfg.modelProvider || 'qwen'
  const candidates = []
  const saved = cfg.baseURLs && cfg.baseURLs[prov]
  if (typeof saved === 'string' && saved.trim()) candidates.push(saved)
  const envName = PROVIDER_BASE_URL_ENV[prov]
  if (envName && process.env[envName] && process.env[envName].trim()) {
    candidates.push(process.env[envName])
  }
  for (const raw of candidates) {
    const value = normalizeBaseUrl(raw)
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString().replace(/\/+$/, '')
      }
    } catch { /* fall through to default */ }
  }
  return PROVIDER_BASE_URLS[prov] || ''
}

/**
 * Validate/normalize a settings object before persisting it. Base URL values
 * must be empty or an absolute http(s) URL; trailing slashes are stripped.
 */
function normalizeSettings(input) {
  const next = { ...(input || {}) }
  if (next.baseURLs != null) {
    if (typeof next.baseURLs !== 'object' || Array.isArray(next.baseURLs)) {
      throw new Error('baseURLs must be an object mapping provider name to URL string')
    }
    const baseURLs = {}
    for (const [provider, raw] of Object.entries(next.baseURLs)) {
      if (raw == null || raw === '') continue
      const value = normalizeBaseUrl(raw)
      if (!value) continue
      let parsed
      try {
        parsed = new URL(value)
      } catch {
        throw new Error(`Invalid Base URL for "${provider}": ${value}`)
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Base URL for "${provider}" must start with http(s)://`)
      }
      baseURLs[provider] = parsed.toString().replace(/\/+$/, '')
    }
    next.baseURLs = baseURLs
  }
  return next
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
  // Live config: cordis patch config merged with the persistent settings
  // file (which the web settings UI writes). Re-read on every use so a
  // save from the settings page takes effect without a restart.
  // Logger: use ctx.logger when available, fall back to console.
  const log = {
    info: (...a) => { try { ctx.logger?.info?.(...a) } catch { console.info(...a) } },
    warn: (...a) => { try { ctx.logger?.warn?.(...a) } catch { console.warn(...a) } },
    error: (...a) => { try { ctx.logger?.error?.(...a) } catch { console.error(...a) } },
  }

  const getEffective = () => effectiveConfig(config)
  const provider = () => getEffective().modelProvider || 'qwen'
  const apiKey = () => keyFor(getEffective())
  // Generic tool name by default; override with config.toolName if the host
  // already mounts an image_understand tool.
  const toolName = () => getEffective().toolName || 'image_understand'
  const label = () => `free-vision(${provider()})`

  const buildLumaEnv = () => {
    const cfg = getEffective()
    const prov = provider()
    const key = apiKey()
    const baseURL = baseURLFor(cfg, prov)
    const baseEnvName = PROVIDER_BASE_URL_ENV[prov] || 'CUSTOM_BASE_URL'
    return {
      MODEL_PROVIDER: prov,
      ...(key ? { [PROVIDER_KEY_ENV[prov] || 'DASHSCOPE_API_KEY']: key } : {}),
      ...(baseURL ? { [baseEnvName]: baseURL } : {}),
      // luma-mcp's config.js throws "CUSTOM_MODEL_NAME is required when
      // MODEL_PROVIDER=custom" unless CUSTOM_MODEL_NAME is set. Always forward
      // it for the custom provider (falling back to luma-mcp's own default) so
      // the engine starts even when modelName is left empty.
      ...(prov === 'custom' ? { CUSTOM_MODEL_NAME: cfg.modelName || 'custom-model' } : {}),
      ...(cfg.modelName ? { MODEL_NAME: cfg.modelName } : {}),
      ...(cfg.maxTokens ? { MAX_TOKENS: String(cfg.maxTokens) } : {}),
      ...(cfg.temperature != null ? { TEMPERATURE: String(cfg.temperature) } : {}),
      ...(cfg.multiCrop === false ? { MULTI_CROP: 'false' } : {}),
      ...(cfg.allowedDirs ? { LUMA_ALLOWED_DIRS: cfg.allowedDirs } : {}),
      ...(cfg.lumaEnv || {}),
    }
  }

  let client = null
  let transport = null
  let connecting = null
  let disposed = false
  const disposers = []

  // Tear down the engine connection. When `final` is true (host dispose)
  // the plugin is gone for good; otherwise it only drops the current
  // connection so the next call reconnects with fresh settings.
  function teardown(final = true) {
    clearTimeout(reconnectTimer)
    if (final) disposed = true
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
    connecting = null
  }
  ctx.on('dispose', () => teardown(true))

  async function ensureConnected() {
    if (disposed) throw new Error(`${label()}: plugin has been disposed`)
    if (client) return client
    if (connecting) return connecting
    connecting = (async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
      const env = buildChildEnv(buildLumaEnv())
      transport = new StdioClientTransport({
        command: process.execPath,
        args: [LUMA_ENTRY],
        env,
        stderr: 'pipe',
      })
      // Auto-reconnect with exponential backoff when the engine process dies.
      transport.onclose = () => scheduleReconnect('closed')
      transport.onerror = (err) => scheduleReconnect('error: ' + (err?.message || err))
      // Forward luma-mcp's own logs (INFO/WARN/ERROR) to the harness console.
      if (transport.stderr) {
        transport.stderr.on('data', (chunk) => {
          const line = String(chunk).trim()
          if (line) log.error(`[${label()}] ${line}`)
        })
      }
      const newClient = new Client({ name: 'dsh-free-vision', version: '0.3.0' })
      await newClient.connect(transport)
      reconnectAttempts = 0
      clearTimeout(reconnectTimer)
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

  // No API key yet: register a stub tool so the model still sees
  // image_understand, but calls fail with a clear pointer to Settings
  // instead of an opaque plugin error. The plugin itself always loads.
  function registerStubTool() {
    const definition = {
      name: toolName(),
      description:
        'Analyze an image with a free-tier vision model (image understanding / OCR / UI / debug). ' +
        '看图片/截图/报错/OCR/界面分析：传入图片路径、URL 或 base64。' +
        ' (NOT CONFIGURED: set an API key in Settings → Free Vision first / 未配置：请先在 设置 → Free Vision 填写 API Key)',
      parameters: {
        type: 'object',
        properties: {
          image_source: { type: 'string', description: '图片路径 / HTTP(S) URL / data URI' },
          prompt: { type: 'string', description: '对图片的问题（中英文均可）' },
          task_type: { type: 'string', enum: ['auto', 'general', 'ocr', 'ui', 'debug', 'describe'] },
        },
        required: ['image_source', 'prompt'],
      },
      timeoutMs: 10_000,
      isConcurrencySafe: () => true,
      async execute() {
        throw new Error(
          `[${label()}] 未配置 API Key：请到 设置 → Free Vision 填写（qwen 用 DASHSCOPE_API_KEY，也可用火山/硅基流动免费 Key），保存后即可使用。`,
        )
      },
    }
    try {
      disposers.push(ctx.tools.register(definition))
    } catch (error) {
      log.error(`[${label()}] ${toolName()} stub registration skipped: ${error}`)
    }
  }

  let reconnectTimer = null
  let reconnectAttempts = 0

  function scheduleReconnect(reason) {
    if (disposed) return
    clearTimeout(reconnectTimer)
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
    reconnectAttempts += 1
    log.warn(`[${label()}] engine ${reason}, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)
    reconnectTimer = setTimeout(() => {
      client = null
      transport = null
      connecting = null
      if (!disposed && apiKey()) {
        syncTools().catch((error) => {
          log.error(`[${label()}] reconnect failed: ${error?.message || error}`)
        })
      }
    }, delay)
  }

  // Discover tools and register the generic image_understand tool.
  async function syncTools() {
    const live = await ensureConnected()
    const { tools } = await live.listTools()
    for (const tool of tools) {
      const definition = {
        name: toolName(),
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
          title: toolName(),
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
            throw new Error(extractText(result.content) || `${label()}: ${tool.name} failed`)
          }
          return result.structuredContent ?? { content: result.content ?? [] }
        },
      }
      try {
        disposers.push(ctx.tools.register(definition))
      } catch (error) {
        log.error(`[${label()}] ${toolName()} registration skipped: ${error}`)
      }
    }
  }

  if (!apiKey()) {
    console.warn(
      `[${label()}] no API key: stub tool registered; set one in Settings → Free Vision or via the ${PROVIDER_KEY_ENV[provider()] || 'DASHSCOPE_API_KEY'} environment variable.`,
    )
    registerStubTool()
  } else {
    // Fire-and-forget: tools appear once the vision engine is connected (a few seconds).
    syncTools().catch((error) => {
      log.error(`[${label()}] connection failed, tools not registered: ${error?.message || error}`)
    })
  }

  // ── Web settings UI (only under the web profile) ──────────────────────
  // GET  /dsh-free-vision/config -> { schema, value }
  // POST /dsh-free-vision/config -> save settings, drop the live engine so
  //                                  the next call reconnects with them.
  // dsh-market style: kind + path are how the host router matches routes.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => {
      const sendJson = (res, status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      scope.webServer.register({
        kind: 'exact',
        path: '/dsh-free-vision/config',
        handler: async (req, res) => {
          if (req.method === 'GET') {
            sendJson(res, 200, {
              schema: Config.toJSON(),
              value: getEffective(),
              hasKey: !!apiKey(),
              keySource: keySourceOf(config),
              allowedDirs: resolveAllowedDirs(getEffective()),
            })
            return
          }
          if (req.method === 'POST') {
            let body = ''
            for await (const chunk of req) body += chunk
            try {
              const parsed = JSON.parse(body || '{}')
              const next = normalizeSettings(parsed.config && typeof parsed.config === 'object' ? parsed.config : {})
              writeSettingsFile(next)
              // Drop the live connection and re-sync tools: if the plugin
              // started without a key (stub tool), saving one upgrades the
              // stub to the real engine-backed tool right away.
              teardown(false)
              if (apiKey()) {
                syncTools().catch((error) => {
                  log.error(`[${label()}] re-sync after save failed: ${error?.message || error}`)
                })
              }
              sendJson(res, 200, {
                ok: true,
                value: effectiveConfig(config),
                hasKey: !!apiKey(),
                allowedDirs: resolveAllowedDirs(effectiveConfig(config)),
              })
            } catch (error) {
              sendJson(res, 400, { ok: false, error: String(error?.message || error) })
            }
            return
          }
          res.writeHead(405, { allow: 'GET, POST' })
          res.end()
        },
      })
    })
  }
}

// Exported for unit tests (harmless to cordis).
export {
  CONFIG_PATH,
  effectiveConfig,
  migrateKeys,
  keyFor,
  keySourceOf,
  baseURLFor,
  normalizeSettings,
  resolveAllowedDirs,
  PROVIDER_BASE_URLS,
  PROVIDER_BASE_URL_ENV,
}
