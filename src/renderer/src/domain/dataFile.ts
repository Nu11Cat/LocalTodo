import type { Task } from './taskModel'
import { migrateStoredTasks } from './taskMigration'

export const localTodoSchemaVersion = 1

export interface LocalTodoDataFile {
  schemaVersion: typeof localTodoSchemaVersion
  exportedAt: string
  tasks: Task[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createDataFile(tasks: Task[]): LocalTodoDataFile {
  return {
    schemaVersion: localTodoSchemaVersion,
    exportedAt: new Date().toISOString(),
    tasks
  }
}

export function serializeDataFile(tasks: Task[]): string {
  return `${JSON.stringify(createDataFile(tasks), null, 2)}\n`
}

export function parseDataFile(value: unknown): Task[] | null {
  if (!isRecord(value) || value.schemaVersion !== localTodoSchemaVersion) {
    return null
  }

  if (!Array.isArray(value.tasks)) {
    return null
  }

  return migrateStoredTasks(value.tasks)
}

export function parseDataFileText(text: string): Task[] | null {
  try {
    return parseDataFile(JSON.parse(text))
  } catch {
    return null
  }
}
