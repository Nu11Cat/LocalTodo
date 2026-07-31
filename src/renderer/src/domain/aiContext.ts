import {
  isTaskActive,
  isTaskDone,
  parseCustomTaskStatus,
  parseCustomTaskType,
  type Task
} from './taskModel'

interface ProjectTaskGroup {
  projectName?: string
  repoPath?: string
  tasks: Task[]
}

export interface AiContextOptions {
  includeSensitive?: boolean
}

export interface AiContextGenerationResult {
  markdown: string
  excludedSensitiveCount: number
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return 'None'
  }

  return items.map((item) => `- ${item}`).join('\n')
}

function formatCommandList(commands: string[]): string {
  if (commands.length === 0) {
    return 'None'
  }

  return commands.map((command) => `- \`${command}\``).join('\n')
}

function dedupeItems(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const key = item.toLowerCase()

    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result
}

export function filterSensitiveTasks(
  tasks: Task[],
  options: AiContextOptions = {}
): { tasks: Task[]; excludedSensitiveCount: number } {
  if (options.includeSensitive === true) {
    return { tasks, excludedSensitiveCount: 0 }
  }

  const visibleTasks = tasks.filter((task) => !task.sensitive)

  return {
    tasks: visibleTasks,
    excludedSensitiveCount: tasks.length - visibleTasks.length
  }
}

function formatTaskSummary(task: Task): string {
  const status = parseCustomTaskStatus(task.status)?.label ?? task.status
  const taskType = parseCustomTaskType(task.type)?.label ?? task.type
  const lines = [
    `## ${task.title}`,
    '',
    `- Status: ${status}`,
    `- Priority: ${task.priority}`,
    `- Type: ${taskType}`
  ]

  if (task.projectName) {
    lines.push(`- Project: ${task.projectName}`)
  }

  if (task.repoPath) {
    lines.push(`- Repository: ${task.repoPath}`)
  }

  if (task.gitBranch) {
    lines.push(`- Branch: ${task.gitBranch}`)
  }

  if (task.githubIssueUrl) {
    lines.push(`- GitHub issue: ${task.githubIssueUrl}`)
  }

  if (task.githubPullRequestUrl) {
    lines.push(`- GitHub pull request: ${task.githubPullRequestUrl}`)
  }

  lines.push(
    `- Related files: ${task.relatedFiles.length}`,
    `- Commands: ${task.commands.length}`,
    `- Notes: ${task.notes.length}`,
    `- Created: ${task.createdAt}`,
    `- Updated: ${task.updatedAt}`
  )

  return lines.join('\n')
}

function groupTasksByProject(tasks: Task[]): ProjectTaskGroup[] {
  const groupsByKey = new Map<string, ProjectTaskGroup>()

  for (const task of tasks) {
    const key = `${task.projectName ?? ''}\n${task.repoPath ?? ''}`
    const group = groupsByKey.get(key)

    if (group) {
      group.tasks.push(task)
    } else {
      groupsByKey.set(key, {
        projectName: task.projectName,
        repoPath: task.repoPath,
        tasks: [task]
      })
    }
  }

  return [...groupsByKey.values()].sort((first, second) => {
    const activeDelta = second.tasks.filter(isTaskActive).length - first.tasks.filter(isTaskActive).length

    if (activeDelta !== 0) {
      return activeDelta
    }

    return (first.projectName ?? first.repoPath ?? '').localeCompare(
      second.projectName ?? second.repoPath ?? ''
    )
  })
}

function formatStatusBucket(title: string, tasks: Task[]): string[] {
  return [`### ${title}`, '', tasks.length === 0 ? 'None' : tasks.map(formatTaskSummary).join('\n\n')]
}

