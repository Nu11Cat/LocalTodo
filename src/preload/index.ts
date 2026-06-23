import { contextBridge, ipcRenderer } from 'electron'
import type {
  CleanupLocalTodoTaskFilesPayload,
  CleanupLocalTodoTaskFilesResult,
  ExportLocalTodoProjectPayload,
  ExportLocalTodoProjectResult,
  ExportProjectAiContextPayload,
  ExportProjectAiContextResult,
  CreateImportRestorePointResult,
  GetDataFileInfoResult,
  LoadDataResult,
  OpenDataFileResult,
  OpenExportedAiContextResult,
  RevealDataFileResult,
  RevealExportedAiContextResult,
  SaveDataResult,
  SelectDirectoryResult
} from './index.d'

const api = {
  platform: process.platform,
  exportProjectAiContext: (
    payload: ExportProjectAiContextPayload
  ): Promise<ExportProjectAiContextResult> => ipcRenderer.invoke('aiContext:exportProject', payload),
  openExportedAiContextFile: (filePath: string): Promise<OpenExportedAiContextResult> =>
    ipcRenderer.invoke('aiContext:openExportedFile', filePath),
  revealExportedAiContextFile: (filePath: string): Promise<RevealExportedAiContextResult> =>
    ipcRenderer.invoke('aiContext:revealExportedFile', filePath),
  exportLocalTodoProject: (
    payload: ExportLocalTodoProjectPayload
  ): Promise<ExportLocalTodoProjectResult> => ipcRenderer.invoke('localtodo:exportProject', payload),
  cleanupStaleLocalTodoTaskFiles: (
    payload: CleanupLocalTodoTaskFilesPayload
  ): Promise<CleanupLocalTodoTaskFilesResult> =>
    ipcRenderer.invoke('localtodo:cleanupStaleTaskFiles', payload),
  loadData: (): Promise<LoadDataResult> => ipcRenderer.invoke('storage:loadData'),
  saveData: (payload: string): Promise<SaveDataResult> =>
    ipcRenderer.invoke('storage:saveData', payload),
  getDataFileInfo: (): Promise<GetDataFileInfoResult> =>
    ipcRenderer.invoke('storage:getDataFileInfo'),
  revealDataFile: (): Promise<RevealDataFileResult> => ipcRenderer.invoke('storage:revealDataFile'),
  openDataFile: (): Promise<OpenDataFileResult> => ipcRenderer.invoke('storage:openDataFile'),
  createImportRestorePoint: (payload: string): Promise<CreateImportRestorePointResult> =>
    ipcRenderer.invoke('storage:createImportRestorePoint', payload),
  selectDirectory: (): Promise<SelectDirectoryResult> =>
    ipcRenderer.invoke('dialog:selectDirectory')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}
