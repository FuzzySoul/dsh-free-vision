# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — show_image：agent 把找到/截图/生成的图片内联渲染进对话流

借鉴社区 `dsh-image-inline` 思路但按本插件的自有架构实现（复用已有 `/dsh-free-vision/raw`
路由与附件服务，不引入额外注册表/HTTP 端点）：

- 新工具 `show_image(image_source, caption?)`：模型把本地图片 / 粘贴引用 / data URI
  渲染进对话流（QQ/微信式内联卡片）。host 校验 + `attachments.saveImage` 持久化为
  sha256 内容寻址附件，结果**纯文本**（路径+尺寸+元数据），图片**不进模型上下文**；
  展示载荷走 `output.presentationMeta` → `tool/result` meta。
- 客户端注册 `tool.call.toolview`（key=`show_image`）渲染内联 `<img>` 卡片（点击新窗口
  看原图），加载走 `/dsh-free-vision/raw/<id>`。
- 配置：`showImageEnabled`（默认开）、`showImageToolName`（可改名避冲突）、
  `showImageMaxBytes`、`showImagePixels`；设置 UI 高级设置可调。
- 健壮性：host 工具名冲突时捕获跳过不拖垮 fiber；client 槽位/配置不可用时自动退化
  为纯文本结果；结果永不含 image 块（纯文本/极简模式路由不受影响，同 v1.0.6-1.0.7 纪律）。
- 修复：`/dsh-free-vision/raw` 增加 **object-file 内容寻址兜底**（优先用附件服务 root，
  兼容 DSH_HOME 覆盖），`show_image` 保存后登记进程内 registry —— 修复真实 E2E 里发现的
  `/raw` 404（同一附件 id 两次请求均 200，DOM `naturalWidth` 确认图片真实渲染）。
- 真实 E2E（隔离 dsh web + DeepSeek V4 Flash）：模型一条指令直接调 `show_image`
  （工具调用 0.1s，不调视觉 API），对话流工具行内联显示图片；`image_understand` 仍可并行分析。
- 新增 11 个 host 单测（解析/保存/meta/大小与像素上限/冲突/未挂载附件服务）。

## [1.0.7] - 2026-08-18

### Added / Changed — 一步到位：粘贴图片直接给出描述，秒答

之前即便图片已在对话里显示缩略图（v1.0.6），纯文本模型仍要自己去“找图→认图→调
`image_understand`”，多出好几步大语言模型往返，用户体感很慢（“不能一步完成吗”）。

本版改为社区最成熟的 one-step 方案（同 `dsh-deepseek-vision`）：

- **分发时直接内联图片描述**：在 `llm/stream` 分发时，对纯文本模型把 image 块替换成
  “已自动识别的图片描述文本”，模型在同一回合直接看到内容并回答 —— **全程 0 次工具调用，
  1 步完成**；真实 E2E（隔离 dsh web + DeepSeek V4 Flash）确认 model 的 think 原文为
  “already auto-recognized … answer directly”，整轮 `1 turns · 1 steps`。
- **描述按 sha256 缓存（进程内 LRU）**：同一张图重复出现/追问时不再调视觉 API，
  E2E 中第二次出现的 TTFT 从 19s 降到 3.9s。
- `image_understand` 保留用于**精确/细分追问**（如 OCR 逐字转写、坐标、颜色），
  可继续传 `/dsh-free-vision/raw/<id>`；E2E 已确认该通道可用。
- 新配置：`describeAtDispatch`（默认开）、`describePrompt`（默认详细描述提示词）、
  `describeCacheSize`（默认 64），均可在 设置 → Free Vision → 高级设置 里改；
  关闭 `describeAtDispatch` 即退回 v1.0.6 的“改写成引用文本再让模型调工具”行为。
- 性能实测（本机）：引擎 spawn+连接 ~333ms；图片 593KB→base64 790KB 为毫秒级；
  一次真实视觉 API ~1.9s（大头在厂商 API，已用缓存消除重复）。

## [1.0.6] - 2026-08-18

### Added

