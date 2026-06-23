import { taskPriorities, type Task } from './taskModel'

export type TaskSortKey = 'manual' | 'updatedAt' | 'createdAt' | 'priority'

export type TaskSortDirection = 'asc' | 'desc'

export interface TaskSortState {
  key: TaskSortKey
  direction: TaskSortDirection
}

export function createDefaultTaskSortState(): TaskSortState {
  return { key: 'manual', direction: 'desc' }
}

function priorityWeight(task: Task): number {
  return taskPriorities.indexOf(task.priority)
}

function compareByKey(first: Task, second: Task, key: Exclude<TaskSortKey, 'manual'>): number {
  if (key === 'priority') {
    return priorityWeight(first) - priorityWeight(second)
  }

  return first[key].localeCompare(second[key])
}

export function sortTasks(tasks: Task[], state: TaskSortState): Task[] {
  if (state.key === 'manual') {
    return tasks
  }

  const key = state.key
  const directionFactor = state.direction === 'asc' ? 1 : -1

  return [...tasks].sort((first, second) => {
    const delta = compareByKey(first, second, key)

    if (delta !== 0) {
      return delta * directionFactor
    }

    // Stable, deterministic tie-break so equal keys keep a fixed order.
    const createdAtDelta = first.createdAt.localeCompare(second.createdAt)

    if (createdAtDelta !== 0) {
      return createdAtDelta * directionFactor
    }

    // Final tie-break on id makes the order total for any input.
    return first.id.localeCompare(second.id) * directionFactor
  })
}
