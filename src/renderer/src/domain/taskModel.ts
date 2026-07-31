export type BuiltinTaskStatus = 'inbox' | 'todo' | 'doing' | 'blocked' | 'review' | 'done'

export type TaskStatus =
  | BuiltinTaskStatus
  | `custom-active:${string}`
  | `custom-done:${string}`

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type BuiltinTaskType =
  | 'feature'
  | 'bug'
  | 'refactor'
  | 'research'
  | 'chore'
  | 'deploy'
  | 'review'

export type TaskType = BuiltinTaskType | `custom:${string}`

export interface TaskNote {
  id: string
  createdAt: string
  content: string
}

export interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  tags: string[]
  description: string
  projectName?: string
  repoPath?: string
  gitBranch?: string
  githubIssueUrl?: string
  githubPullRequestUrl?: string
  relatedFiles: string[]
  commands: string[]
  notes: TaskNote[]
  dueAt?: string
  createdAt: string
  updatedAt: string
  sensitive: boolean
}

export const taskStatuses: BuiltinTaskStatus[] = ['inbox', 'todo', 'doing', 'blocked', 'review', 'done']

export const taskPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export const taskTypes: BuiltinTaskType[] = [
  'feature',
  'bug',
  'refactor',
  'research',
  'chore',
  'deploy',
  'review'
]

export interface CreateTaskInput {
  title: string
  id?: string
  status?: TaskStatus
  priority?: TaskPriority
  type?: TaskType
  tags?: string[]
  description?: string
  projectName?: string
  repoPath?: string
  gitBranch?: string
  githubIssueUrl?: string
  githubPullRequestUrl?: string
  relatedFiles?: string[]
  commands?: string[]
  notes?: TaskNote[]
  dueAt?: string
  createdAt?: string
  updatedAt?: string
  sensitive?: boolean
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString()
  const projectName = sanitizeOptionalTaskString(input.projectName)
  const repoPath = sanitizeOptionalTaskString(input.repoPath)
  const gitBranch = sanitizeOptionalTaskString(input.gitBranch, 255)
  const githubIssueUrl = sanitizeOptionalTaskString(input.githubIssueUrl, 2000)
  const githubPullRequestUrl = sanitizeOptionalTaskString(input.githubPullRequestUrl, 2000)
  const dueAt = sanitizeTaskDueDate(input.dueAt)
  const task: Task = {
    id: input.id ?? createTaskId(),
    title: input.title,
    status: isTaskStatus(input.status) ? input.status : 'todo',
    priority: input.priority ?? 'medium',
    type: isTaskType(input.type) ? input.type : 'chore',
    tags: sanitizeTaskStringList(input.tags),
    description: input.description ?? '',
    relatedFiles: sanitizeTaskStringList(input.relatedFiles),
    commands: sanitizeTaskStringList(input.commands),
    notes: sanitizeTaskNotes(input.notes),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? input.createdAt ?? now,
    sensitive: input.sensitive === true
  }

  if (projectName) {
    task.projectName = projectName
  }

  if (repoPath) {
    task.repoPath = repoPath
  }

  if (gitBranch) {
    task.gitBranch = gitBranch
  }

  if (githubIssueUrl) {
    task.githubIssueUrl = githubIssueUrl
  }

  if (githubPullRequestUrl) {
    task.githubPullRequestUrl = githubPullRequestUrl
  }

  if (dueAt) {
    task.dueAt = dueAt
  }

  return task
}

export function createTaskId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createTaskNote(content: string): TaskNote {
  return {
    id: createTaskId(),
    createdAt: new Date().toISOString(),
    content: content.trim()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function sanitizeTaskNotes(value: unknown): TaskNote[] {
  if (!Array.isArray(value)) {
    return []
  }

  const notes: TaskNote[] = []

  for (const item of value) {
    if (!isRecord(item) || typeof item.content !== 'string') {
      continue
    }

    const content = item.content.trim()

    if (!content) {
      continue
    }

    const id = typeof item.id === 'string' && item.id.trim() ? item.id : createTaskId()
    const createdAt =
      typeof item.createdAt === 'string' && item.createdAt.trim()
        ? item.createdAt
        : new Date().toISOString()

    notes.push({ id, createdAt, content: content.slice(0, 4000) })

    if (notes.length >= 500) {
      break
    }
  }

  return notes
}

export function sanitizeOptionalTaskString(value: unknown, maxLength = 1000): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return undefined
  }

  return trimmedValue.slice(0, maxLength)
}

