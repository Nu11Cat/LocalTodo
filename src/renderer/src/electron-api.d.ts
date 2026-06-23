import type {
  CleanupLocalTodoTaskFilesPayload,
  CleanupLocalTodoTaskFilesResult,
  CreateImportRestorePointResult,
  ExportLocalTodoProjectPayload,
  ExportLocalTodoProjectResult,
  ExportProjectAiContextPayload,
  ExportProjectAiContextResult,
  LoadDataResult,
  OpenExportedAiContextResult,
  Platform,
  RevealExportedAiContextResult,
  SaveDataResult,
  SelectDirectoryResult
} from '../../preload/index.d'

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
      createImportRestorePoint: (payload: string) => Promise<CreateImportRestorePointResult>
      selectDirectory: () => Promise<SelectDirectoryResult>
    }
  }
}

export {}
