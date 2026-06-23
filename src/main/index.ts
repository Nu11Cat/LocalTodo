import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
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

type SelectDirectoryResult =
  | { status: 'selected'; dirPath: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

type LoadDataResult =
  | { status: 'ok'; data: string }
  | { status: 'missing' }
  | { status: 'error'; message: string }

type SaveDataResult = { status: 'saved' } | { status: 'error'; message: string }

type CreateImportRestorePointResult =
  | { status: 'written'; filePath: string }
  | { status: 'error'; message: string }

type SaveDataJob = {
  payload: string
  resolve: (value: SaveDataResult) => void
}

type LocalTodoTaskMarkdownFile = {
  id: string
  markdown: string
}

type LocalTodoGitignoreResult =
  | { status: 'not-requested'; filePath: string; entries: string[] }
  | { status: 'already-configured'; filePath: string; entries: string[] }
  | { status: 'updated'; filePath: string; entries: string[] }
  | { status: 'error'; filePath: string; entries: string[]; message: string }

type ExportLocalTodoProjectPayload = {
  repoPath?: unknown
  markdown?: unknown
  tasksJson?: unknown
  taskMarkdownFiles?: unknown
  writeGitignore?: unknown
}

type ExportLocalTodoProjectResult =
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

type CleanupLocalTodoTaskFilesPayload = {
  repoPath?: unknown
  fileNames?: unknown
}

type CleanupLocalTodoTaskFilesResult =
  | { status: 'deleted'; deletedFileNames: string[] }
  | { status: 'error'; message: string }

const exportProjectAiContextChannel = 'aiContext:exportProject'
const openExportedAiContextChannel = 'aiContext:openExportedFile'
const revealExportedAiContextChannel = 'aiContext:revealExportedFile'
const exportLocalTodoProjectChannel = 'localtodo:exportProject'
const cleanupLocalTodoTaskFilesChannel = 'localtodo:cleanupStaleTaskFiles'
const loadDataChannel = 'storage:loadData'
const saveDataChannel = 'storage:saveData'
const createImportRestorePointChannel = 'storage:createImportRestorePoint'
const selectDirectoryChannel = 'dialog:selectDirectory'
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

function registerDialogHandlers(): void {
  ipcMain.handle(selectDirectoryChannel, async (event): Promise<SelectDirectoryResult> => {
    try {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender)
      const openDialogOptions = {
        title: 'Select project directory',
        properties: ['openDirectory' as const]
      }
      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, openDialogOptions)
        : await dialog.showOpenDialog(openDialogOptions)

      if (result.canceled || result.filePaths.length === 0) {
        return { status: 'cancelled' }
      }

      return { status: 'selected', dirPath: result.filePaths[0] }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to select directory.'
      }
    }
  })
}

const localTodoGitignoreEntries = [
  '.localtodo/tasks.json',
  '.localtodo/AI_CONTEXT.md',
  '.localtodo/tasks/'
]

function createTaskMarkdownFileName(taskId: string): string | null {
  const safeId = taskId
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()

  if (!safeId || safeId === '.' || safeId === '..') {
    return null
  }

  return `task_${safeId}.md`
}

const localTodoTaskFileNamePattern = /^task_.+\.md$/i

function isLocalTodoTaskFileName(fileName: string): boolean {
  return basename(fileName) === fileName && localTodoTaskFileNamePattern.test(fileName)
}

function selectStaleTaskFileNames(existingFileNames: string[], keepFileNames: string[]): string[] {
  const keepKeys = new Set(keepFileNames.map((name) => name.toLowerCase()))

  return existingFileNames.filter(
    (name) => isLocalTodoTaskFileName(name) && !keepKeys.has(name.toLowerCase())
  )
}

function normalizeTaskMarkdownFiles(value: unknown):
  | { status: 'ok'; files: Array<LocalTodoTaskMarkdownFile & { fileName: string }> }
  | { status: 'error'; message: string } {
  if (!Array.isArray(value)) {
    return { status: 'error', message: 'Project task Markdown files are missing.' }
  }

  const fileNames = new Set<string>()
  const files: Array<LocalTodoTaskMarkdownFile & { fileName: string }> = []

  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.trim() === '') {
      return { status: 'error', message: 'Project task Markdown file id is missing.' }
    }

    if (typeof item.markdown !== 'string' || item.markdown.trim() === '') {
      return { status: 'error', message: 'Project task Markdown file content is missing.' }
    }

    const fileName = createTaskMarkdownFileName(item.id)

    if (!fileName) {
      return { status: 'error', message: 'Project task Markdown file id is not valid.' }
    }

    const fileNameKey = fileName.toLowerCase()

    if (fileNames.has(fileNameKey)) {
      return { status: 'error', message: 'Project task Markdown file names would collide.' }
    }

    fileNames.add(fileNameKey)
    files.push({ id: item.id, markdown: item.markdown, fileName })
  }

  return { status: 'ok', files }
}