export function sanitizeTaskStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const items: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const trimmedItem = item.trim()

    if (!trimmedItem || seen.has(trimmedItem)) {
      continue
    }

    seen.add(trimmedItem)
    items.push(trimmedItem)

    if (items.length >= 200) {
      break
    }
  }

  return items
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    (taskStatuses.includes(value as BuiltinTaskStatus) || parseCustomTaskStatus(value) !== null)
  )
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && taskPriorities.includes(value as TaskPriority)
}

export function isTaskType(value: unknown): value is TaskType {
  return (
    typeof value === 'string' &&
    (taskTypes.includes(value as BuiltinTaskType) || parseCustomTaskType(value) !== null)
  )
}

export function isTaskDone(task: Task): boolean {
  return task.status === 'done' || task.status.startsWith('custom-done:')
}

export function isTaskActive(task: Task): boolean {
  return !isTaskDone(task)
}

export type TaskDueState = 'none' | 'upcoming' | 'today' | 'overdue' | 'completed'

export function sanitizeTaskDueDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined
}

export function currentLocalDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getTaskDueState(task: Task, today = currentLocalDate()): TaskDueState {
  if (!task.dueAt) {
    return 'none'
  }

  if (isTaskDone(task)) {
    return 'completed'
  }

  if (task.dueAt < today) {
    return 'overdue'
  }

  return task.dueAt === today ? 'today' : 'upcoming'
}

export function toggleTaskDone(task: Task): Task {
  return {
    ...task,
    status: isTaskDone(task) ? 'todo' : 'done',
    updatedAt: new Date().toISOString()
  }
}

const customTaskLabelMaxLength = 60

function sanitizeCustomTaskLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const label = value.trim().replace(/\s+/g, ' ').slice(0, customTaskLabelMaxLength)

  if (!label || /[\u0000-\u001f\u007f]/.test(label)) {
    return null
  }

  return label
}

export function createCustomTaskStatus(label: string, completed = false): TaskStatus | null {
  const sanitizedLabel = sanitizeCustomTaskLabel(label)

  if (!sanitizedLabel) {
    return null
  }

  return `${completed ? 'custom-done' : 'custom-active'}:${sanitizedLabel}`
}

export function parseCustomTaskStatus(
  value: string
): { label: string; completed: boolean } | null {
  const match = /^(custom-active|custom-done):(.*)$/.exec(value)

  if (!match) {
    return null
  }

  const label = sanitizeCustomTaskLabel(match[2])

  if (!label || label !== match[2]) {
    return null
  }

  return { label, completed: match[1] === 'custom-done' }
}

export function createCustomTaskType(label: string): TaskType | null {
  const sanitizedLabel = sanitizeCustomTaskLabel(label)

  return sanitizedLabel ? `custom:${sanitizedLabel}` : null
}

export function parseCustomTaskType(value: string): { label: string } | null {
  if (!value.startsWith('custom:')) {
    return null
  }

  const rawLabel = value.slice('custom:'.length)
  const label = sanitizeCustomTaskLabel(rawLabel)

  return label && label === rawLabel ? { label } : null
}

export function collectTaskStatuses(tasks: Task[]): TaskStatus[] {
  const statuses: TaskStatus[] = [...taskStatuses]
  const seen = new Set<TaskStatus>(statuses)

  for (const task of tasks) {
    if (!seen.has(task.status)) {
      seen.add(task.status)
      statuses.push(task.status)
    }
  }

  return statuses
}

export function collectTaskTypes(tasks: Task[]): TaskType[] {
  const types: TaskType[] = [...taskTypes]
  const seen = new Set<TaskType>(types)

  for (const task of tasks) {
    if (!seen.has(task.type)) {
      seen.add(task.type)
      types.push(task.type)
    }
  }

  return types
}
