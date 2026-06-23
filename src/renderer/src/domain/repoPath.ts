// Renderer cannot import Node's `path`, so absolute-path detection is a pure regex
// check that accepts both Windows and POSIX absolute paths.
const windowsDrivePathPattern = /^[a-zA-Z]:[\\/]/
const windowsUncPathPattern = /^\\\\[^\\]+/
const posixAbsolutePathPattern = /^\//

export function isAbsoluteRepoPath(value: string): boolean {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return false
  }

  return (
    windowsDrivePathPattern.test(trimmedValue) ||
    windowsUncPathPattern.test(trimmedValue) ||
    posixAbsolutePathPattern.test(trimmedValue)
  )
}
