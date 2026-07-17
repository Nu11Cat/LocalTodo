import { describe, expect, it } from 'vitest'
import { isGitHubIssueUrl, isGitHubPullRequestUrl } from './githubLink'

describe('GitHub task link validation', () => {
  it('accepts canonical Issue and Pull Request links', () => {
    expect(isGitHubIssueUrl('https://github.com/Nu11Cat/LocalTodo/issues/12')).toBe(true)
    expect(isGitHubIssueUrl('https://github.com/Nu11Cat/LocalTodo/issues/12/')).toBe(true)
    expect(isGitHubPullRequestUrl('https://github.com/Nu11Cat/LocalTodo/pull/34')).toBe(true)
    expect(isGitHubPullRequestUrl('https://github.com/Nu11Cat/LocalTodo/pull/34#discussion')).toBe(
      true
    )
  })

  it('rejects the wrong GitHub resource type', () => {
    expect(isGitHubIssueUrl('https://github.com/Nu11Cat/LocalTodo/pull/34')).toBe(false)
    expect(isGitHubPullRequestUrl('https://github.com/Nu11Cat/LocalTodo/issues/12')).toBe(false)
  })

  it('rejects unsafe or lookalike origins', () => {
    expect(isGitHubIssueUrl('http://github.com/Nu11Cat/LocalTodo/issues/12')).toBe(false)
    expect(isGitHubIssueUrl('https://github.com.evil.test/Nu11Cat/LocalTodo/issues/12')).toBe(false)
    expect(isGitHubIssueUrl('https://user@github.com/Nu11Cat/LocalTodo/issues/12')).toBe(false)
    expect(isGitHubIssueUrl('https://github.com:444/Nu11Cat/LocalTodo/issues/12')).toBe(false)
    expect(isGitHubIssueUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects malformed resource paths and issue numbers', () => {
    expect(isGitHubIssueUrl('https://github.com/Nu11Cat/LocalTodo/issues')).toBe(false)
    expect(isGitHubIssueUrl('https://github.com/Nu11Cat/LocalTodo/issues/0')).toBe(false)
    expect(isGitHubIssueUrl('https://github.com/Nu11Cat/LocalTodo/issues/not-a-number')).toBe(false)
    expect(isGitHubPullRequestUrl('')).toBe(false)
  })
})
