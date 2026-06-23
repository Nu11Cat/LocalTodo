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

export type SelectDirectoryResult =
  | { status: 'selected'; dirPath: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export type LoadDataResult =
  | { status: 'ok'; data: string }
  | { status: 'missing' }
  | { status: 'error'; message: string }

export type SaveDataResult = { status: 'saved' } | { status: 'error'; message: string }

export type GetDataFileInfoResult =
  | { status: 'ok'; filePath: string; exists: true; size: number; modifiedAtMs: number }
  | { status: 'ok'; filePath: string; exists: false }
  | { status: 'error'; message: string }

export type RevealDataFileResult = { status: 'revealed' } | { status: 'error'; message: string }

export type OpenDataFileResult = { status: 'opened' } | { status: 'error'; message: string }

export type CreateImportRestorePointResult =
  | { status: 'written'; filePath: string }
  | { status: 'error'; message: string }

export interface LocalTodoTaskMarkdownFile {
  id: string
  markdown: string
}

export type LocalTodoGitignoreResult =
  | { status: 'not-requested'; filePath: string; entries: string[] }
  | { status: 'already-configured'; filePath: string; entries: string[] }
  | { status: 'updated'; filePath: string; entries: string[] }
  | { status: 'error'; filePath: string; entries: string[]; message: string }

export interface ExportLocalTodoProjectPayload {
  repoPath: string
  markdown: string
  tasksJson: string
  taskMarkdownFiles: LocalTodoTaskMarkdownFile[]
  writeGitignore?: boolean
}

export type ExportLocalTodoProjectResult =
  | {
      status: 'written'
      dirPath: string
      aiContextFilePath: string
      tasksJsonFilePath: string
      taskFilePaths: string[]
      staleTaskFiles: string[]
      gitignore: LocalTodoGitignoreResult
    }
  | { status: 'error'; message: string }

export interface CleanupLocalTodoTaskFilesPayload {
  repoPath: string
  fileNames: string[]
}

export type CleanupLocalTodoTaskFilesResult =
  | { status: 'deleted'; deletedFileNames: string[] }
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
      cleanupStaleLocalTodoTaskFiles: (
        payload: CleanupLocalTodoTaskFilesPayload
      ) => Promise<CleanupLocalTodoTaskFilesResult>
      loadData: () => Promise<LoadDataResult>
      saveData: (payload: string) => Promise<SaveDataResult>
      getDataFileInfo: () => Promise<GetDataFileInfoResult>
      revealDataFile: () => Promise<RevealDataFileResult>
      openDataFile: () => Promise<OpenDataFileResult>
      createImportRestorePoint: (payload: string) => Promise<CreateImportRestorePointResult>
      selectDirectory: () => Promise<SelectDirectoryResult>
    }
  }
}