async function updateLocalTodoGitignore(
  repoPath: string,
  shouldWrite: boolean
): Promise<LocalTodoGitignoreResult> {
  const filePath = join(repoPath, '.gitignore')
  const entries = [...localTodoGitignoreEntries]

  if (!shouldWrite) {
    return { status: 'not-requested', filePath, entries }
  }

  try {
    let content = ''

    try {
      content = await readFile(filePath, 'utf8')
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }

    const existingLines = new Set(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
    const missingEntries = entries.filter((entry) => !existingLines.has(entry))

    if (missingEntries.length === 0) {
      return { status: 'already-configured', filePath, entries }
    }

    const section = ['# LocalTodo generated workspace files', ...missingEntries].join('\n')
    const separator = content.trim().length === 0 ? '' : content.endsWith('\n') ? '\n' : '\n\n'

    await writeFile(filePath, `${content}${separator}${section}\n`, 'utf8')

    return { status: 'updated', filePath, entries }
  } catch (error) {
    return {
      status: 'error',
      filePath,
      entries,
      message: error instanceof Error ? error.message : 'Failed to update .gitignore.'
    }
  }
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

      const taskMarkdownFiles = normalizeTaskMarkdownFiles(payload.taskMarkdownFiles)

      if (taskMarkdownFiles.status === 'error') {
        return { status: 'error', message: taskMarkdownFiles.message }
      }

      try {
        const dirPath = join(repoPath, '.localtodo')
        const tasksDirPath = join(dirPath, 'tasks')
        const aiContextFilePath = join(dirPath, 'AI_CONTEXT.md')
        const tasksJsonFilePath = join(dirPath, 'tasks.json')
        const taskFilePaths = taskMarkdownFiles.files.map((file) => join(tasksDirPath, file.fileName))

        await mkdir(tasksDirPath, { recursive: true })
        await writeFile(aiContextFilePath, payload.markdown, 'utf8')
        await writeFile(tasksJsonFilePath, payload.tasksJson, 'utf8')

        for (const [index, file] of taskMarkdownFiles.files.entries()) {
          await writeFile(taskFilePaths[index], file.markdown, 'utf8')
          trackExportedPath(event.sender, taskFilePaths[index])
        }

        const gitignore = await updateLocalTodoGitignore(repoPath, payload.writeGitignore === true)

        trackExportedPath(event.sender, aiContextFilePath)
        trackExportedPath(event.sender, tasksJsonFilePath)

        const staleTaskFiles = await collectStaleTaskFiles(
          tasksDirPath,
          taskMarkdownFiles.files.map((file) => file.fileName)
        )

        return {
          status: 'written',
          dirPath,
          aiContextFilePath,
          tasksJsonFilePath,
          taskFilePaths,
          staleTaskFiles,
          gitignore
        }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to export .localtodo project workspace.'
        }
      }
    }
  )
}

async function collectStaleTaskFiles(
  tasksDirPath: string,
  keepFileNames: string[]
): Promise<string[]> {
  try {
    const existing = await readdir(tasksDirPath)

    return selectStaleTaskFileNames(existing, keepFileNames)
  } catch {
    return []
  }
}

function registerLocalTodoCleanupHandler(): void {
  ipcMain.handle(
    cleanupLocalTodoTaskFilesChannel,
    async (
      _event,
      payload: CleanupLocalTodoTaskFilesPayload
    ): Promise<CleanupLocalTodoTaskFilesResult> => {
      if (typeof payload?.repoPath !== 'string' || payload.repoPath.trim() === '') {
        return { status: 'error', message: 'Project repository path is missing.' }
      }

      const repoPath = normalize(payload.repoPath.trim())

      if (!isAbsolute(repoPath)) {
        return { status: 'error', message: 'Project repository path must be absolute.' }
      }

      if (!Array.isArray(payload.fileNames)) {
        return { status: 'error', message: 'Stale task file names are missing.' }
      }

      const fileNames: string[] = []

      for (const fileName of payload.fileNames) {
        if (typeof fileName !== 'string' || !isLocalTodoTaskFileName(fileName)) {
          return { status: 'error', message: 'Stale task file name is not valid.' }
        }

        fileNames.push(fileName)
      }

      try {
        const tasksDirPath = join(repoPath, '.localtodo', 'tasks')
        const deletedFileNames: string[] = []

        for (const fileName of fileNames) {
          try {
            await unlink(join(tasksDirPath, fileName))
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              continue
            }

            throw error
          }

          deletedFileNames.push(fileName)
        }

        return { status: 'deleted', deletedFileNames }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to delete stale task files.'
        }
      }
    }
  )
}

