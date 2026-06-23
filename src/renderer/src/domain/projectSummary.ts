import { isTaskActive, isTaskDone, type Task } from './taskModel'

export interface ProjectSummary {
  key: string
  label: string
  projectName?: string
  repoPath?: string
  tasks: Task[]
  total: number
  active: number
  done: number
  inbox: number
  todo: number
  doing: number
  blocked: number
  review: number
}

interface ProjectSummaryDraft {
  key: string
  projectName?: string
  repoPath?: string
  tasks: Task[]
}

export function getProjectKey(task: Task): string {
  return `${task.projectName ?? ''}\n${task.repoPath ?? ''}`
}

// Composite key produced by getProjectKey for tasks with neither projectName nor repoPath.
export const unassignedProjectKey = '\n'

function createProjectLabel(projectName?: string, repoPath?: string): string {
  return projectName ?? repoPath ?? '(No project)'
}

function createProjectSummary(draft: ProjectSummaryDraft): ProjectSummary {
  return {
    ...draft,
    label: createProjectLabel(draft.projectName, draft.repoPath),
    total: draft.tasks.length,
    active: draft.tasks.filter(isTaskActive).length,
    done: draft.tasks.filter(isTaskDone).length,
    inbox: draft.tasks.filter((task) => task.status === 'inbox').length,
    todo: draft.tasks.filter((task) => task.status === 'todo').length,
    doing: draft.tasks.filter((task) => task.status === 'doing').length,
    blocked: draft.tasks.filter((task) => task.status === 'blocked').length,
    review: draft.tasks.filter((task) => task.status === 'review').length
  }
}

export function summarizeProjects(tasks: Task[]): ProjectSummary[] {
  const draftsByKey = new Map<string, ProjectSummaryDraft>()

  for (const task of tasks) {
    const key = getProjectKey(task)
    const draft = draftsByKey.get(key)

    if (draft) {
      draft.tasks.push(task)
    } else {
      draftsByKey.set(key, {
        key,
        projectName: task.projectName,
        repoPath: task.repoPath,
        tasks: [task]
      })
    }
  }

  return [...draftsByKey.values()]
    .map(createProjectSummary)
    .sort((first, second) => {
      const activeDelta = second.active - first.active

      if (activeDelta !== 0) {
        return activeDelta
      }

      return first.label.localeCompare(second.label)
    })
}

export function findProjectSummary(summaries: ProjectSummary[], key: string | null): ProjectSummary | null {
  if (key === null) {
    return null
  }

  return summaries.find((summary) => summary.key === key) ?? null
}
