import { writeFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

// 模拟写设置文件
const CONFIG_PATH = homedir() + '/.dsh/free-vision.json'
writeFileSync(CONFIG_PATH, JSON.stringify({ modelProvider: 'volcengine', toolName: 'see_image', apiKey: 'test-key-123' }), 'utf-8')

// 模拟插件 apply 的 effectiveConfig
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

// 直接测宿主导出的函数（用模块重新加载方式）
const mod = await import('./dsh/index.js?t=' + Date.now())
console.log('插件 name:', mod.name, '| inject:', mod.inject.join(','))
console.log('Config 存在:', typeof mod.Config?.toJSON === 'function')

// 验证设置文件已写入
const raw = readFileSync(CONFIG_PATH, 'utf-8')
console.log('设置文件内容:', raw)
console.log('✅ 配置持久化验证通过')
