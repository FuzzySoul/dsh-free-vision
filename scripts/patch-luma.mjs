// dsh-free-vision: patch the bundled luma-mcp engine so every existing
// provider accepts an optional per-provider base URL override via env vars:
//   QWEN_BASE_URL / SILICONFLOW_BASE_URL / VOLCENGINE_BASE_URL
//   ZHIPU_BASE_URL / HUNYUAN_BASE_URL / CUSTOM_BASE_URL
//
// The plugin writes these variables into the child process environment.
// The patch is idempotent and pinned to luma-mcp 1.7.1 (package.json uses an
// exact version so the expected strings below stay stable).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lumaDir = resolve(root, 'node_modules/luma-mcp/build')

function patchFile(file, replacements) {
  const path = resolve(lumaDir, file)
  let src = readFileSync(path, 'utf8')
  if (src.includes('dsh-free-vision-base-url-override')) {
    console.log(`[patch-luma] already patched ${file}`)
    return
  }
  for (const [oldStr, newStr] of replacements) {
    if (!src.includes(oldStr)) {
      throw new Error(
        `[patch-luma] pattern not found in ${file}: ${oldStr.split('\n')[0].slice(0, 80)}`,
      )
    }
    src = src.replace(oldStr, newStr)
  }
  writeFileSync(path, src, 'utf8')
  console.log(`[patch-luma] patched ${file}`)
}

// config.js: read provider-specific base URL env vars and expose config.baseUrl
patchFile('config.js', [
  [
    `];
function clampNumber(value, min, max, fallback) {`,
    `];

const PROVIDER_BASE_URL_ENV = {
    zhipu: "ZHIPU_BASE_URL",
    siliconflow: "SILICONFLOW_BASE_URL",
    qwen: "QWEN_BASE_URL",
    volcengine: "VOLCENGINE_BASE_URL",
    hunyuan: "HUNYUAN_BASE_URL",
    custom: "CUSTOM_BASE_URL",
}; // dsh-free-vision-base-url-override

function clampNumber(value, min, max, fallback) {`,
  ],
  [
    `        baseVisionPrompt: process.env.BASE_VISION_PROMPT,
        includeMeta,
        customProvider,`,
    `        baseVisionPrompt: process.env.BASE_VISION_PROMPT,
        includeMeta,
        baseUrl: process.env[PROVIDER_BASE_URL_ENV[provider]], // dsh-free-vision-base-url-override
        customProvider,`,
  ],
])

// openai-compatible-client.js: avoid double paths such as
// https://host/v1/v1 or https://host/v1/chat/completions/chat/completions
patchFile('openai-compatible-client.js', [
  [
    `        if (options.endpoint) {
            axiosConfig.baseURL = options.endpoint;
        }
        else if (options.baseURL) {
            axiosConfig.baseURL = options.baseURL.replace(/\\/+$/, "");
        }
        this.client = axios.create(axiosConfig);`,
    `        // dsh-free-vision-base-url-override: keep path handling single-source
        const requestPath = options.path || "";
        if (options.endpoint) {
            axiosConfig.baseURL = options.endpoint;
            this.options.path = "";
        }
        else if (options.baseURL) {
            const baseURL = options.baseURL.replace(/\\/+$/, "");
            if (requestPath && baseURL.toLowerCase().endsWith(requestPath.toLowerCase())) {
                axiosConfig.baseURL = baseURL;
                this.options.path = "";
            }
            else {
                axiosConfig.baseURL = baseURL;
                this.options.path = requestPath;
            }
        }
        this.client = axios.create(axiosConfig);`,
  ],
])

// qwen-client.js
patchFile('qwen-client.js', [
  [
    `            baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",`,
    `            baseURL: config.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1", // dsh-free-vision-base-url-override`,
  ],
])

// hunyuan-client.js
patchFile('hunyuan-client.js', [
  [
    `            baseURL: "https://api.hunyuan.cloud.tencent.com/v1",`,
    `            baseURL: config.baseUrl || "https://api.hunyuan.cloud.tencent.com/v1", // dsh-free-vision-base-url-override`,
  ],
])

// siliconflow-client.js
patchFile('siliconflow-client.js', [
  [
    `            endpoint: "https://api.siliconflow.cn/v1/chat/completions",`,
    `            baseURL: config.baseUrl || "https://api.siliconflow.cn/v1", // dsh-free-vision-base-url-override
            path: "/chat/completions",`,
  ],
])

// volcengine-client.js
patchFile('volcengine-client.js', [
  [
    `            endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",`,
    `            baseURL: config.baseUrl || "https://ark.cn-beijing.volces.com/api/v3", // dsh-free-vision-base-url-override
            path: "/chat/completions",`,
  ],
])

// zhipu-client.js
patchFile('zhipu-client.js', [
  [
    `            endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",`,
    `            baseURL: config.baseUrl || "https://open.bigmodel.cn/api/paas/v4", // dsh-free-vision-base-url-override
            path: "/chat/completions",`,
  ],
])

console.log('[patch-luma] done')