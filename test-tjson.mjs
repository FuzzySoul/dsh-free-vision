import { Config } from './dsh/index.js'
const json = Config.toJSON()
console.log(JSON.stringify(json, null, 1).slice(0, 3000))
