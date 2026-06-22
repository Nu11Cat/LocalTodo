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
  updatedAt: '2026-06-16T02:00:00.000Z',
  sensitive: false
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

    expect(context.excludedSensitiveCount).toBe(0)
    expect(context.markdown).toContain('# Tasks Context')
    expect(context.markdown).toContain('## Add AI context')
    expect(context.markdown).toContain('- Status: todo')
    expect(context.markdown).toContain('## Review task')
    expect(context.markdown).toContain('- Status: review')
    expect(context.markdown).toContain('- Priority: high')
    expect(context.markdown).toContain('- Project: LocalTodo')
    expect(context.markdown).toContain('- Repository: G:/Zhao/nu11cat/LocalTodo')
    expect(context.markdown).toContain('- Related files: 2')
    expect(context.markdown).toContain('- Commands: 1')
  })

  it('generates empty-state Markdown for an empty task list', () => {
    expect(generateTasksAiContext([])).toEqual({
      markdown: '# Tasks Context\n\nNo tasks.\n',
      excludedSensitiveCount: 0
    })
  })

  it('generates empty-state Markdown for an empty project context', () => {
    expect(generateProjectAiContext([])).toEqual({
      markdown: '# Project Context\n\nNo tasks.\n',
      excludedSensitiveCount: 0
    })
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

    expect(context.excludedSensitiveCount).toBe(0)
    expect(context.markdown).toContain('<!-- LocalTodo project AI context -->')
    expect(context.markdown).toContain('<!-- Generated: 2026-06-16T03:00:00.000Z -->')
    expect(context.markdown).toContain('<!-- Tasks: 3 | Projects: 2 | Active: 2 | Done: 1 -->')
    expect(context.markdown).toContain('## LocalTodo')
    expect(context.markdown).toContain('- Repository: G:/Zhao/nu11cat/LocalTodo')
    expect(context.markdown).toContain('### Doing\n\n## Implement filters')
    expect(context.markdown).toContain('### Blocked\n\nNone')
    expect(context.markdown).toContain('### Review\n\n## Review context')
    expect(context.markdown).toContain('- `npm test`')
    expect(context.markdown).toContain('- `npm run typecheck`')
    expect(context.markdown).toContain('- src/renderer/src/App.vue')
    expect(context.markdown).toContain('- src/renderer/src/domain/aiContext.ts')
    expect(context.markdown).toContain('## (No project)')
    expect(context.markdown).toContain('- Repository: —')
    expect(context.markdown).toContain('### Done\n\n## Unscoped chore')

    vi.useRealTimers()
  })

  it('excludes sensitive tasks from bulk context by default', () => {
    const context = generateTasksAiContext([
      baseTask,
      {
        ...baseTask,
        id: 'task-2',
        title: 'Sensitive launch plan',
        description: 'Do not export this description.',
        relatedFiles: ['secret/file.ts'],
        commands: ['print-secret'],
        sensitive: true
      }
    ])

    expect(context.excludedSensitiveCount).toBe(1)
    expect(context.markdown).toContain('## Add AI context')
    expect(context.markdown).not.toContain('Sensitive launch plan')
    expect(context.markdown).not.toContain('secret/file.ts')
    expect(context.markdown).not.toContain('print-secret')
  })

  it('can include sensitive tasks when explicitly requested', () => {
    const context = generateProjectAiContext(
      [
        baseTask,
        {
          ...baseTask,
          id: 'task-2',
          title: 'Sensitive project task',
          sensitive: true
        }
      ],
      { includeSensitive: true }
    )

    expect(context.excludedSensitiveCount).toBe(0)
    expect(context.markdown).toContain('## Sensitive project task')
    expect(context.markdown).not.toContain('Excluded sensitive tasks')
  })
})
