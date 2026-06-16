import { describe, expect, it, vi } from 'vitest'
import { generateProjectAiContext, generateTaskAiContext, generateTasksAiContext } from './aiContext'
import type { Task } from './taskModel'

const baseTask: Task = {
  id: 'task-1',
  title: 'Add AI context',
  status: 'todo',
  priority: 'medium',
  type: 'chore',
  tags: [],
  description: '',
  relatedFiles: [],
  commands: [],
  createdAt: '2026-06-16T01:00:00.000Z',
  updatedAt: '2026-06-16T02:00:00.000Z'
}

describe('aiContext', () => {
  it('generates Markdown for a single task', () => {
    const context = generateTaskAiContext({
      ...baseTask,
      tags: ['ai', 'local-first'],
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test'],
      description: 'Generate copyable Markdown for AI assistants.'
    })

    expect(context).toBe(`# Task Context

## Task

Add AI context

## Status

todo

## Priority

medium

## Type

chore

## Tags

- ai
- local-first

## Project

LocalTodo

## Repository

G:/Zhao/nu11cat/LocalTodo

## Related Files

- src/renderer/src/App.vue

## Commands

- \`npm test\`

## Description

Generate copyable Markdown for AI assistants.

## Timestamps

- Created: 2026-06-16T01:00:00.000Z
- Updated: 2026-06-16T02:00:00.000Z
`)
  })

  it('omits empty descriptions and formats empty tags', () => {
    const context = generateTaskAiContext(baseTask)

    expect(context).toContain('## Tags\n\nNone')
    expect(context).toContain('## Related Files\n\nNone')
    expect(context).toContain('## Commands\n\nNone')
    expect(context).not.toContain('## Project')
    expect(context).not.toContain('## Repository')
    expect(context).not.toContain('## Description')
  })

  it('generates Markdown for a task list', () => {
    const context = generateTasksAiContext([
      baseTask,
      {
        ...baseTask,
        id: 'task-2',
        title: 'Review task',
        status: 'review',
        priority: 'high',
        projectName: 'LocalTodo',
        repoPath: 'G:/Zhao/nu11cat/LocalTodo',
        relatedFiles: ['src/renderer/src/App.vue', 'src/renderer/src/main.ts'],
        commands: ['npm test']
      }
    ])

    expect(context).toContain('# Tasks Context')
    expect(context).toContain('## Add AI context')
    expect(context).toContain('- Status: todo')
    expect(context).toContain('## Review task')
    expect(context).toContain('- Status: review')
    expect(context).toContain('- Priority: high')
    expect(context).toContain('- Project: LocalTodo')
    expect(context).toContain('- Repository: G:/Zhao/nu11cat/LocalTodo')
    expect(context).toContain('- Related files: 2')
    expect(context).toContain('- Commands: 1')
  })

  it('generates empty-state Markdown for an empty task list', () => {
    expect(generateTasksAiContext([])).toBe('# Tasks Context\n\nNo tasks.\n')
  })

  it('generates empty-state Markdown for an empty project context', () => {
    expect(generateProjectAiContext([])).toBe('# Project Context\n\nNo tasks.\n')
  })

  it('generates project-level Markdown grouped by project and status', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T03:00:00.000Z'))

    const context = generateProjectAiContext([
      {
        ...baseTask,
        id: 'task-1',
        title: 'Implement filters',
        status: 'doing',
        projectName: 'LocalTodo',
        repoPath: 'G:/Zhao/nu11cat/LocalTodo',
        relatedFiles: ['src/renderer/src/App.vue', 'src/renderer/src/App.vue'],
        commands: ['npm test']
      },
      {
        ...baseTask,
        id: 'task-2',
        title: 'Review context',
        status: 'review',
        projectName: 'LocalTodo',
        repoPath: 'G:/Zhao/nu11cat/LocalTodo',
        relatedFiles: ['src/renderer/src/domain/aiContext.ts'],
        commands: ['npm test', 'npm run typecheck']
      },
      {
        ...baseTask,
        id: 'task-3',
        title: 'Unscoped chore',
        status: 'done'
      }
    ])

    expect(context).toContain('<!-- LocalTodo project AI context -->')
    expect(context).toContain('<!-- Generated: 2026-06-16T03:00:00.000Z -->')
    expect(context).toContain('<!-- Tasks: 3 | Projects: 2 | Active: 2 | Done: 1 -->')
    expect(context).toContain('## LocalTodo')
    expect(context).toContain('- Repository: G:/Zhao/nu11cat/LocalTodo')
    expect(context).toContain('### Doing\n\n## Implement filters')
    expect(context).toContain('### Blocked\n\nNone')
    expect(context).toContain('### Review\n\n## Review context')
    expect(context).toContain('- `npm test`')
    expect(context).toContain('- `npm run typecheck`')
    expect(context).toContain('- src/renderer/src/App.vue')
    expect(context).toContain('- src/renderer/src/domain/aiContext.ts')
    expect(context).toContain('## (No project)')
    expect(context).toContain('- Repository: —')
    expect(context).toContain('### Done\n\n## Unscoped chore')

    vi.useRealTimers()
  })
})
