// Real-runtime verification: exercise the new image-display bridge against the
// actual @deepseek-ai/cordis + @deepseek-ai/dsh-llm installed in this host.
import { Context, symbols } from '@deepseek-ai/cordis'
import { freezeMessage, deepFreeze } from '@deepseek-ai/dsh-llm'
import {
  installAdmissionShim,
  wrapImageRefDispatch,
  rewriteImagesToReferences,
  imageBlockToMarkdown,
  messagesContainImage,
} from '../dsh/index.js'

let failures = 0
const ok = (cond, name) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

const ctx = new Context()
const fakeLlm = {
  async resolveModelInfo(provider, model) {
    return { provider, model, inputModalities: ['text'] }
  },
  async stream(opts) {
    ctx.__lastStreamed = opts
    return (async function* () { yield { type: 'text', text: 'ok' } })()
  },
}
ctx.provide('llm', fakeLlm)
ctx.provide('attachments', { saveImage: async () => ({}), readImage: async () => ({}) })

// 1. messagesContainImage / rewrite
const REF = { type: 'image', attachment: { attachmentId: 'sha256:' + 'aa'.repeat(32), mediaType: 'image/png' } }
ok(messagesContainImage([{ content: [REF] }]), 'detects image block')
ok(!messagesContainImage([{ content: [{ type: 'text', text: 'x' }] }]), 'ignores text-only')
const md = imageBlockToMarkdown(REF.attachment)
ok(md === `![图片](/dsh-free-vision/raw/sha256%3A${'aa'.repeat(32)})`, 'markdown ref well-formed: ' + md)

const options = {
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'hi' }, REF] },
  ],
}
const out = await rewriteImagesToReferences(options, freezeMessage, deepFreeze)
ok(out !== options && out.messages[0].content[1].type === 'text', 'rewrite turns image block into text ref')
ok(out.messages[0].content[1].text.startsWith('![图片]('), 'rewritten text is reference form')

// 2. Admission shim against a REAL cordis Context
const before = await fakeLlm.resolveModelInfo('p', 'deepseek-v4-flash')
ok(Array.isArray(before.inputModalities) && before.inputModalities.includes('text'), 'baseline: text-only model declares text modality')
const dispose = await installAdmissionShim(ctx)
const admitted = await ctx.get('llm').resolveModelInfo('p', 'deepseek-v4-flash')
ok(admitted.inputModalities === undefined, 'admission shim drops inputModalities for text-only model')
const vision = await ctx.get('llm').resolveModelInfo('p', 'some-vision-model')
ok(vision.inputModalities === undefined, 'shim (no override list) also drops for others — matches plugin default')
dispose()
const restored = await ctx.get('llm').resolveModelInfo('p', 'deepseek-v4-flash')
ok(restored.inputModalities.includes('text'), 'disposer restores original resolveModelInfo')

// 3. llm/stream dispatch wrapper (fake model that cannot read images)
const fake2 = {
  async resolveModelInfo() {
    return { inputModalities: ['text'] }
  },
  // Real LlmRuntime.stream returns an AsyncIterable (not a promise).
  stream(opts) {
    ctx2.__lastStreamed = opts
    return {
      [Symbol.asyncIterator]() {
        return (async function* () { yield { type: 'text', text: 'ok' } })()
      },
    }
  },
}
const ctx2 = new Context()
ctx2.provide('llm', fake2)
ctx2.provide('attachments', { readImage: async () => ({}) })

const req = { provider: 'p', model: 'm', messages: [{ role: 'user', content: [REF] }] }
let nextCalled = false
const next = () => { nextCalled = true; return (async function* () { yield { type: 'text', text: 'next' } })() }

const gen = wrapImageRefDispatch(ctx2, req, next)
const chunks = []
for await (const c of gen) chunks.push(c)
ok(nextCalled === false, 'rewrite branch re-dispatches via ctx.llm.stream, not next()')
ok(ctx2.__lastStreamed !== undefined, 'stream re-entered with rewritten request')
ok(ctx2.__lastStreamed.messages[0].content[0].type === 'text' && ctx2.__lastStreamed.messages[0].content[0].text.includes('/dsh-free-vision/raw/'), 're-dispatched request carries the reference text')

// 4. Vision-capable model passes through untouched
const fake3 = {
  async resolveModelInfo() { return { inputModalities: ['image', 'text'] } },
  async stream() { throw new Error('should not be called') },
}
const ctx3 = new Context()
ctx3.provide('llm', fake3)
ctx3.provide('attachments', { readImage: async () => ({}) })
let nextCalled3 = false
const next3 = () => { nextCalled3 = true; return (async function* () { yield { type: 'text', text: 'next' } })() }
const gen3 = wrapImageRefDispatch(ctx3, req, next3)
for await (const _ of gen3) {}
ok(nextCalled3 === true, 'vision-capable model passes through to next(), no rewrite')

console.log(failures === 0 ? '\nALL REAL-RUNTIME CHECKS PASSED' : `\n${failures} CHECKS FAILED`)
process.exit(failures === 0 ? 0 : 1)
