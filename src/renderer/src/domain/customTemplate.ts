import type { TaskTemplate } from './taskTemplate'
import { taskTemplates } from './taskTemplate'
import {
  createTaskId,
  isTaskPriority,
  isTaskType,
  sanitizeOptionalTaskString,
  sanitizeTaskStringList,
  type Task,
  type TaskPriority,
  type TaskType
} from './taskModel'

// A user-defined task template, saved from an existing task. Mirrors the built-in
// TaskTemplate fields except it carries a free-form `name` and a generated id rather
// than the fixed TaskTemplateId literal union.
export interface CustomTemplate {
  id: string
  name: string
  type?: TaskType
  priority?: TaskPriority
  description: string
  commands: string[]
  tags: string[]
}

// Snapshot an existing task's structural fields (type/priority/description/commands/tags)
// into a named custom template, reusing the same sanitizers as task creation.
export function createCustomTemplateFromTask(name: string, task: Task): CustomTemplate {
  return {
    id: createTaskId(),
    name: name.trim(),
    type: task.type,
    priority: task.priority,
    description: sanitizeOptionalTaskString(task.description, 4000) ?? '',
    commands: sanitizeTaskStringList(task.commands),
    tags: sanitizeTaskStringList(task.tags)
  }
}

// Replace a same-named template (case-insensitive) in place, keeping its id; otherwise append.
export function upsertCustomTemplate(
  templates: CustomTemplate[],
  template: CustomTemplate
): CustomTemplate[] {
  const targetName = template.name.toLowerCase()
  const existingIndex = templates.findIndex((item) => item.name.toLowerCase() === targetName)

  if (existingIndex === -1) {
    return [...templates, template]
  }

  const next = [...templates]
  next[existingIndex] = { ...template, id: templates[existingIndex].id }
  return next
}

export function removeCustomTemplate(templates: CustomTemplate[], id: string): CustomTemplate[] {
  return templates.filter((template) => template.id !== id)
}

// Defensive parse for persisted (and possibly hand-edited) localStorage content.
// Missing or malformed fields fall back to safe values so bad data never throws.
export function parseCustomTemplates(raw: unknown): CustomTemplate[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const templates: CustomTemplate[] = []
  // Built-in ids are reserved: a custom template sharing one would collide in the
  // merged dropdown (built-ins first wins on .find), so it could never be applied
  // and would mis-wire the "Delete template" affordance against a built-in option.
  const seenIds = new Set<string>(taskTemplates.map((template) => template.id))

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!name) {
      continue
    }

    // Regenerate missing, duplicated, or reserved ids so Vue keys stay unique, a
    // delete by id never removes more than one template, and no custom id shadows
    // (or is shadowed by) a built-in template.
    const rawId = typeof record.id === 'string' && record.id ? record.id : ''
    const id = rawId && !seenIds.has(rawId) ? rawId : createTaskId()
    seenIds.add(id)

    const template: CustomTemplate = {
      id,
      name,
      description:
        typeof record.description === 'string'
          ? (sanitizeOptionalTaskString(record.description, 4000) ?? '')
          : '',
      commands: sanitizeTaskStringList(record.commands),
      tags: sanitizeTaskStringList(record.tags)
    }

    if (isTaskType(record.type)) {
      template.type = record.type
    }

    if (isTaskPriority(record.priority)) {
      template.priority = record.priority
    }

    templates.push(template)
  }

  return templates
}

export function serializeCustomTemplates(templates: CustomTemplate[]): string {
  return JSON.stringify(templates)
}

// Adapt a custom template into the built-in TaskTemplate shape so the new-task
// dropdown and buildTaskInputFromTemplate can treat both kinds uniformly.
export function toTaskTemplate(template: CustomTemplate): TaskTemplate {
  return {
    id: template.id,
    label: template.name,
    type: template.type,
    priority: template.priority,
    description: template.description,
    commands: [...template.commands],
    tags: [...template.tags]
  }
}