- **Pasted images now show in the conversation.** Previously the client
  rewrite destroyed the image block and resent the message as pure text with a
  `![图片](/dsh-free-vision/raw/…)` reference, so the chat showed raw markdown
  instead of the image. The host now keeps the durable image block (the Web UI
  renders its native thumbnail, same pattern as `dsh-image-pathify` /
  `dsh-deepseek-vision`) and only rewrites image blocks → text references at
  `llm/stream` dispatch for models that cannot take images, so the text-only
  model still calls `image_understand`.
  - `llm.resolveModelInfo` admission shim: drops `inputModalities` from
    non-vision models while an attachment store is mounted, so image sends are
    admitted and the session keeps the real image block.
  - `llm/stream` waterfall: non-vision dispatch with image blocks re-dispatches
    through `ctx.llm.stream` with each image block rewritten to the
    `![图片](/dsh-free-vision/raw/<id>)` reference form `image_understand`
    resolves; vision-capable models pass through untouched.
  - New config `preservePastedImages` (default `true`) in Settings → Free
    Vision → Advanced; set to `false` to restore the old pure-text behavior.
  - Client `sendSession` hook now prefers the native (thumbnail-preserving)
    send and only falls back to the legacy text-rewrite if the host refuses the
    image send — so nothing regresses on older hosts and in constrained
    surfaces (e.g. minimal/compact renderers) where outputting image blocks is
    undesirable.
  - Real-runtime verification against the harness's own cordis/dsh-llm
    (`scripts/verify-realm.mjs`) plus unit tests for the rewrite helpers.

## [1.0.5] - 2026-08-18

### Fixed

- Text-only models can now hand the vision tool a pasted image **reference** and
  have it "just work". Previously the durable `![图片](/dsh-free-vision/raw/<id>…)`
  markdown the client pastes into the conversation could not be consumed by the
  plugin's own engine-proxied `image_understand` tool: the engine's SSRF guard
  blocks the loopback `127.0.0.1` URL, its extension-based sniffing rejects the
  extension-less content-addressed store files, and its narrower allowed-dirs
  policy rejects `/tmp`-style downloads. The tool now resolves references,
  content ids, and attachment object paths **on the host side** into a
  `data:` URI before the engine sees them, so all three failure modes are
  bypassed in one step.

  - Resolves `![图片](/dsh-free-vision/raw/…)` / `[image attachment …]` /
    `sha256:<hex64>` / `…/objects/<xx>/<hex64>` references (preferring the
    embedded durable `?ref=` and the in-process registry, falling back to the
    content-addressed file on disk).
  - Local paths are allowlisted on the host (reusing the existing
    `allowedDirs` resolution), sniffed, and sent as a `data:` URI, so the
    plugin's wider user-extensible whitelist is the policy instead of the
    engine's.
  - More actionable error messages (what the allowed roots are, how to add
    one, how to pass the reference) instead of the engine's opaque
    "outside the allowed directory".

## [1.0.4] - 2026-08-18

### Added

- Pasted/dropped images now feed straight into the vision tool without the
  external `describe-image` plugin: a new backend `POST /dsh-free-vision/attach`
  saves the image into the host attachment store and returns a durable Markdown
  `![图片](/dsh-free-vision/raw/<id>?ref=…)` reference, and a new
  `GET /dsh-free-vision/raw/<id>` route streams those bytes back so the
  reference renders in the conversation.
- The client auto-rewrites outbound messages that carry an image into that text
  reference (wrapping `conversation.sendSession`), so pasting/sending an image
  bypasses the "current model does not support images" admissibility gate. The
  hook is dedup-guarded and wrapped in try/catch with a fallback so it can never
  break the settings page or an existing session.

## [1.0.3] - 2026-08-18

### Added

- Settings UI now exposes an **Allowed Dirs / 允许读取的图片目录** field in
  Advanced settings, so users can see and edit the image read whitelist
  (previously the `allowedDirs` config existed but was invisible in the UI).
- The page shows the **Effective whitelist** (workdir + home defaults plus any
  user-added roots, resolved by the backend), and it refreshes live after save.
- A warning in Advanced settings points users back to this field when the
  engine reports `Access denied: image path is outside the allowed directory`.

### Added

- All-in-one GitHub Actions release workflow (`.github/workflows/release.yml`)
  triggered on push of a `v*` tag: runs tests, `npm publish`, packs a `.tgz`
  and creates/updates the GitHub Release with CHANGELOG-based notes.

## [1.0.2] - 2026-08-18

### Fixed

- `postinstall` patch script is now truly idempotent: the `image-processor.js`
  patch uses the same marker string that `patchFile()` checks for, so re-running
  the script during reinstall/upgrade no longer crashes on a missing pattern.
