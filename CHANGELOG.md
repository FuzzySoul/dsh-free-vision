# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
