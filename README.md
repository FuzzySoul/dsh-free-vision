# dsh-free-vision

[![npm version](https://img.shields.io/npm/v/dsh-free-vision)](https://www.npmjs.com/package/dsh-free-vision)
[![npm downloads](https://img.shields.io/npm/dm/dsh-free-vision)](https://www.npmjs.com/package/dsh-free-vision)
[![npm dev](https://img.shields.io/npm/v/dsh-free-vision/dev?label=dev)](https://www.npmjs.com/package/dsh-free-vision)
[![license](https://img.shields.io/npm/l/dsh-free-vision)](LICENSE)
[![stars](https://img.shields.io/github/stars/FuzzySoul/dsh-free-vision)](https://github.com/FuzzySoul/dsh-free-vision)
[![GitHub issues](https://img.shields.io/github/issues/FuzzySoul/dsh-free-vision)](https://github.com/FuzzySoul/dsh-free-vision/issues)


**Free vision plugin for DeepSeek Harness (dsh)** — gives text-only models the ability to read images (screenshots, code errors, UI layouts, documents, OCR) using **free-tier vision models**, with zero MCP configuration.

DSH 免费视觉插件：让纯文本模型获得看图能力，优先使用各平台免费视觉模型，无需手动配置 MCP。

## Why free? / 为什么免费

The plugin defaults to providers with generous free quotas — no billing surprises:

| Provider | Model | Free quota | API key env |
| --- | --- | --- | --- |
| **qwen** (default) | Qwen3-VL-Flash | 阿里云百炼限免（激活送 50万 token） | `DASHSCOPE_API_KEY` |
| **volcengine** | Doubao 视觉模型 | 火山引擎豆包免费 token（20万，可申请 50万） | `VOLCENGINE_API_KEY` |
| **siliconflow** | DeepSeek-OCR | 硅基流动 OCR 免费 | `SILICONFLOW_API_KEY` |
| zhipu | GLM-4.6V | 按量 | `ZHIPU_API_KEY` |
| hunyuan | HY-Vision | 按量 | `HUNYUAN_API_KEY` |
| custom | any OpenAI-compatible | — | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` + `CUSTOM_MODEL_NAME` |

One 1MB screenshot ≈ 2,600 tokens ≈ **$0.0006** on qwen; free quota covers ~190,000 images.
一张 1MB 截图 ≈ 2600 token，qwen 限免额度可分析约 19 万张图。

## Features / 特性

- **Zero MCP config** — no `cordis.patch.yml` edits, no `npx` at runtime: the vision engine (luma-mcp) ships as this package's own dependency and is spawned in-process
- **Single generic tool** — `image_understand` (rename via `config.toolName`) is registered on `ctx.tools` and reaches the model on every request
- **Free-first multi-provider** — qwen / volcengine / siliconflow free tiers out of the box; zhipu / hunyuan / custom for anything else
- **Per-provider API Base URL override** — point any built-in provider at a proxy, API Gateway, local service or OpenAI-compatible endpoint without turning it into a `custom` provider
- **Direct connection** — proxy env vars are stripped from the child process so mainland-China API endpoints are reached directly (a stray proxy causes 502)
- **Task modes** — `auto | general | ocr | ui | debug | describe`; big images are auto multi-cropped for detail fidelity
- **Bilingual** — descriptions and docs work for both English and Chinese prompts

## Install / 安装

```sh
dsh plugin --profile web add dsh-free-vision
```

Restart `dsh web`. The tool appears as `image_understand`.
重启 `dsh web` 后，工具 `image_understand` 即可用。

## Settings UI / 设置界面

After restart, open **Settings → Free Vision** — a form for every config option
(API key, provider, tool name, etc.) rendered from the plugin's schema.
Changes are saved to `~/.dsh/free-vision.json` and take effect on the next
tool call (no restart needed).

重启 dsh web 后，打开 **设置 → Free Vision** 即可看到配置表单（API Key、提供商、
工具名等），保存后下一次调用立即生效，无需重启。

## Configuration / 配置

```yaml
- id: free-vision
  name: 'dsh-free-vision'
  config:
    apiKey: 'sk-xxxx'        # optional: falls back to the provider env var
    baseURLs: {}             # optional per-provider API base URL override, e.g. { qwen: 'https://my-proxy.example.com/v1' }
    modelProvider: qwen      # qwen | volcengine | siliconflow | zhipu | hunyuan | custom
    modelName: qwen3-vl-flash # optional model override
    toolName: image_understand # tool public name (rename if it collides)
    maxTokens: 8192
    temperature: 0.7
    multiCrop: true
    toolCallTimeoutMs: 200000
    lumaEnv: {}              # extra env vars for the vision engine
```

Or just set the matching environment variable (e.g. `DASHSCOPE_API_KEY`).
也可以只设置对应的环境变量（如 `DASHSCOPE_API_KEY`）。

### Base URL override / API 地址覆盖

Each built-in provider keeps its official default endpoint when `baseURLs` is
missing or the value is empty.

| Provider | Default Base URL |
| --- | --- |
| qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| volcengine | `https://ark.cn-beijing.volces.com/api/v3` |
| siliconflow | `https://api.siliconflow.cn/v1` |
| zhipu | `https://open.bigmodel.cn/api/paas/v4` |
| hunyuan | `https://api.hunyuan.cloud.tencent.com/v1` |

The engine appends `/chat/completions` automatically and avoids double paths,
so both of these work:

- `https://my-proxy.example.com/v1`
- `https://my-proxy.example.com/v1/chat/completions`

You can also set the matching environment variable instead of the settings UI:
`QWEN_BASE_URL`, `VOLCENGINE_BASE_URL`, `SILICONFLOW_BASE_URL`, `ZHIPU_BASE_URL`,
`HUNYUAN_BASE_URL` (and `CUSTOM_BASE_URL` for the existing custom provider).

### Free API keys / 免费 Key 申请

| Provider | Where to get a free key |
| --- | --- |
| qwen | 阿里云百炼 bailian.console.aliyun.com — 开通即送免费额度，模型选择 qwen3-vl-flash（限免） |
| volcengine | 火山引擎 volcengine.com — 豆包模型新用户送免费 token（20万起，可申请 50万） |
| siliconflow | 硅基流动 siliconflow.cn — DeepSeek-OCR 免费调用 |

## Usage / 用法

The model calls `image_understand` with:

- `image_source` (required): local file path, HTTP(S) URL, or data URI (PNG/JPG/WebP/GIF, ≤10MB)
- `prompt` (required): the question about the image — works in English or Chinese
- `task_type` (optional): `auto | general | ocr | ui | debug | describe`

## How it works / 工作原理

```
dsh web → cordis loads free-vision → spawns the vision engine (in-process, version-locked)
→ MCP connect → registers image_understand on ctx.tools
→ model calls the tool → engine preprocesses (compress / multi-crop) → free vision API (direct)
→ returns text evidence
```

## Development / 开发

```sh
npm install
node test-plugin.mjs   # end-to-end smoke test (needs an API key env)
```

## License

MIT — wraps [luma-mcp](https://github.com/JochenYang/luma-mcp) (MIT) and the MCP SDK (MIT). Free-quota figures are from the providers' official pages and may change; check before relying on them.
