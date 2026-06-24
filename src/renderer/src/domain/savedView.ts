import { createEmptyTaskFilterState, type TaskFilterState } from './taskFilter'
import { createDefaultTaskSortState, type TaskSortState } from './taskSort'
import { createTaskId, isTaskPriority, isTaskStatus, isTaskType } from './taskModel'

export interface SavedView {
  id: string
  name: string
  filter: TaskFilterState
  sort: TaskSortState
}

function cloneFilterState(filter: TaskFilterState): TaskFilterState {
  return {
    keyword: filter.keyword,
    statuses: [...filter.statuses],
    priorities: [...filter.priorities],
    types: [...filter.types],
    tags: [...filter.tags],
    tagMatchMode: filter.tagMatchMode,
    projects: [...filter.projects]
  }
}

function cloneSortState(sort: TaskSortState): TaskSortState {
  return { key: sort.key, direction: sort.direction }
}

export function createSavedView(
  name: string,
  filter: TaskFilterState,
  sort: TaskSortState
): SavedView {
  return {
    id: createTaskId(),
    name: name.trim(),
    filter: cloneFilterState(filter),
    sort: cloneSortState(sort)
  }
}

// Replace a same-named view (case-insensitive) in place, keeping its id; otherwise append.
export function upsertSavedView(views: SavedView[], view: SavedView): SavedView[] {
  const targetName = view.name.toLowerCase()
  const existingIndex = views.findIndex((item) => item.name.toLowerCase() === targetName)

  if (existingIndex === -1) {
    return [...views, view]
  }

  const next = [...views]
  next[existingIndex] = { ...view, id: views[existingIndex].id }
  return next
}

export function removeSavedView(views: SavedView[], id: string): SavedView[] {
  return views.filter((view) => view.id !== id)
}

function isTagMatchMode(value: unknown): value is TaskFilterState['tagMatchMode'] {
  return value === 'all' || value === 'any'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

// Keep only the entries that are valid task enum members so a malformed persisted
// value (e.g. an old/typo status) can never become an active-but-invisible filter
// that silently hides every task.
function filterValidEnumValues<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(guard)
}

// Defensive parse for persisted (and possibly hand-edited) localStorage content.
// Missing or malformed fields fall back to defaults so bad data never throws.
function parseFilterState(raw: unknown): TaskFilterState {
  const fallback = createEmptyTaskFilterState()

  if (typeof raw !== 'object' || raw === null) {
    return fallback
  }

  const record = raw as Record<string, unknown>

  return {
    keyword: typeof record.keyword === 'string' ? record.keyword : fallback.keyword,
    statuses: filterValidEnumValues(record.statuses, isTaskStatus),
    priorities: filterValidEnumValues(record.priorities, isTaskPriority),
    types: filterValidEnumValues(record.types, isTaskType),
    tags: isStringArray(record.tags) ? record.tags : fallback.tags,
    tagMatchMode: isTagMatchMode(record.tagMatchMode) ? record.tagMatchMode : fallback.tagMatchMode,
    projects: isStringArray(record.projects) ? record.projects : fallback.projects
  }
}

function parseSortState(raw: unknown): TaskSortState {
  const fallback = createDefaultTaskSortState()

  if (typeof raw !== 'object' || raw === null) {
    return fallback
  }

  const record = raw as Record<string, unknown>
  const key =
    record.key === 'manual' ||
    record.key === 'updatedAt' ||
    record.key === 'createdAt' ||
    record.key === 'priority'
      ? record.key
      : fallback.key
  const direction = record.direction === 'asc' || record.direction === 'desc' ? record.direction : fallback.direction

  return { key, direction }
}

export function parseSavedViews(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const views: SavedView[] = []
  const seenIds = new Set<string>()

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!name) {
      continue
    }

    // Regenerate missing or duplicated ids so Vue keys stay unique and a delete
    // by id never removes more than one view.
    const rawId = typeof record.id === 'string' && record.id ? record.id : ''
    const id = rawId && !seenIds.has(rawId) ? rawId : createTaskId()
    seenIds.add(id)

    views.push({
      id,
      name,
      filter: parseFilterState(record.filter),
      sort: parseSortState(record.sort)
    })
  }

  return views
}

export function serializeSavedViews(views: SavedView[]): string {
  return JSON.stringify(views)
}
