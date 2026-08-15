import z from '@deepseek-ai/schemastery'
const s = z.object({ a: z.string().default('x'), b: z.union([z.const('q'), z.const('w')]).default('q') })
console.log('constructor:', s?.constructor?.name)
console.log('methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(s)).slice(0, 30).join(', '))
console.log('own keys:', Object.keys(s).slice(0, 20).join(', '))
