# Security Policy / 安全策略

## Supported versions / 受支持版本

| Version | Supported |
| ------- | --------- |
| 0.5.x   | ✅ |
| < 0.5   | ❌ |

## Reporting a vulnerability / 报告漏洞

Please **do not** open a public issue for security vulnerabilities. Instead,
report privately via GitHub's security advisory feature:
<https://github.com/FuzzySoul/dsh-free-vision/security/advisories/new>

You can expect an acknowledgement within 48 hours and a fix plan within
7 days for confirmed issues.

## Security notes / 安全说明

- API keys are stored in `~/.dsh/free-vision.json` (0600-equivalent, user
  profile only). Never commit this file or `.npmrc` tokens to git.
- The plugin spawns `luma-mcp` from its own dependency tree; it does not
  execute arbitrary shell commands from user input.
- Proxy environment variables are stripped from the engine process so API
  traffic never leaks through an unexpected proxy.
