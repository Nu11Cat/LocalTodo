type GitHubTaskLinkKind = 'issues' | 'pull'

function isGitHubTaskLink(value: string, kind: GitHubTaskLinkKind): boolean {
  try {
    const url = new URL(value)

    if (
      url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== 'github.com' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== ''
    ) {
      return false
    }

    const segments = url.pathname.split('/').filter(Boolean)

    return (
      segments.length === 4 &&
      segments[2] === kind &&
      /^[1-9]\d*$/.test(segments[3])
    )
  } catch {
    return false
  }
}

export function isGitHubIssueUrl(value: string): boolean {
  return isGitHubTaskLink(value, 'issues')
}

export function isGitHubPullRequestUrl(value: string): boolean {
  return isGitHubTaskLink(value, 'pull')
}
