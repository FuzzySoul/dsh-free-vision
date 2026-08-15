import { Config } from './dsh/index.js'

// cordis 同款解析方式
const parsed = Config['~standard'].validate({})
console.log('validate({}) 默认值:', JSON.stringify(parsed.value || parsed))
console.log('~standard 存在:', !!Config['~standard'])

// 验证非法 provider 被拒绝
const bad = Config['~standard'].validate({ modelProvider: 'nope' })
console.log('非法 provider 结果:', JSON.stringify(bad.issues || bad.errors || bad).slice(0, 150))

// 验证合法覆盖
const ok = Config['~standard'].validate({ modelProvider: 'volcengine', toolName: 'see_image' })
console.log('覆盖结果:', JSON.stringify(ok.value || ok).slice(0, 200))
console.log('Config 加载 OK')
