import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from './externalUrl'

describe('isSafeExternalUrl', () => {
  it('accepts normal HTTPS links', () => {
    expect(isSafeExternalUrl('https://github.com/Nu11Cat/LocalTodo/issues/12')).toBe(true)
    expect(isSafeExternalUrl('https://example.com/docs?q=localtodo#usage')).toBe(true)
  })

  it('rejects non-HTTPS protocols', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(false)
    expect(isSafeExternalUrl('file:///C:/secret.txt')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('mailto:user@example.com')).toBe(false)
  })

  it('rejects URLs containing credentials', () => {
    expect(isSafeExternalUrl('https://user@example.com/private')).toBe(false)
    expect(isSafeExternalUrl('https://user:password@example.com/private')).toBe(false)
  })

  it('rejects malformed and empty values', () => {
    expect(isSafeExternalUrl('not a URL')).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
  })
})
