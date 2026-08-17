# dsh-free-vision
🌐 [English](README.en.md) | [中文](README.md)

[![npm 版本](https://img.shields.io/npm/v/dsh-free-vision)](https://www.npmjs.com/package/dsh-free-vision)
[![npm 下载](https://img.shields.io/npm/dm/dsh-free-vision)](https://www.npmjs.com/package/dsh-free-vision)
[![许可证](https://img.shields.io/npm/l/dsh-free-vision)](LICENSE)
[![stars](https://img.shields.io/github/stars/FuzzySoul/dsh-free-vision)](https://github.com/FuzzySoul/dsh-free-vision)


**DSH 免费视觉插件** — 让纯文本模型获得看图能力（截图、报错、UI 分析、OCR、文档），优先使用各平台**免费视觉模型**，零 MCP 配置。

**Free vision plugin for DeepSeek Harness (dsh)** — image understanding for text-only models using free-tier vision models, with zero MCP configuration.

## 为什么免费 / Why free

默认使用免费额度充足的提供商，无账单惊吓：

| 提供商 | 模型 | 免费额度 | API Key 环境变量 |
| --- | --- | --- | --- |
| **qwen**（默认） | Qwen3-VL-Flash | 阿里云百炼限免（激活送 50万 token） | `DASHSCOPE_API_KEY` |
| **volcengine** | 豆包视觉模型 | 火山引擎豆包免费 token（20万起，可申请 50万） | `VOLCENGINE_API_KEY` |
| **siliconflow** | DeepSeek-OCR | 硅基流动 OCR 免费 | `SILICONFLOW_API_KEY` |
| zhipu | GLM-4.6V | 按量 | `ZHIPU_API_KEY` |
| hunyuan | HY-Vision | 按量 | `HUNYUAN_API_KEY` |
| custom | 任意 OpenAI 兼容 | — | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` + `CUSTOM_MODEL_NAME` |

一张 1MB 截图 ≈ 2600 token，qwen 限免额度可分析约 19 万张图。
One 1MB screenshot ≈ 2,600 tokens ≈ **$0.0006** on qwen; free quota covers ~190,000 images.

## 特性 / Features

- **零 MCP 配置** — 不用改 `cordis.patch.yml`、运行时不用 `npx`：视觉引擎（luma-mcp）作为本包依赖内置，进程内启动
- **单个通用工具** — `image_understand`（可用 `config.toolName` 改名）注册到 `ctx.tools`，每次请求模型都能看到
- **免费优先、多提供商** — 千问 / 豆包 / 硅基流动免费档开箱即用；智谱 / 混元 / custom 可切换
- **每个 Provider 可覆盖 API Base URL** — 内置 Provider 可指向代理、API Gateway、本地服务或任意 OpenAI 兼容端点，无需改成 custom
- **直连** — 子进程剥离代理环境变量，国内 API 直连（带代理会导致 502）
- **任务模式** — `auto | general | ocr | ui | debug | describe`；大图自动多裁剪保真
- **中英双语** — 工具描述与文档中英文都可用

## 安装 / Install

```sh
dsh plugin --profile web add dsh-free-vision
```

重启 `dsh web` 后，工具 `image_understand` 即可用。
Restart `dsh web`; the tool appears as `image_understand`.

## 设置界面 / Settings UI

重启 dsh web 后，打开 **设置 → Free Vision** 即可看到配置表单（API Key、提供商、
工具名等），由插件 schema 自动渲染。保存到 `~/.dsh/free-vision.json`，下一次
调用立即生效，无需重启。

After restart, open **Settings → Free Vision** — a form for every config option,
saved to `~/.dsh/free-vision.json`, effective on the next tool call.

## 配置 / Configuration

```yaml
- id: free-vision
  name: 'dsh-free-vision'
  config:
    apiKey: 'sk-xxxx'        # 可选：缺省回退到提供商环境变量
    baseURLs: {}             # 可选：按 Provider 覆盖 API Base URL，例如 { qwen: 'https://my-proxy.example.com/v1' }
    modelProvider: qwen      # qwen | volcengine | siliconflow | zhipu | hunyuan | custom
    modelName: qwen3-vl-flash # 可选模型覆盖
    toolName: image_understand # 工具公开名（冲突时可改名）
    maxTokens: 8192
    temperature: 0.7
    multiCrop: true
    toolCallTimeoutMs: 200000
    lumaEnv: {}              # 传递给视觉引擎的额外环境变量
```

也可以只设置对应的环境变量（如 `DASHSCOPE_API_KEY`）。
Or just set the matching environment variable (e.g. `DASHSCOPE_API_KEY`).

### 覆盖 API 地址 / Base URL override

当 `baseURLs` 缺失或值为空时，继续使用该 Provider 的官方默认地址。

| Provider | 默认 Base URL |
| --- | --- |
| qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| volcengine | `https://ark.cn-beijing.volces.com/api/v3` |
| siliconflow | `https://api.siliconflow.cn/v1` |
| zhipu | `https://open.bigmodel.cn/api/paas/v4` |
| hunyuan | `https://api.hunyuan.cloud.tencent.com/v1` |

引擎会自动拼接 `/chat/completions` 并避免重复路径，因此以下写法都可用：

- `https://my-proxy.example.com/v1`
- `https://my-proxy.example.com/v1/chat/completions`

也可以使用环境变量：`QWEN_BASE_URL`、`VOLCENGINE_BASE_URL`、
`SILICONFLOW_BASE_URL`、`ZHIPU_BASE_URL`、`HUNYUAN_BASE_URL`
（以及 custom 的 `CUSTOM_BASE_URL`）。

### 免费 Key 申请 / Free API keys

| 提供商 | 免费 Key 获取 |
| --- | --- |
| qwen | 阿里云百炼 bailian.console.aliyun.com — 开通即送免费额度，模型选 qwen3-vl-flash（限免） |
| volcengine | 火山引擎 volcengine.com — 豆包新用户送免费 token（20万起，可申请 50万） |
| siliconflow | 硅基流动 siliconflow.cn — DeepSeek-OCR 免费调用 |

## 用法 / Usage

模型调用 `image_understand` 时传入：

- `image_source`（必填）：本地路径、HTTP(S) URL 或 data URI（PNG/JPG/WebP/GIF，≤10MB）
- `prompt`（必填）：对图片的问题 — 中英文均可
- `task_type`（可选）：`auto | general | ocr | ui | debug | describe`

## 工作原理 / How it works

```
dsh web → cordis 加载 free-vision → 进程内启动视觉引擎（版本锁定）
→ MCP 连接 → 注册 image_understand 到 ctx.tools
→ 模型调用工具 → 引擎预处理（压缩 / 多裁剪）→ 免费视觉 API（直连）
→ 返回文字证据
```

## 开发 / Development

```sh
npm install
node test-plugin.mjs   # 端到端冒烟测试（需要 API Key 环境变量）
```

## 许可证 / License

MIT — 封装 [luma-mcp](https://github.com/JochenYang/luma-mcp)（MIT）与 MCP SDK（MIT）。免费额度数据来自各平台官方页面，可能变动，使用前请核实。
