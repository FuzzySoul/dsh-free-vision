# Architecture / 架构

## Overview / 总览

```
┌────────────────────────────────────────────────────────┐
│ dsh web (host process)                                  │
│                                                        │
│  cordis loads dsh-free-vision (dsh/index.js)            │
│  ├─ registers image_understand on ctx.tools             │
│  ├─ spawns luma-mcp (in-process, version-locked)        │
│  ├─ serves /dsh-free-vision/config (GET/POST)           │
│  └─ persists settings to ~/.dsh/free-vision.json        │
│                                                        │
│  client bundle (client/client.js)                       │
│  └─ Settings → "Free Vision" section (settings.section) │
│     └─ provider cards + key slots + advanced settings   │
└────────────────────────────────────────────────────────┘
        │ MCP (stdio, JSON-RPC)
        ▼
┌────────────────────────────────────────────────────────┐
│ luma-mcp (MIT) — vision engine                          │
│  ├─ image preprocessing (compress, multi-crop, OCR)     │
│  ├─ provider adapters: qwen / volcengine / siliconflow  │
│  │                     zhipu / hunyuan / custom         │
│  └─ retry + SSRF protection                             │
└────────────────────────────────────────────────────────┘
        │ HTTPS (direct, no proxy)
        ▼
    dashscope / volcengine / siliconflow / ... APIs
```

## Key design decisions / 关键设计决策

1. **Engine as dependency, plugin as shell** — luma-mcp ships in the package's
   dependency tree and is spawned in-process (`node build/index.js`), so the
   plugin and engine version-lock together. No `npx` at runtime, no PATH
   lookup.

2. **No proxy for the engine** — dashscope & friends are mainland-China
   endpoints; proxy env vars are stripped from the child process. A stray
   proxy causes 502 (this was a real incident during development).

3. **Save takes effect immediately** — settings are re-read on every use
   (`effectiveConfig`), and saving drops the live connection so the next
   tool call reconnects with fresh settings. No restart required.

4. **Per-provider keys** — `keys[provider]` map; switching providers in the
   settings UI automatically selects that provider's key. Legacy flat
   `apiKey` is migrated on first read.

5. **Graceful degradation** — without an API key the plugin still loads and
   registers a stub tool whose error message points to Settings, so the host
   never shows an opaque plugin failure.

6. **Direct connection, no MCP server config** — unlike the manual
   `dsh-mcp-client` route, this plugin owns the whole pipeline, so users
   never touch `cordis.patch.yml`.

## Settings persistence / 配置持久化

`~/.dsh/free-vision.json`:

```json
{
  "keys": { "qwen": "sk-...", "volcengine": "" },
  "modelProvider": "qwen",
  "modelName": "",
  "toolName": "image_understand",
  "maxTokens": 8192,
  "temperature": 0.7,
  "multiCrop": true,
  "toolCallTimeoutMs": 200000,
  "lumaEnv": {}
}
```

Merge order: cordis patch config < settings file. The live key resolution is
`keys[provider] > legacy apiKey > provider env var`.

## HTTP API / 接口

| Method | Path | Description |
| --- | --- | --- |
| GET | `/dsh-free-vision/config` | `{ schema, value, hasKey, keySource }` |
| POST | `/dsh-free-vision/config` | Save settings; re-sync tools if a key appeared |
