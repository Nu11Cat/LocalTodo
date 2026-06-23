import { getProjectKey } from './projectSummary'
import type { Task, TaskPriority, TaskStatus, TaskType } from './taskModel'

export type TagMatchMode = 'all' | 'any'

export interface TaskFilterState {
  keyword: string
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  types: TaskType[]
  tags: string[]
  tagMatchMode: TagMatchMode
  projects: string[]
}

export function createEmptyTaskFilterState(): TaskFilterState {
  return {
    keyword: '',
    statuses: [],
    priorities: [],
    types: [],
    tags: [],
    tagMatchMode: 'all',
    projects: []
  }
}

export function isTaskFilterStateEmpty(state: TaskFilterState): boolean {
  return (
    state.keyword.trim() === '' &&
    state.statuses.length === 0 &&
    state.priorities.length === 0 &&
    state.types.length === 0 &&
    state.tags.length === 0 &&
    state.projects.length === 0
  )
}

function matchesKeyword(task: Task, keyword: string): boolean {
  const tokens = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) {
    return true
  }

  const searchableText = [
    task.title,
    task.description,
    task.projectName ?? '',
    task.repoPath ?? '',
    ...task.tags,
    ...task.relatedFiles,
    ...task.commands
  ]
    .join(' ')
    .toLowerCase()

  return tokens.every((token) => searchableText.includes(token))
}

function matchesSelectedTags(task: Task, selectedTags: string[], mode: TagMatchMode): boolean {
  if (selectedTags.length === 0) {
    return true
  }

  const taskTags = new Set(task.tags.map((tag) => tag.toLowerCase()))

  if (mode === 'any') {
    return selectedTags.some((tag) => taskTags.has(tag.toLowerCase()))
  }

  return selectedTags.every((tag) => taskTags.has(tag.toLowerCase()))
}

export function matchesTaskFilter(task: Task, state: TaskFilterState): boolean {
  return (
    matchesKeyword(task, state.keyword) &&
    (state.statuses.length === 0 || state.statuses.includes(task.status)) &&
    (state.priorities.length === 0 || state.priorities.includes(task.priority)) &&
    (state.types.length === 0 || state.types.includes(task.type)) &&
    matchesSelectedTags(task, state.tags, state.tagMatchMode) &&
    (state.projects.length === 0 || state.projects.includes(getProjectKey(task)))
  )
}

export function filterTasks(tasks: Task[], state: TaskFilterState): Task[] {
  if (isTaskFilterStateEmpty(state)) {
    return tasks
  }

  return tasks.filter((task) => matchesTaskFilter(task, state))
}
