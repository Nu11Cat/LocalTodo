import { describe, expect, it } from 'vitest'
import { isAbsoluteRepoPath } from './repoPath'

describe('isAbsoluteRepoPath', () => {
  it('accepts Windows drive paths with either slash', () => {
    expect(isAbsoluteRepoPath('C:\\repo')).toBe(true)
    expect(isAbsoluteRepoPath('C:/repo')).toBe(true)
    expect(isAbsoluteRepoPath('g:/path/to/repo')).toBe(true)
  })

  it('accepts Windows UNC paths', () => {
    expect(isAbsoluteRepoPath('\\\\server\\share')).toBe(true)
  })

  it('accepts POSIX absolute paths', () => {
    expect(isAbsoluteRepoPath('/home/user/repo')).toBe(true)
  })

  it('trims surrounding whitespace before checking', () => {
    expect(isAbsoluteRepoPath('  C:/repo  ')).toBe(true)
  })

  it('rejects relative paths', () => {
    expect(isAbsoluteRepoPath('repo')).toBe(false)
    expect(isAbsoluteRepoPath('./repo')).toBe(false)
    expect(isAbsoluteRepoPath('../repo')).toBe(false)
    expect(isAbsoluteRepoPath('repo/sub')).toBe(false)
  })

  it('rejects empty or whitespace-only values', () => {
    expect(isAbsoluteRepoPath('')).toBe(false)
    expect(isAbsoluteRepoPath('   ')).toBe(false)
  })
})