function formatProjectGroup(group: ProjectTaskGroup): string[] {
  const activeCount = group.tasks.filter(isTaskActive).length
  const doneCount = group.tasks.filter(isTaskDone).length
  const doingTasks = group.tasks.filter((task) => task.status === 'doing')
  const blockedTasks = group.tasks.filter((task) => task.status === 'blocked')
  const reviewTasks = group.tasks.filter((task) => task.status === 'review')
  const todoTasks = group.tasks.filter(
    (task) =>
      isTaskActive(task) &&
      task.status !== 'doing' &&
      task.status !== 'blocked' &&
      task.status !== 'review'
  )
  const doneTasks = group.tasks.filter(isTaskDone)
  const files = dedupeItems(group.tasks.flatMap((task) => task.relatedFiles))
  const commands = dedupeItems(group.tasks.flatMap((task) => task.commands))

  return [
    `## ${group.projectName ?? '(No project)'}`,
    '',
    `- Repository: ${group.repoPath ?? '—'}`,
    `- Active: ${activeCount} | Done: ${doneCount} | Total: ${group.tasks.length}`,
    '',
    ...formatStatusBucket('Doing', doingTasks),
    '',
    ...formatStatusBucket('Blocked', blockedTasks),
    '',
    ...formatStatusBucket('Review', reviewTasks),
    '',
    ...formatStatusBucket('Todo / Inbox', todoTasks),
    '',
    ...formatStatusBucket('Done', doneTasks),
    '',
    '### Commands',
    '',
    formatCommandList(commands),
    '',
    '### Files',
    '',
    formatList(files)
  ]
}

export function generateTaskAiContext(task: Task): string {
  const status = parseCustomTaskStatus(task.status)?.label ?? task.status
  const taskType = parseCustomTaskType(task.type)?.label ?? task.type
  const sections = [
    '# Task Context',
    '',
    '## Task',
    '',
    task.title,
    '',
    '## Status',
    '',
    status,
    '',
    '## Priority',
    '',
    task.priority,
    '',
    '## Type',
    '',
    taskType,
    '',
    '## Tags',
    '',
    formatList(task.tags)
  ]

  if (task.projectName) {
    sections.push('', '## Project', '', task.projectName)
  }

  if (task.repoPath) {
    sections.push('', '## Repository', '', task.repoPath)
  }

  if (task.gitBranch) {
    sections.push('', '## Git Branch', '', task.gitBranch)
  }

  if (task.githubIssueUrl) {
    sections.push('', '## GitHub Issue', '', task.githubIssueUrl)
  }

  if (task.githubPullRequestUrl) {
    sections.push('', '## GitHub Pull Request', '', task.githubPullRequestUrl)
  }

  sections.push(
    '',
    '## Related Files',
    '',
    formatList(task.relatedFiles),
    '',
    '## Commands',
    '',
    formatCommandList(task.commands)
  )

  if (task.description.trim()) {
    sections.push('', '## Description', '', task.description.trim())
  }

  if (task.notes.length > 0) {
    sections.push('', '## Activity Log')

    for (const note of task.notes) {
      sections.push('', `### ${note.createdAt}`, '', note.content)
    }
  }

  sections.push('', '## Timestamps', '', `- Created: ${task.createdAt}`, `- Updated: ${task.updatedAt}`)

  return `${sections.join('\n')}\n`
}

export function generateTasksAiContext(
  tasks: Task[],
  options: AiContextOptions = {}
): AiContextGenerationResult {
  const filtered = filterSensitiveTasks(tasks, options)

  if (filtered.tasks.length === 0) {
    return {
      markdown: '# Tasks Context\n\nNo tasks.\n',
      excludedSensitiveCount: filtered.excludedSensitiveCount
    }
  }

  return {
    markdown: ['# Tasks Context', '', ...filtered.tasks.flatMap((task) => [formatTaskSummary(task), ''])].join('\n'),
    excludedSensitiveCount: filtered.excludedSensitiveCount
  }
}

export function generateProjectAiContext(
  tasks: Task[],
  options: AiContextOptions = {}
): AiContextGenerationResult {
  const filtered = filterSensitiveTasks(tasks, options)

  if (filtered.tasks.length === 0) {
    return {
      markdown: '# Project Context\n\nNo tasks.\n',
      excludedSensitiveCount: filtered.excludedSensitiveCount
    }
  }

  const groups = groupTasksByProject(filtered.tasks)
  const sections = [
    '<!-- LocalTodo project AI context -->',
    `<!-- Generated: ${new Date().toISOString()} -->`,
    `<!-- Tasks: ${filtered.tasks.length} | Projects: ${groups.length} | Active: ${filtered.tasks.filter(isTaskActive).length} | Done: ${filtered.tasks.filter(isTaskDone).length} -->`
  ]

  if (filtered.excludedSensitiveCount > 0) {
    sections.push(`<!-- Excluded sensitive tasks: ${filtered.excludedSensitiveCount} -->`)
  }

  sections.push('', '# Project Context', '', ...groups.flatMap((group) => [...formatProjectGroup(group), '']))

  return {
    markdown: `${sections.join('\n').trimEnd()}\n`,
    excludedSensitiveCount: filtered.excludedSensitiveCount
  }
}
