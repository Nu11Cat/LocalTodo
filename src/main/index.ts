import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'

type ExportProjectAiContextPayload = {
  markdown?: unknown
  suggestedPath?: unknown
  suggestedFileName?: unknown
}

type ExportProjectAiContextResult =
  | { status: 'written'; filePath: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

type OpenExportedAiContextResult = { status: 'opened' } | { status: 'error'; message: string }
type RevealExportedAiContextResult = { status: 'revealed' } | { status: 'error'; message: string }

type ExportLocalTodoProjectPayload = {
  repoPath?: unknown
  markdown?: unknown
  tasksJson?: unknown
}

type ExportLocalTodoProjectResult =
  | { status: 'written'; dirPath: string; aiContextFilePath: string; tasksJsonFilePath: string }
  | { status: 'error'; message: string }

const exportProjectAiContextChannel = 'aiContext:exportProject'
const openExportedAiContextChannel = 'aiContext:openExportedFile'
const revealExportedAiContextChannel = 'aiContext:revealExportedFile'
const exportLocalTodoProjectChannel = 'localtodo:exportProject'
const exportedPathsByWebContents = new WeakMap<WebContents, Set<string>>()

function sanitizeFileName(value: unknown): string {
  if (typeof value !== 'string') {
    return 'AI_CONTEXT.md'
  }

  const fileName = basename(value).replace(/[<>:"/\\|?*]/g, '').trim()

  return fileName || 'AI_CONTEXT.md'
}

function resolveDefaultExportPath(payload: ExportProjectAiContextPayload): string {
  const fileName = sanitizeFileName(payload.suggestedFileName)

  if (typeof payload.suggestedPath === 'string') {
    const suggestedPath = normalize(payload.suggestedPath)

    if (isAbsolute(suggestedPath)) {
      return suggestedPath
    }
  }

  return join(app.getPath('documents'), fileName)
}

function trackExportedPath(webContents: WebContents, filePath: string): void {
  const paths = exportedPathsByWebContents.get(webContents) ?? new Set<string>()

  paths.add(filePath)
  exportedPathsByWebContents.set(webContents, paths)
  webContents.once('destroyed', () => {
    exportedPathsByWebContents.delete(webContents)
  })
}

function isTrackedExportPath(webContents: WebContents, value: unknown): value is string {
  return typeof value === 'string' && (exportedPathsByWebContents.get(webContents)?.has(value) ?? false)
}

function registerAiContextExportHandler(): void {
  ipcMain.handle(
    exportProjectAiContextChannel,
    async (event, payload: ExportProjectAiContextPayload): Promise<ExportProjectAiContextResult> => {
      if (!payload || typeof payload.markdown !== 'string' || payload.markdown.trim() === '') {
        return { status: 'error', message: 'Project AI context is empty.' }
      }

      try {
        const ownerWindow = BrowserWindow.fromWebContents(event.sender)
        const saveDialogOptions = {
          title: 'Export project AI context',
          defaultPath: resolveDefaultExportPath(payload),
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        }
        const result = ownerWindow
          ? await dialog.showSaveDialog(ownerWindow, saveDialogOptions)
          : await dialog.showSaveDialog(saveDialogOptions)

        if (result.canceled || !result.filePath) {
          return { status: 'cancelled' }
        }

        await mkdir(dirname(result.filePath), { recursive: true })
        await writeFile(result.filePath, payload.markdown, 'utf8')
        trackExportedPath(event.sender, result.filePath)

        return { status: 'written', filePath: result.filePath }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to export project AI context.'
        }
      }
    }
  )
}

function registerExportedFileActionHandlers(): void {
  ipcMain.handle(
    openExportedAiContextChannel,
    async (event, filePath: unknown): Promise<OpenExportedAiContextResult> => {
      if (!isTrackedExportPath(event.sender, filePath)) {
        return { status: 'error', message: 'Path is not a known LocalTodo export.' }
      }

      try {
        const errorMessage = await shell.openPath(filePath)

        if (errorMessage) {
          return { status: 'error', message: errorMessage }
        }

        return { status: 'opened' }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to open exported file.'
        }
      }
    }
  )

  ipcMain.handle(
    revealExportedAiContextChannel,
    (event, filePath: unknown): RevealExportedAiContextResult => {
      if (!isTrackedExportPath(event.sender, filePath)) {
        return { status: 'error', message: 'Path is not a known LocalTodo export.' }
      }

      try {
        shell.showItemInFolder(filePath)
        return { status: 'revealed' }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to reveal exported file.'
        }
      }
    }
  )
}

function registerLocalTodoProjectExportHandler(): void {
  ipcMain.handle(
    exportLocalTodoProjectChannel,
    async (event, payload: ExportLocalTodoProjectPayload): Promise<ExportLocalTodoProjectResult> => {
      if (typeof payload?.repoPath !== 'string' || payload.repoPath.trim() === '') {
        return { status: 'error', message: 'Project repository path is missing.' }
      }

      const repoPath = normalize(payload.repoPath.trim())

      if (!isAbsolute(repoPath)) {
        return { status: 'error', message: 'Project repository path must be absolute.' }
      }

      if (typeof payload.markdown !== 'string' || payload.markdown.trim() === '') {
        return { status: 'error', message: 'Project AI context is empty.' }
      }

      if (typeof payload.tasksJson !== 'string' || payload.tasksJson.trim() === '') {
        return { status: 'error', message: 'Project tasks JSON is empty.' }
      }

      try {
        const dirPath = join(repoPath, '.localtodo')
        const aiContextFilePath = join(dirPath, 'AI_CONTEXT.md')
        const tasksJsonFilePath = join(dirPath, 'tasks.json')

        await mkdir(dirPath, { recursive: true })
        await writeFile(aiContextFilePath, payload.markdown, 'utf8')
        await writeFile(tasksJsonFilePath, payload.tasksJson, 'utf8')
        trackExportedPath(event.sender, aiContextFilePath)
        trackExportedPath(event.sender, tasksJsonFilePath)

        return { status: 'written', dirPath, aiContextFilePath, tasksJsonFilePath }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to export .localtodo project workspace.'
        }
      }
    }
  )
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.nu11cat.localtodo')
  registerAiContextExportHandler()
  registerExportedFileActionHandlers()
  registerLocalTodoProjectExportHandler()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
