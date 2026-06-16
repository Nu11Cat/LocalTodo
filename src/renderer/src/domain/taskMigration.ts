import {
  createTask,
  isTaskPriority,
  isTaskStatus,
  isTaskType,
  type Task
} from './taskModel'

interface LegacyTodo {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLegacyTodo(value: unknown): value is LegacyTodo {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.completed === 'boolean' &&
    typeof value.createdAt === 'string'
  )
}

function migrateLegacyTodo(todo: LegacyTodo): Task {
  return createTask({
    id: todo.id,
    title: todo.title,
    status: todo.completed ? 'done' : 'todo',
    createdAt: todo.createdAt,
    updatedAt: todo.createdAt
  })
}

function normalizeTask(value: unknown): Task | null {
  if (!isRecord(value)) {
    return null
  }

  if (isLegacyTodo(value)) {
    return migrateLegacyTodo(value)
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !isTaskStatus(value.status) ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return createTask({
    id: value.id,
    title: value.title,
    status: value.status,
    priority: isTaskPriority(value.priority) ? value.priority : 'medium',
    type: isTaskType(value.type) ? value.type : 'chore',
    tags: Array.isArray(value.tags) ? value.tags.filter((tag) => typeof tag === 'string') : [],
    description: typeof value.description === 'string' ? value.description : '',
    projectName: typeof value.projectName === 'string' ? value.projectName : undefined,
    repoPath: typeof value.repoPath === 'string' ? value.repoPath : undefined,
    relatedFiles: Array.isArray(value.relatedFiles)
      ? value.relatedFiles.filter((file) => typeof file === 'string')
      : [],
    commands: Array.isArray(value.commands)
      ? value.commands.filter((command) => typeof command === 'string')
      : [],
    createdAt: value.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : value.createdAt
  })
}

export function migrateStoredTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(normalizeTask).filter((task): task is Task => task !== null)
}
