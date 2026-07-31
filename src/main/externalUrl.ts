export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)

    return (
      url.protocol === 'https:' &&
      url.hostname.length > 0 &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}
