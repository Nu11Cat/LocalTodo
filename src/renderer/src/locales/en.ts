// English is the source-of-truth dictionary. Every other locale must provide the
// same keys (enforced by the Messages type and a key-parity test). Values may
// contain {placeholder} tokens interpolated by t(), and a "singular|plural" form
// chosen by the numeric `count` param.
export const en = {
  // App shell / hero
  'app.eyebrow': 'Local-first desktop app',
  'app.title': 'LocalTodo',
  'app.intro': 'Keep a lightweight task list on this device.',
  'app.language': 'Language',
  'app.theme': 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',

  // Workspace shell: three-column titlebar / sidebar / statusbar
  'nav.views': 'Views',
  'nav.status': 'Status',
  'nav.projects': 'Projects',
  'nav.savedViews': 'Saved views',
  'nav.collapse': 'Collapse navigation',
  'nav.expand': 'Expand navigation',
  'nav.allTasks': 'All tasks',
  'titlebar.dataActions': 'Data',
  'statusbar.dataFile': 'Data file',
  'statusbar.savedAt': 'Saved {time}',
  'statusbar.tasks': '{active} active · {done} done',

  // New-todo form
  'form.newTodo': 'New todo',
  'form.titlePlaceholder': 'What needs to be done?',
  'form.taskTemplate': 'Task template',
  'form.deleteTemplate': 'Delete template',
  'form.add': 'Add',
  'state.loading': 'Loading saved tasks...',

  // Data actions
  'data.copyProjectContext': 'Copy project context',
  'data.exportProjectContext': 'Export project context',
  'data.exportJson': 'Export JSON',
  'data.importJson': 'Import JSON',
  'data.lastSaved': 'Last saved {time}',
  'data.noDataFile': 'No data file yet — it will be created on your first change.',
  'data.showInFolder': 'Show in folder',
  'data.openFile': 'Open file',
  'data.openAiContext': 'Open AI context',
  'data.openFolder': 'Open folder',

  // Project dashboard
  'project.eyebrow': 'Project dashboard',
  'project.title': 'Projects',
  'project.allProjects': 'All projects',
  'project.noProject': '(No project)',
  'project.active': '{count} active',
  'project.done': '{count} done',
  'project.doing': '{count} doing',
  'project.blocked': '{count} blocked',
  'project.review': '{count} review',
  'project.setRepoPath': 'Set repo path',
  'project.setDefaultCommands': 'Set default commands',
  'project.editDefaultCommands': 'Edit default commands',
  'project.copyContext': 'Copy context',
  'project.exportContext': 'Export context',
  'project.exportLocalTodo': 'Export .localtodo/',

  // Filter bar
  'filter.title': 'Find tasks',
  'filter.clear': 'Clear filters',
  'filter.search': 'Search tasks',
  'filter.searchPlaceholder': 'Search title, description, or tags',
  'filter.quickViews': 'Quick views',
  'filter.savedViews': 'Saved views',
  'filter.deleteSavedView': 'Delete saved view {name}',
  'filter.savedViewName': 'Saved view name',
  'filter.nameThisView': 'Name this view',
  'filter.saveView': 'Save view',
  'filter.sort': 'Sort',
  'filter.sortBy': 'Sort tasks by',
  'filter.sortAscending': 'Sort ascending',
  'filter.sortDescending': 'Sort descending',
  'filter.asc': 'Asc',
  'filter.desc': 'Desc',
  'filter.status': 'Status',
  'filter.priority': 'Priority',
  'filter.type': 'Type',
  'filter.tags': 'Tags',
  'filter.matchAny': 'Match any',
  'filter.matchAll': 'Match all',

  // Sort option labels
  'sort.manual': 'Manual',
  'sort.updatedAt': 'Updated',
  'sort.createdAt': 'Created',
  'sort.priority': 'Priority',

  // Quick view labels
  'quickView.recent': 'Recently updated',
  'quickView.blocked': 'Blocked',
  'quickView.unassigned': 'No project',

  // Active / completed panels
  'panel.active': 'Active',
  'panel.completed': 'Completed',
  'panel.project': 'Project: {name}',
  'panel.shown': '{shown} of {total} shown',
  'panel.open': '{count} open',
  'panel.copyActiveContext': 'Copy active context',
  'panel.clearCompleted': 'Clear completed',
  'panel.noActiveMatch': 'No active tasks match the current filters.',
  'panel.noActive': 'No active todos. Add one above.',
  'panel.noCompletedMatch': 'No completed tasks match the current filters.',
  'panel.noCompleted': 'Completed todos will appear here.',

  // Todo item
  'todo.sensitive': 'Sensitive',
  'todo.edit': 'Edit',
  'todo.copyAiContext': 'Copy AI Context',
  'todo.remove': 'Remove',

  // Task detail panel
  'detail.title': 'Task details',
  'detail.empty':
    'Select a task to edit status, priority, type, tags, project context, and Markdown notes.',
  'detail.copyAiContext': 'Copy AI Context',
  'detail.saveAsTemplate': 'Save as template',
  'detail.close': 'Close',
  'detail.status': 'Status',
  'detail.priority': 'Priority',
  'detail.type': 'Type',
  'detail.sensitiveTask': 'Sensitive task',
  'detail.sensitiveHint': 'Sensitive tasks are excluded from AI Context exports by default.',
  'detail.project': 'Project',
  'detail.projectPlaceholder': 'Project name',
  'detail.repoPath': 'Repository path',
  'detail.repoPathPlaceholder': 'G:/path/to/repo',
  'detail.browse': 'Browse…',
  'detail.repoPathWarning': 'Repository path should be an absolute path (e.g. G:/path/to/repo).',
  'detail.useRepoPath': 'Use {path}',
  'detail.tags': 'Tags',
  'detail.taskTags': 'Task tags',
  'detail.noTags': 'No tags yet.',
  'detail.addTags': 'Add tags, separated by commas',
  'detail.relatedFiles': 'Related files',
  'detail.noRelatedFiles': 'No related files yet.',
  'detail.addRelatedFiles': 'Add file paths, separated by commas',
  'detail.commands': 'Commands',
  'detail.noCommands': 'No commands yet.',
  'detail.addCommands': 'Add commands, separated by commas',
  'detail.description': 'Description',
  'detail.descriptionPlaceholder':
    'Write Markdown notes, context, acceptance criteria, or logs. Ctrl/Cmd+Enter saves.',
  'detail.activityLog': 'Activity log',
  'detail.noActivity': 'No activity yet.',
  'detail.notePlaceholder':
    "Add a progress note: what you did, why it's blocked, next step. Ctrl/Cmd+Enter adds.",
  'detail.addNote': 'Add note',

  // Status labels
  'status.inbox': 'Inbox',
  'status.todo': 'Todo',
  'status.doing': 'Doing',
  'status.blocked': 'Blocked',
  'status.review': 'Review',
  'status.done': 'Done',

  // Priority labels
  'priority.low': 'Low',
  'priority.medium': 'Medium',
  'priority.high': 'High',
  'priority.urgent': 'Urgent',

  // Type labels
  'type.feature': 'Feature',
  'type.bug': 'Bug',
  'type.refactor': 'Refactor',
  'type.research': 'Research',
  'type.chore': 'Chore',
  'type.deploy': 'Deploy',
  'type.review': 'Review',

  // Built-in template labels
  'template.blank': 'Blank',
  'template.bug': 'Bug',
  'template.feature': 'Feature',
  'template.refactor': 'Refactor',
  'template.release': 'Release',

  // Action messages
  'msg.projectNotFound': 'Project was not found.',
  'msg.showInFolderFailed': 'Show in folder failed: {message}',
  'msg.openDataFileFailed': 'Open data file failed: {message}',
  'msg.importFailed': 'Import failed: {message}',
  'msg.importCancelled': 'Import cancelled.',
  'msg.importing': 'Creating restore point and importing JSON...',
  'msg.imported':
    'Imported {imported}. Replaced {previous}. Restore point saved to {path}.',
  'msg.importFailedBeforeOverwrite': 'Import failed before overwrite: {message}',
  'msg.savedView': 'Saved view "{name}".',
  'msg.copiedTaskContext': 'Copied task AI context.',
  'msg.sensitiveNotCopied': 'Sensitive task context was not copied.',
  'msg.copiedActiveContext': 'Copied active AI context.{excluded}',
  'msg.copiedProjectContext': 'Copied project AI context.{excluded}',
  'msg.setRepoPath': 'Set repo path for {count}.',
  'msg.savedDefaultCommands': 'Saved {count} for "{name}".',
  'msg.clearedDefaultCommands': 'Cleared default commands for "{name}".',
  'msg.savedTemplate': 'Saved template "{name}".',
  'msg.deletedTemplate': 'Deleted template "{name}".',
  'msg.exportingContext': 'Exporting project context...',
  'msg.savedTo': 'Saved to {path}.{excluded}',
  'msg.exportCancelled': 'Export cancelled.',
  'msg.exportFailed': 'Export failed: {message}',
  'msg.exportingLocalTodo': 'Exporting .localtodo workspace...',
  'msg.savedLocalTodo':
    'Saved .localtodo workspace to {dir} ({count}).{excluded}{gitignore}',
  'msg.openFailed': 'Open failed: {message}',
  'msg.revealFailed': 'Reveal failed: {message}',
  'msg.excludedSensitive': ' Excluded {count} by default.',
  'msg.gitignoreUpdated': ' Updated .gitignore with LocalTodo generated-file entries.',
  'msg.gitignoreAlready': ' Recommended .gitignore entries are already present.',
  'msg.gitignoreError': ' Export succeeded, but .gitignore was not updated: {message}',
  'msg.gitignoreReminder': ' Reminder: add {entries} to .gitignore if these should stay local.',
  'msg.keptStale': ' Kept {count}.',
  'msg.deletedStale': ' Deleted {count}.',
  'msg.deleteStaleFailed': ' Failed to delete stale task files: {message}',

  // Renderer-owned error/status messages surfaced through useTodos results.
  'err.dataUnreadable': 'Saved data could not be read. Your existing data file was left unchanged.',
  'err.revealNotSupported': 'Revealing the data file is not supported here.',
  'err.openNotSupported': 'Opening the data file is not supported here.',
  'err.exportNotAvailable': 'Project AI context export is not available.',
  'err.localTodoExportNotAvailable': '.localtodo project export is not available.',
  'err.readJsonFailed': 'Failed to read selected JSON file.',
  'err.projectNotFound': 'Project was not found.',
  'err.noRepoPath': 'Project does not have a repository path.',
  'err.cleanupNotAvailable': 'Stale task file cleanup is not available.',
  'err.openExportNotAvailable': 'Open exported AI context is not available.',
  'err.revealExportNotAvailable': 'Reveal exported AI context is not available.',
  'err.stillLoading': 'Saved data is still loading.',
  'err.invalidImport': 'Selected file is not a valid LocalTodo JSON export.',
  'err.restorePointNotAvailable': 'Import restore point creation is not available.',

  // Confirms / prompts
  'confirm.importJson':
    'Import JSON will replace your current {current} with {import} from the selected file.\n\nLocalTodo will first create a restore point of your current tasks. Continue?',
  'confirm.deleteSavedView': 'Delete saved view "{name}"?',
  'confirm.includeSensitive':
    '{count} would be excluded by default. Include sensitive tasks for this action?',
  'confirm.setRepoPath': 'Set repo path for {count} in "{name}"?',
  'confirm.copySensitive': 'This task is marked sensitive. Copy its AI Context anyway?',
  'confirm.writeGitignore':
    'LocalTodo exports generated task files into this repository. Add recommended .gitignore entries so they stay local? Choose Cancel to export without changing .gitignore.',
  'confirm.cleanupStale':
    'LocalTodo found {count} in .localtodo/tasks/ that no longer match this project:\n\n{files}\n\nDelete these files? Choose Cancel to keep them.',
  'confirm.deleteTemplate': 'Delete template "{name}"?',
  'prompt.defaultCommands':
    'Default commands for "{name}", separated by commas. Leave blank to clear. These prefill future tasks bound to this project that have no commands yet.',
  'prompt.templateName': 'Template name?',

  // Pluralized count fragments (used to fill {count}/{current}/etc. placeholders)
  'count.task': '{n} task|{n} tasks',
  'count.sensitiveTask': '{n} sensitive task|{n} sensitive tasks',
  'count.defaultCommand': '{n} default command|{n} default commands',
  'count.staleTaskFile': '{n} stale task file|{n} stale task files',
  'count.taskFile': '{n} task file|{n} task files'
}

export type MessageKey = keyof typeof en
