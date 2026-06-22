import type {
  ExportLocalTodoProjectPayload,
  ExportLocalTodoProjectResult,
  ExportProjectAiContextPayload,
  ExportProjectAiContextResult,
  LoadDataResult,
  OpenExportedAiContextResult,
  Platform,
  RevealExportedAiContextResult,
  SaveDataResult
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
      loadData: () => Promise<LoadDataResult>
      saveData: (payload: string) => Promise<SaveDataResult>
    }
  }
}

export {}
