export type Platform = NodeJS.Platform

export interface ExportProjectAiContextPayload {
  markdown: string
  suggestedPath?: string
  suggestedFileName?: string
}

export type ExportProjectAiContextResult =
  | { status: 'written'; filePath: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export type OpenExportedAiContextResult = { status: 'opened' } | { status: 'error'; message: string }
export type RevealExportedAiContextResult = { status: 'revealed' } | { status: 'error'; message: string }

export type LoadDataResult =
  | { status: 'ok'; data: string }
  | { status: 'missing' }
  | { status: 'error'; message: string }

export type SaveDataResult = { status: 'saved' } | { status: 'error'; message: string }

export interface ExportLocalTodoProjectPayload {
  repoPath: string
  markdown: string
  tasksJson: string
}

export type ExportLocalTodoProjectResult =
  | { status: 'written'; dirPath: string; aiContextFilePath: string; tasksJsonFilePath: string }
  | { status: 'error'; message: string }

declare global {
  interface Window {
    api: {
      platform: Platform
      exportProjectAiContext: (
        payload: ExportProjectAiContextPayload
      ) => Promise<ExportProjectAiContextResult>
      openExportedAiContextFile: (filePath: string) => Promise<OpenExportedAiContextResult>
      revealExportedAiContextFile: (filePath: string) => Promise<RevealExportedAiContextResult>
      exportLocalTodoProject: (payload: ExportLocalTodoProjectPayload) => Promise<ExportLocalTodoProjectResult>
      loadData: () => Promise<LoadDataResult>
      saveData: (payload: string) => Promise<SaveDataResult>
    }
  }
}