- Custom provider now always forwards `CUSTOM_MODEL_NAME` (defaulting to
  luma-mcp's `custom-model`), so `modelProvider: custom` starts the engine even
  when `modelName` is left empty.


## [1.0.1] - 2026-08-17

### Fixed

- `postinstall` patch script could crash when installing through pnpm
  (dshmarket updates). The luma-mcp path is now resolved via Node's module
  lookup with fallbacks, so the patch works under npm (flat), pnpm isolated
  (virtual store), and pnpm hoisted layouts.

## [1.0.0] - 2026-08-17

> Closes [#1](https://github.com/FuzzySoul/dsh-free-vision/issues/1): FEAT API override — allow overriding each provider's API Base URL.

### Added

- Per-provider API Base URL override (`baseURLs` map): point qwen / volcengine /
  siliconflow / zhipu / hunyuan (and custom) at a proxy, API Gateway, local
  service or any OpenAI-compatible endpoint. UI shows the default Base URL next
  to the API Key and saves the override to `~/.dsh/free-vision.json`.
- The pinned luma-mcp engine is patched on `postinstall` so provider-specific
  `*_BASE_URL` env vars are consumed by the real API request layer and URL
  duplication (`/v1/v1`, `/chat/completions/chat/completions`) is avoided.

## [0.6.0] - 2026-08-15

### Added

- Engineering hardening pass: vitest unit test suite (13 tests), GitHub Actions CI,
  release script, type declarations, docs/ARCHITECTURE.md, CHANGELOG/SECURITY/CONTRIBUTING/CODE_OF_CONDUCT,
  README badges, .editorconfig/.gitattributes.
- Engine auto-reconnect with exponential backoff (luma-mcp process crash recovery).
- Logger via ctx.logger with console fallback.

## [0.5.0] - 2026-08-15

### Added

- Provider linkage: per-provider API keys (`keys` map), one key slot per provider,
  automatic key selection when switching providers.
- Signup links for every provider (阿里云百炼 / 火山方舟 / 硅基流动 / 智谱 / 腾讯云 TokenHub).
- Live status line in the settings UI (active provider + key source).
- `keySource` (`file` / `env` / `none`) exposed by the config API.

### Changed

- Settings UI fully dark-themed (readable by vision models and screenshot pipelines).
- Settings UI shows "current effective config" instead of stale defaults.
- Legacy flat `apiKey` config is migrated into `keys[provider]` automatically.

## [0.4.0] - 2026-08-15

### Changed

- Settings UI converted to a permanent dark palette (no light fallbacks).

## [0.3.3] - 2026-08-15

### Added

- Settings UI shows live status (provider + key source).

## [0.3.2] - 2026-08-15

### Fixed

- Saving a key after startup now upgrades the stub tool to the real engine-backed
  tool immediately (previously required a restart).

## [0.3.1] - 2026-08-15

### Added

- "FREE 免费" badges on free-tier provider cards.
- No-key warning banner in the settings UI.
- Required marker on the API key field.

### Fixed

- Contrast issues in the settings UI (secondary text, placeholders).

## [0.3.0] - 2026-08-15

### Added

- Settings UI v2: free-tier provider picker cards + collapsible advanced settings.
- Graceful no-key degradation: a stub `image_understand` tool with a clear
  Chinese/English message is registered instead of failing the plugin.

### Fixed

- `lumaEnv` rendering in the settings form.

## [0.2.1] - 2026-08-15

### Fixed

- `webServer` route registration: use the `kind` + `path` format required by
  the dsh host router (settings UI could not load config before).

## [0.2.0] - 2026-08-15

### Added

- Settings UI: "Free Vision" section in `Settings` (client bundle + config API).
- Persistent settings file (`~/.dsh/free-vision.json`), saved from the UI.
- Save-takes-effect-immediately: the live engine reconnects with new settings.

## [0.1.1] - 2026-08-15

### Added

- Plugin `Config` schema (schemastery) so the web GUI can render/validate settings.

## [0.1.0] - 2026-08-15

### Added

- Initial release: `image_understand` vision tool for text-only dsh models,
  powered by luma-mcp (free-tier providers: Qwen3-VL-Flash, Doubao, DeepSeek-OCR).
- Zero MCP config: the vision engine ships as a package dependency, spawned in-process.
- Proxy env vars stripped from the engine process (mainland-China API direct connect).

[Unreleased]: https://github.com/FuzzySoul/dsh-free-vision/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/FuzzySoul/dsh-free-vision/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/FuzzySoul/dsh-free-vision/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/FuzzySoul/dsh-free-vision/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/FuzzySoul/dsh-free-vision/releases/tag/v0.1.0
