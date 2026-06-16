import { contextBridge, ipcRenderer } from 'electron'
import type {
  ExportProjectAiContextPayload,
  ExportProjectAiContextResult,
  OpenExportedAiContextResult,
  RevealExportedAiContextResult
} from './index.d'

const api = {
  platform: process.platform,
  exportProjectAiContext: (
    payload: ExportProjectAiContextPayload
  ): Promise<ExportProjectAiContextResult> => ipcRenderer.invoke('aiContext:exportProject', payload),
  openExportedAiContextFile: (filePath: string): Promise<OpenExportedAiContextResult> =>
    ipcRenderer.invoke('aiContext:openExportedFile', filePath),
  revealExportedAiContextFile: (filePath: string): Promise<RevealExportedAiContextResult> =>
    ipcRenderer.invoke('aiContext:revealExportedFile', filePath)
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
