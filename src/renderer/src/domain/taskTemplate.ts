import type { CreateTaskInput, TaskPriority, TaskType } from '@renderer/domain/taskModel'

export type TaskTemplateId = 'blank' | 'bug' | 'feature' | 'refactor' | 'release'

export interface TaskTemplate {
  // Built-in templates use the TaskTemplateId literals; custom templates supply a
  // generated string id, so this is widened to string to cover both.
  id: string
  label: string
  type?: TaskType
  priority?: TaskPriority
  description: string
  commands: string[]
  tags: string[]
}

const bugDescription = `## Steps to reproduce
1.

## Expected
-

## Actual
-

## Impact
-`

const featureDescription = `## Goal
-

## Acceptance criteria
- [ ]

## Notes
-`

const refactorDescription = `## Motivation
-

## Scope
-

## Risks
-

## Regression checks
-`

const releaseDescription = `## Version
-

## Changes
-

## Verification
-

## Rollback
-`

export const taskTemplates: TaskTemplate[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: '',
    commands: [],
    tags: []
  },
  {
    id: 'bug',
    label: 'Bug',
    type: 'bug',
    priority: 'high',
    description: bugDescription,
    commands: ['npm test'],
    tags: ['bug']
  },
  {
    id: 'feature',
    label: 'Feature',
    type: 'feature',
    priority: 'medium',
    description: featureDescription,
    commands: ['npm run typecheck', 'npm test'],
    tags: ['feature']
  },
  {
    id: 'refactor',
    label: 'Refactor',
    type: 'refactor',
    priority: 'medium',
    description: refactorDescription,
    commands: ['npm run typecheck', 'npm test'],
    tags: ['refactor']
  },
  {
    id: 'release',
    label: 'Release',
    type: 'deploy',
    priority: 'high',
    description: releaseDescription,
    commands: ['npm run build'],
    tags: ['release']
  }
]

export function findTaskTemplate(id: string): TaskTemplate | undefined {
  return taskTemplates.find((template) => template.id === id)
}

// True for the built-in five templates (blank/bug/feature/refactor/release).
// Consumers use this to decide whether to translate the label via a locale key
// (built-ins) or render it verbatim (custom templates use user-supplied names).
export function isBuiltinTaskTemplateId(id: string): boolean {
  return taskTemplates.some((template) => template.id === id)
}

export function buildTaskInputFromTemplate(template: TaskTemplate, title: string): CreateTaskInput {
  const input: CreateTaskInput = { title }

  if (template.type) {
    input.type = template.type
  }

  if (template.priority) {
    input.priority = template.priority
  }

  if (template.description) {
    input.description = template.description
  }

  if (template.commands.length > 0) {
    input.commands = [...template.commands]
  }

  if (template.tags.length > 0) {
    input.tags = [...template.tags]
  }

  return input
}