const dataFileName = 'data.json'
const dataFileTempName = 'data.json.tmp'
const importRestorePointsDirName = 'restore-points'
const maxDataFileBytes = 5 * 1024 * 1024
let saveDataQueue: SaveDataJob[] = []
let isSavingData = false

function resolveDataFilePaths(): { dataDir: string; dataFilePath: string; tempFilePath: string } {
  const dataDir = app.getPath('userData')

  return {
    dataDir,
    dataFilePath: join(dataDir, dataFileName),
    tempFilePath: join(dataDir, dataFileTempName)
  }
}

function createImportRestorePointFileName(): string {
  return `localtodo-before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
}

function resolveImportRestorePointPath(): { dirPath: string; filePath: string } {
  const dirPath = join(app.getPath('userData'), importRestorePointsDirName)

  return {
    dirPath,
    filePath: join(dirPath, createImportRestorePointFileName())
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidDataFileText(payload: string): boolean {
  try {
    const data = JSON.parse(payload)

    return (
      isRecord(data) &&
      data.schemaVersion === 1 &&
      typeof data.exportedAt === 'string' &&
      Array.isArray(data.tasks)
    )
  } catch {
    return false
  }
}

async function writeDataFile(payload: string): Promise<SaveDataResult> {
  if (Buffer.byteLength(payload, 'utf8') > maxDataFileBytes) {
    return { status: 'error', message: 'Save payload is too large.' }
  }

  if (!isValidDataFileText(payload)) {
    return { status: 'error', message: 'Save payload is not a valid LocalTodo data file.' }
  }

  const { dataDir, dataFilePath, tempFilePath } = resolveDataFilePaths()

  try {
    await mkdir(dataDir, { recursive: true })
    await writeFile(tempFilePath, payload, 'utf8')
    await rename(tempFilePath, dataFilePath)

    return { status: 'saved' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to save data.'
    }
  }
}

function processSaveDataQueue(): void {
  if (isSavingData) {
    return
  }

  const job = saveDataQueue.shift()

  if (!job) {
    return
  }

  isSavingData = true
  void writeDataFile(job.payload).then((result) => {
    job.resolve(result)
    isSavingData = false
    processSaveDataQueue()
  })
}

function enqueueSaveData(payload: string): Promise<SaveDataResult> {
  return new Promise((resolve) => {
    saveDataQueue.push({ payload, resolve })
    processSaveDataQueue()
  })
}

async function writeImportRestorePoint(payload: string): Promise<CreateImportRestorePointResult> {
  if (Buffer.byteLength(payload, 'utf8') > maxDataFileBytes) {
    return { status: 'error', message: 'Restore point payload is too large.' }
  }

  if (!isValidDataFileText(payload)) {
    return { status: 'error', message: 'Restore point payload is not a valid LocalTodo data file.' }
  }

  const { dirPath, filePath } = resolveImportRestorePointPath()

  try {
    await mkdir(dirPath, { recursive: true })
    await writeFile(filePath, payload, 'utf8')

    return { status: 'written', filePath }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create import restore point.'
    }
  }
}

function registerStorageHandlers(): void {
  ipcMain.handle(loadDataChannel, async (): Promise<LoadDataResult> => {
    const { dataFilePath } = resolveDataFilePaths()

    try {
      const fileStats = await stat(dataFilePath)

      if (fileStats.size > maxDataFileBytes) {
        return { status: 'error', message: 'Saved data file is too large.' }
      }

      const data = await readFile(dataFilePath, 'utf8')

      return { status: 'ok', data }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { status: 'missing' }
      }

      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load data.'
      }
    }
  })

  ipcMain.handle(saveDataChannel, async (_event, payload: unknown): Promise<SaveDataResult> => {
    if (typeof payload !== 'string') {
      return { status: 'error', message: 'Save payload must be a string.' }
    }

    return enqueueSaveData(payload)
  })

  ipcMain.handle(
    createImportRestorePointChannel,
    async (_event, payload: unknown): Promise<CreateImportRestorePointResult> => {
      if (typeof payload !== 'string') {
        return { status: 'error', message: 'Restore point payload must be a string.' }
      }

      return writeImportRestorePoint(payload)
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
  registerStorageHandlers()
  registerAiContextExportHandler()
  registerExportedFileActionHandlers()
  registerLocalTodoProjectExportHandler()
  registerLocalTodoCleanupHandler()
  registerDialogHandlers()

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
