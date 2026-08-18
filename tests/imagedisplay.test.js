import { describe, it, expect } from 'vitest'
import { messagesContainImage, imageBlockToMarkdown, rewriteImagesToReferences } from '../dsh/index.js?test=imagedisplay'

const REF = {
  type: 'image',
  attachment: { attachmentId: 'sha256:' + 'ab'.repeat(32), mediaType: 'image/png', width: 10, height: 10 },
}
const TEXT = { type: 'text', text: 'hi' }

const freeze = (v) => Object.freeze(v)
const dFreeze = (v) => {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) dFreeze(v[k])
    Object.freeze(v)
  }
  return v
}

describe('imageBlockToMarkdown', () => {
  it('builds a durable /dsh-free-vision/raw reference from a native attachment id', () => {
    const md = imageBlockToMarkdown(REF.attachment)
    expect(md).toBe(`![图片](/dsh-free-vision/raw/sha256%3A${'ab'.repeat(32)})`)
  })

  it('returns null for a missing attachment id', () => {
    expect(imageBlockToMarkdown({})).toBeNull()
    expect(imageBlockToMarkdown(null)).toBeNull()
  })
})

describe('messagesContainImage', () => {
  it('detects a top-level image block', () => {
    expect(messagesContainImage([{ content: [TEXT, REF] }])).toBe(true)
    expect(messagesContainImage([{ content: [TEXT] }])).toBe(false)
    expect(messagesContainImage([])).toBe(false)
  })
})

describe('rewriteImagesToReferences', () => {
  it('replaces each image block with a text reference and preserves other blocks', () => {
    const options = {
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'user', content: [TEXT, REF, REF] },
        { role: 'user', content: [TEXT] },
      ],
    }
    const out = rewriteImagesToReferences(options, freeze, dFreeze)
    expect(out).not.toBe(options)
    expect(out.messages[0].content).toHaveLength(3)
    expect(out.messages[0].content[0]).toBe(TEXT)
    expect(out.messages[0].content[1]).toEqual({
      type: 'text',
      text: imageBlockToMarkdown(REF.attachment),
    })
    expect(out.messages[0].content[2].type).toBe('text')
    expect(out.messages[1]).toBe(options.messages[1]) // untouched message keeps identity
  })

  it('returns the same options when nothing changed', () => {
    const options = { messages: [{ content: [TEXT] }] }
    expect(rewriteImagesToReferences(options, freeze, dFreeze)).toBe(options)
  })

  it('keeps the request deep-frozen when the input was frozen', () => {
    const options = Object.freeze({
      provider: 'x',
      model: 'y',
      messages: [Object.freeze({ content: [TEXT, REF] })],
    })
    const out = rewriteImagesToReferences(options, freeze, dFreeze)
    expect(Object.isFrozen(out)).toBe(true)
    expect(out.messages[0].content[1].type).toBe('text')
  })
})
