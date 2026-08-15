# Contributing / 贡献指南

Thanks for considering a contribution! / 感谢参与贡献！

## Development setup / 开发环境

```sh
npm install
npm test          # unit tests (vitest)
node test-plugin.mjs   # end-to-end smoke test (needs a provider API key env)
```

## Project layout / 项目结构

```
dsh/index.js        # host plugin: engine spawn, tool registration, config API
client/client.js    # web settings UI (browser bundle, __ModuleLoader__ format)
cordis.patch.yml    # bundle manifest (plugin row inserted by dsh)
```

## Coding style / 代码风格

- Plain ESM JavaScript, no build step for the plugin itself (runs in dsh
  directly). Keep `dsh/index.js` dependency-free except for the declared
  runtime deps.
- The client bundle uses the `window.__ModuleLoader__.load` factory format —
  do not introduce JSX or a bundler without a migration plan.
- All user-facing strings should be bilingual (Chinese + English) or use the
  locale dictionaries.

## Testing / 测试

- Unit tests live in `tests/` (vitest): config migration, key resolution,
  route handlers.
- Before a release, run the end-to-end smoke test with a real API key:
  `DASHSCOPE_API_KEY=... node test-plugin.mjs`.

## Releasing / 发布

```sh
npm run release    # bump version + changelog + publish (manual approval)
```

## Commit messages / 提交信息

Use conventional commits: `feat:`, `fix:`, `style:`, `docs:`, `test:`, `chore:`.
