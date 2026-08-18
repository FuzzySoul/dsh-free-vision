import { describe, it, expect } from 'vitest'
import {
  messagesContainImage,
  imageBlockToMarkdown,
  imageBlockToText,
  rewriteImagesToReferences,
} from '../dsh/index.js?test=imagedisplay'

const ID = 'sha256:' + 'ab'.repeat(32)
const REF = {
  type: 'image',
  attachment: { attachmentId: ID, mediaType: 'image/png', width: 10, height: 10 },
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

describe('imageBlockToMarkdown / imageBlockToText', () => {
  it('builds a durable /dsh-free-vision/raw reference from a native attachment id', () => {
    expect(imageBlockToMarkdown(REF.attachment)).toBe(`![图片](/dsh-free-vision/raw/sha256%3A${'ab'.repeat(32)})`)
  })

  it('returns null for a missing attachment id', () => {
    expect(imageBlockToMarkdown({})).toBeNull()
    expect(imageBlockToMarkdown(null)).toBeNull()
  })

  it('embeds a cached description inline when provided (one step)', () => {
    const text = imageBlockToText(REF.attachment, '这是蓝发女孩的截图。')
    expect(text).toContain('【图片已自动识别】')
    expect(text).toContain('这是蓝发女孩的截图。')
    expect(text).toContain('/dsh-free-vision/raw/sha256%3A')
  })

  it('falls back to the reference when no description', () => {
    expect(imageBlockToText(REF.attachment, null)).toBe(imageBlockToMarkdown(REF.attachment))
    expect(imageBlockToText(REF.attachment, '  ')).toBe(imageBlockToMarkdown(REF.attachment))
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
  it('rewrite is async and replaces each image with an inline description when describe is provided', async () => {
    const options = {
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'user', content: [TEXT, REF, REF] },
        { role: 'user', content: [TEXT] },
      ],
    }
    const out = await rewriteImagesToReferences(
      options, freeze, dFreeze,
      async () => '描述：这是蓝发女孩的截图。',
    )
    expect(out).not.toBe(options)
    expect(out.messages[0].content).toHaveLength(3)
    expect(out.messages[0].content[0]).toBe(TEXT)
    expect(out.messages[0].content[1].type).toBe('text')
    expect(out.messages[0].content[1].text).toContain('这是蓝发女孩的截图')
    expect(out.messages[0].content[2].type).toBe('text')
    expect(out.messages[1]).toBe(options.messages[1]) // untouched message keeps identity
  })

  it('falls back to reference text when describe returns null', async () => {
    const options = { messages: [{ content: [REF] }] }
    const out = await rewriteImagesToReferences(options, freeze, dFreeze, async () => null)
    expect(out.messages[0].content[0].text).toBe(imageBlockToMarkdown(REF.attachment))
  })

  it('returns the same options when nothing changed', async () => {
    const options = { messages: [{ content: [TEXT] }] }
    expect(await rewriteImagesToReferences(options, freeze, dFreeze)).toBe(options)
  })

  it('keeps the request deep-frozen when the input was frozen', async () => {
    const options = Object.freeze({
      provider: 'x',
      model: 'y',
      messages: [Object.freeze({ content: [TEXT, REF] })],
    })
    const out = await rewriteImagesToReferences(options, freeze, dFreeze, async () => '描述')
    expect(Object.isFrozen(out)).toBe(true)
    expect(out.messages[0].content[1].type).toBe('text')
  })
})
