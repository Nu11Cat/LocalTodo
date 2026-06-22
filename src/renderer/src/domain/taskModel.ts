export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'blocked' | 'review' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskType = 'feature' | 'bug' | 'refactor' | 'research' | 'chore' | 'deploy' | 'review'

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
  relatedFiles: string[]
  commands: string[]
  createdAt: string
  updatedAt: string
  sensitive: boolean
}

export const taskStatuses: TaskStatus[] = ['inbox', 'todo', 'doing', 'blocked', 'review', 'done']

export const taskPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export const taskTypes: TaskType[] = [
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
  relatedFiles?: string[]
  commands?: string[]
  createdAt?: string
  updatedAt?: string
  sensitive?: boolean
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString()
  const projectName = sanitizeOptionalTaskString(input.projectName)
  const repoPath = sanitizeOptionalTaskString(input.repoPath)
  const task: Task = {
    id: input.id ?? createTaskId(),
    title: input.title,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    type: input.type ?? 'chore',
    tags: sanitizeTaskStringList(input.tags),
    description: input.description ?? '',
    relatedFiles: sanitizeTaskStringList(input.relatedFiles),
    commands: sanitizeTaskStringList(input.commands),
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

  return task
}

export function createTaskId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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
  return typeof value === 'string' && taskStatuses.includes(value as TaskStatus)
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && taskPriorities.includes(value as TaskPriority)
}

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && taskTypes.includes(value as TaskType)
}

export function isTaskDone(task: Task): boolean {
  return task.status === 'done'
}

export function isTaskActive(task: Task): boolean {
  return !isTaskDone(task)
}

export function toggleTaskDone(task: Task): Task {
  return {
    ...task,
    status: isTaskDone(task) ? 'todo' : 'done',
    updatedAt: new Date().toISOString()
  }
}
