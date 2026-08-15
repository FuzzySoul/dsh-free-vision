# dsh-luma-vision

Vision bridge plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh): gives text-only models the ability to read images — screenshots, code errors, UI layouts, documents, OCR — by spawning [luma-mcp](https://github.com/JochenYang/luma-mcp) from this package's own dependency tree and registering its `image_understand` tool as a native dsh tool.

DSH 视觉理解插件：让纯文本模型获得看图能力（截图、报错、OCR、UI 分析），无需在 `cordis.patch.yml` 手动配置 MCP 服务器。

## Features

- **Zero MCP config** — no `cordis.patch.yml` edits, no `npx` at runtime: the plugin version-locks luma-mcp as its own dependency and spawns it in-process
- **Single tool** — `luma__image_understand` is registered on `ctx.tools` and reaches the model on every request
- **Free by default** — Qwen3-VL-Flash (阿里云百炼限免模型); switch providers via config (Zhipu / SiliconFlow / Qwen / Volcengine / Hunyuan / custom)
- **Direct connection** — proxy env vars are stripped from the child process so dashscope (mainland China) is reached directly (a stray proxy causes 502)
- **Task modes** — `auto | general | ocr | ui | debug | describe`; big images are auto multi-cropped for detail fidelity

## Install

```sh
# from the market (once listed) or directly:
dsh plugin --profile web add dsh-luma-vision
```

Restart `dsh web`. The tool appears as `luma__image_understand`.

## Configuration

Set the API key via the plugin config (in `cordis.patch.yml`) or the `DASHSCOPE_API_KEY` environment variable:

```yaml
- id: luma-vision
  name: 'dsh-luma-vision'
  config:
    apiKey: 'sk-xxxx'          # required; falls back to DASHSCOPE_API_KEY env
    modelProvider: qwen        # zhipu | siliconflow | qwen | volcengine | hunyuan | custom
    modelName: qwen3-vl-flash  # optional override
    toolPrefix: luma           # tool public name: <prefix>__image_understand
    maxTokens: 8192            # optional
    temperature: 0.7           # optional
    multiCrop: true            # set false to disable multi-crop on large images
    toolCallTimeoutMs: 200000  # per-call timeout
    lumaEnv: {}                # extra env vars passed to luma-mcp
```

Provider → API key env (per [luma-mcp](https://github.com/JochenYang/luma-mcp)):

| `modelProvider` | key variable | default model |
| --- | --- | --- |
| `zhipu` | `ZHIPU_API_KEY` | glm-4.6v |
| `siliconflow` | `SILICONFLOW_API_KEY` | deepseek-ai/DeepSeek-OCR (free) |
| `qwen` (default) | `DASHSCOPE_API_KEY` | qwen3-vl-flash (free tier) |
| `volcengine` | `VOLCENGINE_API_KEY` | doubao-seed-1-6-flash-250828 |
| `hunyuan` | `HUNYUAN_API_KEY` | hunyuan-t1-vision-20250916 |
| `custom` | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` + `CUSTOM_MODEL_NAME` | — |

## Usage

The model calls `luma__image_understand` with:

- `image_source` (required): local file path, HTTP(S) URL, or data URI (PNG/JPG/WebP/GIF, ≤10MB)
- `prompt` (required): the user's question about the image
- `task_type` (optional): `auto | general | ocr | ui | debug | describe`

## How it works

```
dsh web → cordis loads luma-vision → spawns luma-mcp (node build/index.js, in-process)
→ MCP connect → tools/list → registers luma__image_understand on ctx.tools
→ model calls the tool → luma preprocesses (compress / multi-crop) → dashscope API (direct)
→ returns text evidence
```

## Development

```sh
npm install
node test-plugin.mjs   # end-to-end smoke test (needs DASHSCOPE_API_KEY env)
```

## License

MIT — this plugin wraps [luma-mcp](https://github.com/JochenYang/luma-mcp) (MIT) and the MCP SDK (MIT).
