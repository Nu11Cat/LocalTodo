import { sanitizeTaskStringList } from './taskModel'
import { unassignedProjectKey } from './projectSummary'

// Default verification commands remembered per project (keyed by the same
// composite projectName+repoPath key as project grouping). When a task is bound
// to a project and has no commands yet, these are prefilled automatically.
export interface ProjectDefaultCommands {
  key: string
  commands: string[]
}

// The unassigned bucket ("no project") is not a real project, so it can never
// hold default commands — guarding here keeps clearing a task's project binding
// from prefilling commands off a stray/hand-edited unassigned entry.
function isStorableProjectKey(key: string): boolean {
  return key !== unassignedProjectKey
}

// Replace the entry for a project key in place, or append a new one. An empty
// command list removes the entry entirely so cleared defaults don't linger.
export function upsertProjectDefaultCommands(
  entries: ProjectDefaultCommands[],
  key: string,
  commands: string[]
): ProjectDefaultCommands[] {
  const sanitized = sanitizeTaskStringList(commands)
  const existingIndex = entries.findIndex((entry) => entry.key === key)

  if (sanitized.length === 0 || !isStorableProjectKey(key)) {
    return existingIndex === -1 ? entries : entries.filter((entry) => entry.key !== key)
  }

  if (existingIndex === -1) {
    return [...entries, { key, commands: sanitized }]
  }

  const next = [...entries]
  next[existingIndex] = { key, commands: sanitized }
  return next
}

export function removeProjectDefaultCommands(
  entries: ProjectDefaultCommands[],
  key: string
): ProjectDefaultCommands[] {
  return entries.filter((entry) => entry.key !== key)
}

export function findProjectDefaultCommands(
  entries: ProjectDefaultCommands[],
  key: string
): ProjectDefaultCommands | undefined {
  return entries.find((entry) => entry.key === key)
}

// Defensive parse for persisted (and possibly hand-edited) localStorage content.
// Missing or malformed fields fall back to safe values so bad data never throws.
// Entries with no usable commands, or duplicate keys, are dropped.
export function parseProjectDefaultCommands(raw: unknown): ProjectDefaultCommands[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const entries: ProjectDefaultCommands[] = []
  const seenKeys = new Set<string>()

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>

    if (typeof record.key !== 'string' || !isStorableProjectKey(record.key) || seenKeys.has(record.key)) {
      continue
    }

    const commands = sanitizeTaskStringList(record.commands)

    if (commands.length === 0) {
      continue
    }

    seenKeys.add(record.key)
    entries.push({ key: record.key, commands })
  }

  return entries
}

export function serializeProjectDefaultCommands(entries: ProjectDefaultCommands[]): string {
  return JSON.stringify(entries)
}
