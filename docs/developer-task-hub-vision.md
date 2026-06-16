# LocalTodo 开发者任务中枢愿景

这份文档记录一个产品和技术方向：把 LocalTodo 从一个简单的待办清单，逐步演进成一个高度可定制、符合全栈开发者使用习惯，并且可以被 Claude Code、Cursor 等外部 AI 工具读取任务内容的本地优先任务系统。

## 产品定位

LocalTodo 不应该只是另一个普通 Todo App。对全栈开发者来说，任务通常不是孤立的，它们经常和代码、仓库、命令、Issue、PR、部署步骤、AI 对话上下文绑定在一起。

更合适的定位是：

> 一个本地优先的开发者任务管理工具，用来连接任务、代码上下文、项目命令和 AI 协作状态。

也就是说，它的重点不是简单记录“做完/没做完”，而是服务真实开发工作流。

## 更强的任务模型

普通 todo 数据结构通常只有标题和完成状态，这对开发者工作来说太弱了。更有价值的任务模型可以包含：

```ts
interface Task {
  id: string
  title: string
  status: 'inbox' | 'todo' | 'doing' | 'blocked' | 'review' | 'done' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: 'feature' | 'bug' | 'refactor' | 'research' | 'chore' | 'deploy' | 'review'
  projectId?: string
  repoPath?: string
  branch?: string
  relatedFiles: string[]
  commands: string[]
  tags: string[]
  links: TaskLink[]
  description?: string
  notes?: string
  aiContext?: string
  acceptanceCriteria: string[]
  blockedReason?: string
  sensitive?: boolean
  customFields: Record<string, unknown>
  createdAt: string
  updatedAt: string
  completedAt?: string
  archivedAt?: string
  dueAt?: string
}
```

这样一个任务不仅能表达“要做什么”，还能表达：

- 属于哪个项目。
- 是什么类型的开发任务。
- 相关文件、命令、分支是什么。
- 当前处于什么工作状态。
- AI 助手在协助前应该读取哪些上下文。

## 面向开发者的功能方向

### 项目与仓库绑定

开发者通常会同时处理多个仓库。LocalTodo 应该支持项目或工作区，并允许项目绑定本地仓库路径。

一个项目可以保存：

```json
{
  "name": "LocalTodo",
  "repoPath": "G:/Zhao/nu11cat/LocalTodo",
  "commands": {
    "dev": "npm run dev",
    "test": "npm test",
    "typecheck": "npm run typecheck",
    "build": "npm run build"
  }
}
```

任务可以关联到某个项目，并复用项目里的常用命令。

### 更适合开发的状态流

只有 `completed: true/false` 对开发任务来说太粗糙。一个更实用的默认流程可以是：

```text
Inbox -> Todo -> Doing -> Blocked -> Review -> Done -> Archived
```

也可以支持项目级自定义流程，例如：

```text
Backlog -> Ready -> Coding -> Testing -> Review -> Done
```

其中几个状态尤其重要：

- `Blocked`：记录任务卡在哪里、依赖谁、等待什么。
- `Review`：表示实现可能完成了，但还需要审查或验收。
- `Testing`：表示代码写完了，但验证还没完成。

### 每个任务都应该有开发上下文

任务详情应该支持结构化上下文，方便人和 AI 都能快速理解任务。

可以包含：

- 背景。
- 验收标准。
- 复现步骤。
- 相关文件。
- 相关命令。
- Issue、PR、文档、部署链接。
- AI 上下文摘要。
- 决策记录。

任务描述和备注建议使用 Markdown。开发者可以很自然地写 checklist、代码块、链接、日志和命令片段。

示例：

```md
## 背景

新增一个 `/project:feat` 斜杠命令，用于功能开发流程。

## 验收标准

- `.claude/commands/feat.md` 存在。
- 命令内容描述功能实现流程。
- 命令包含测试和验证建议。

## 相关文件

- `.claude/commands/feat.md`
- `CLAUDE.md`

## 验证

这是文档/命令配置类变更，不需要运行应用。
```

## AI 可读取的数据层

这个工具最重要的差异化之一，应该是外部 AI 工具可以安全、方便地读取任务上下文。

### 第一阶段：JSON 和 Markdown 文件

最简单、最 AI 友好的存储方式是本地文件：

```text
.localtodo/
  tasks.json
  projects.json
  AI_CONTEXT.md
  tasks/
    task-001.md
    task-002.md
```

优点：

- Claude Code、Cursor 和其他工具都很容易读取。
- 方便备份和版本管理。
- 对用户透明。
- 不需要特殊工具也能调试。
- 不依赖本地服务进程。

缺点：

- 并发写入需要小心设计。
- 查询能力不如数据库。
- 后续仍然需要设计 schema 迁移。

这个方案适合作为近期方向，因为它可以最快解决“外部 AI 可读”的问题。

### 第二阶段：SQLite + Markdown 导出

当应用变得更成熟后，SQLite 是很适合作为内部数据存储的选择。它支持更强的查询、筛选、事件日志和长期数据积累。

可能的表包括：

- `tasks`
- `projects`
- `tags`
- `task_tags`
- `task_events`
- `task_links`
- `task_contexts`

即使内部使用 SQLite，也应该继续导出 AI 可读的 Markdown，例如：

```text
.localtodo/AI_CONTEXT.md
.localtodo/tasks/task-001.md
```

这样应用内部可以有强数据模型，外部 AI 仍然能用简单文本读取上下文。

### 第三阶段：CLI、本地 API 或 MCP Server

长期来看，LocalTodo 可以通过以下方式暴露任务数据：

- CLI。
- 本地 HTTP API。
- MCP Server。

示例 CLI：

```bash
localtodo list --status doing
localtodo show task-123
localtodo update task-123 --status done
localtodo note task-123 "已成功运行 npm test 和 npm run typecheck。"
```

示例本地 API：

```http
GET /tasks
GET /tasks/active
GET /tasks/:id
POST /tasks
PATCH /tasks/:id
POST /tasks/:id/notes
```

示例 MCP tools：

- `list_tasks`
- `get_task`
- `create_task`
- `update_task`
- `search_tasks`
- `get_project_context`
- `append_task_note`

推荐演进顺序：

```text
JSON / Markdown 文件 -> CLI -> SQLite -> MCP Server / 本地 API
```

这样可以避免在核心任务模型还没稳定前过早引入复杂架构。

## MVP 边界

愿景可以很大，但第一版不应该试图一次性实现完整项目管理、数据库、CLI、MCP 和 AI 写回。近期 MVP 的目标应该是：让 LocalTodo 从普通待办清单升级为“能保存开发上下文、能生成 AI 可读摘要”的本地任务列表。

MVP 建议包含：

- 任务标题。
- Markdown 描述。
- 状态：`inbox`、`todo`、`doing`、`blocked`、`review`、`done`。
- 优先级：`low`、`medium`、`high`、`urgent`。
- 类型：`feature`、`bug`、`refactor`、`research`、`chore`、`deploy`、`review`。
- 标签。
- 项目名称或项目 ID。
- 相关文件。
- 相关命令。
- 单任务 `Copy AI Context`。
- 当前项目或当前进行中任务的 AI Context 汇总。
- JSON 导入和导出。

MVP 暂不包含：

- SQLite。
- MCP Server。
- 本地 HTTP API。
- GitHub Issue / PR 的深度同步。
- 自动执行任务命令。
- 多设备或多用户同步。
- AI 自动修改任务数据。
- 删除类 AI 写回操作。

这样可以先验证核心体验和数据模型，再决定是否引入更复杂的集成能力。

## 数据存储位置策略

`.localtodo/` 很适合 AI 工具读取，但它不一定应该成为唯一数据源。更稳妥的策略是区分“应用主数据”和“项目上下文导出”。

推荐策略：

1. 应用主数据默认保存在 Electron app data 目录中，例如 `%APPDATA%/LocalTodo/`。
2. 当项目绑定 `repoPath` 后，允许用户为该项目导出仓库内 `.localtodo/` 目录。
3. 仓库内 `.localtodo/` 主要服务 Claude Code、Cursor 等外部工具读取，不应该成为唯一事实来源。
4. `AI_CONTEXT.md` 和 `tasks/*.md` 应视为可重新生成的派生文件。

推荐结构：

```text
# 应用主数据
<appData>/LocalTodo/
  data.json
  backups/

# 某个仓库内的 AI 可读导出
<repo>/.localtodo/
  AI_CONTEXT.md
  tasks.json
  tasks/
    task_<id>.md
```

如果后续希望支持团队共享项目配置，可以再拆分：

```text
.localtodo/
  project.json          # 可选提交，保存团队共享命令、工作流模板
.localtodo.local/
  tasks.json            # 个人任务数据，默认不提交
  AI_CONTEXT.md
```

但 MVP 阶段不需要一开始就支持这两套目录。

## Schema 版本与迁移

任务数据会持续演进，因此所有持久化文件都应该带 schema 版本。迁移策略需要从第一版就建立，避免后续数据不可升级。

示例：

```ts
interface LocalTodoDataFile {
  schemaVersion: 1
  exportedAt: string
  tasks: Task[]
  projects: Project[]
  settings: LocalTodoSettings
}
```

迁移原则：

- 每个数据文件都必须包含 `schemaVersion`。
- 从 `localStorage` 迁移到文件存储时必须保留原任务。
- 缺失字段使用明确默认值补齐。
- 迁移失败时不能删除原始数据。
- 迁移逻辑应尽量写成纯 TypeScript 函数，方便单元测试。
- 后续 schema 升级应该按版本逐步迁移，而不是只支持最新结构。

当前已有的简单 todo 可以迁移为：

```ts
{
  id: oldTodo.id,
  title: oldTodo.title,
  status: oldTodo.completed ? 'done' : 'todo',
  priority: 'medium',
  type: 'chore',
  tags: [],
  relatedFiles: [],
  commands: [],
  createdAt: oldTodo.createdAt,
  updatedAt: oldTodo.createdAt
}
```

## 任务 ID 和文件命名

任务 ID 应该稳定、不可变，并且不依赖标题。标题可以重命名，但 ID 和历史记录不能变化。

建议：

- 使用 `task_<timestamp>_<random>` 或类似格式作为任务 ID。
- Markdown 文件名使用 `task_<id>.md`。
- 不把标题放进主文件名，避免重命名造成路径变化。
- 文件路径只是导出路径，任务 ID 才是主键。

示例：

```text
tasks/
  task_mabc1234_k9x2p.md
```

## 更完整的 Project 模型

`Task` 不应该承担所有项目级配置。项目、仓库、常用命令和工作流应该独立建模。

示例：

```ts
interface Project {
  id: string
  name: string
  repoPath?: string
  defaultBranch?: string
  commands: Record<string, string>
  workflow?: string[]
  createdAt: string
  updatedAt: string
}
```

任务可以引用 `projectId`，并在需要时覆盖 `repoPath`、`branch`、`commands` 等字段。

## AI Context 生成规则

AI Context 应该是确定性生成的 Markdown，而不是随意拼接。它的目标是让外部 AI 工具快速理解当前项目和任务，但不能泄漏不该导出的信息。

全局或项目级 `AI_CONTEXT.md` 默认包含：

- 当前 `doing` 任务。
- 当前 `blocked` 任务及阻塞原因。
- 当前 `review` 任务。
- 最近完成的少量 `done` 任务，例如最近 5 个。
- 当前项目的常用命令。
- 当前项目绑定的仓库路径。
- 用户明确标记为 AI 可读的说明。

默认不包含：

- `archived` 任务。
- 标记为 sensitive/private 的字段。
- 过长日志全文。
- 未经用户确认的密钥、token、cookie、生产环境凭据等内容。

生成文件应包含：

```md
<!-- Generated by LocalTodo. Do not edit manually. -->
<!-- schemaVersion: 1 -->
<!-- generatedAt: 2026-06-16T00:00:00.000Z -->
```

`AI_CONTEXT.md` 应视为派生文件，用户手动修改后可能会在下次生成时被覆盖；真正的数据源仍然是任务数据文件或数据库。

## 安全与隐私原则

开发任务经常包含敏感信息，例如 API key、部署地址、客户信息、私有仓库路径、错误日志和生产命令。因此 AI 友好不等于默认公开所有数据。

基础原则：

- 默认所有数据只保存在本机。
- 不自动上传任何任务内容。
- AI Context 导出前应允许用户预览。
- 支持任务或字段标记为 `sensitive`，默认不进入 `AI_CONTEXT.md`。
- 命令字段在 MVP 阶段只保存和复制，不自动执行。
- 外部 AI 写回默认关闭，必须由用户显式开启。
- AI 写回应从追加备注开始，再逐步支持状态更新、创建任务等能力。
- 删除任务、清空历史、覆盖文件等破坏性操作必须用户确认。
- 文件写入应限制在 app data 目录或用户明确选择的项目目录。
- Renderer 不能直接访问 Node 文件系统 API，所有文件和 OS 集成都必须通过 main/preload 边界完成。

## Git 与 `.localtodo` 版本管理策略

如果 `.localtodo/` 导出到仓库内，需要明确它是否应该被 Git 跟踪。

默认建议：

- 个人任务数据默认不提交。
- `.localtodo/tasks.json`、`.localtodo/AI_CONTEXT.md`、`.localtodo/tasks/*.md` 默认加入 `.gitignore`。
- 团队共享配置可以单独放在 `.localtodo/project.json`，由用户选择是否提交。
- 导出文件里应避免写入机器专属或敏感路径，除非用户明确允许。

示例 `.gitignore`：

```gitignore
.localtodo/tasks.json
.localtodo/AI_CONTEXT.md
.localtodo/tasks/
.localtodo.local/
```

## 测试策略

随着任务模型、文件持久化和 AI Context 生成变复杂，核心逻辑应该尽量从 Vue 组件中拆成纯 TypeScript 模块，方便测试。

建议测试重点：

- 旧 `localStorage` todo 到新任务模型的迁移。
- schema 版本迁移。
- 任务增删改查的纯逻辑。
- 状态、优先级、类型、标签的过滤和搜索。
- AI Context Markdown 生成。
- JSON 导入/导出的 round-trip。
- 文件存储的错误处理和原子写策略。
- preload bridge 的输入校验和错误返回。

AI Context 生成器适合做快照测试；迁移和导入导出适合做单元测试。

## 自定义能力设计

“高度定制化”不应该只停留在换主题颜色，而应该覆盖工作流、字段、视图和快捷操作。

### 自定义任务类型

默认任务类型可以包括：

- Feature
- Bug
- Refactor
- Research
- Chore
- Deploy
- Review

用户应该可以新增自己的类型，例如：

- Prompt
- Experiment
- Learning
- Ops
- Writing
- Client

### 自定义状态流程

用户或项目应该可以定义自己的状态流：

```json
{
  "workflow": ["Inbox", "Todo", "Doing", "Blocked", "Review", "Done"]
}
```

不同项目可能需要不同流程：

- 产品项目：`Backlog -> Design -> Dev -> QA -> Release`。
- 个人项目：`Idea -> Todo -> Doing -> Done`。
- 开源项目：`Issue -> Fixing -> PR -> Merged`。

### 自定义字段

开发者经常需要为任务附加各种元数据。可以用灵活的 custom fields 支持，而不是每次都改核心 schema。

示例：

```json
{
  "customFields": {
    "severity": "high",
    "githubIssue": "https://github.com/example/repo/issues/123",
    "testCommand": "npm test",
    "deployTarget": "staging"
  }
}
```

### 自定义视图

有价值的默认视图包括：

- Inbox。
- Today。
- 当前项目。
- Doing。
- Blocked。
- Review。
- 最近完成。
- 按标签。
- 按优先级。
- AI-ready context。

后续可以支持列表视图和 Kanban 视图切换。

## AI 协作功能

### 一键复制 AI 上下文

每个任务应该提供 `Copy AI Context` 操作，生成适合粘贴给 Claude Code、Cursor 或其他 AI 助手的 Markdown 摘要。

示例输出：

```md
# Task Context

## Task

新增 `/project:feat` 命令，用于功能开发流程。

## Status

Done

## Project

LocalTodo

## Related Files

- `.claude/commands/feat.md`

## Acceptance Criteria

- 可以通过 `/project:feat` 调用。
- 命令描述功能实现流程。

## Notes

用户希望 commands、rules、skills 只有在明确要求时才新增，不要自动沉淀。
```

### 全局 AI Context 文件

应用可以自动维护一个文件：

```text
.localtodo/AI_CONTEXT.md
```

这个文件可以包含：

- 当前进行中的任务。
- 被阻塞的任务。
- 最近完成的任务。
- 项目上下文。
- 常用命令。
- 当前优先级。

外部 AI 工具可以在协助开发前读取这个文件。

### 安全的 AI 写回机制

AI 写入能力应该逐步引入，不能一开始就允许 AI 随意修改所有数据。

比较安全的顺序是：

1. 允许 AI 追加备注。
2. 允许 AI 修改任务状态。
3. 允许 AI 创建任务。
4. 最后才考虑删除任务或其他破坏性操作。

一次 AI 发起的更新可以表示为：

```json
{
  "source": "claude-code",
  "action": "append_note",
  "taskId": "task_123",
  "content": "已运行 npm test 和 npm run typecheck，结果通过。"
}
```

UI 中应该清楚显示来源，例如：

```text
Claude Code 于 2 分钟前追加了备注。
```

### 任务事件日志

应用不应该只保存任务当前状态，还应该保存事件历史。

示例：

```ts
interface TaskEvent {
  id: string
  taskId: string
  type: 'created' | 'status_changed' | 'note_added' | 'file_linked' | 'ai_updated'
  actor: 'user' | 'claude' | 'cursor' | 'system'
  timestamp: string
  payload: Record<string, unknown>
}
```

这样后续可以回答：

- 任务什么时候完成的？
- 谁修改了它？
- Claude 或 Cursor 做过什么更新？
- 任务为什么变成 blocked？

## UI 方向

UI 应该优先考虑开发者效率，而不是只追求装饰性。

一个比较合适的方向是：

> Linear 式任务管理 + VS Code 式命令面板 + Obsidian 式 Markdown 笔记。

建议布局：

```text
+--------------------------------------------------+
| 搜索 / 命令面板                                  |
+------------------+-------------------------------+
| 侧边栏           | 任务列表 / Kanban              |
| - Inbox          |                               |
| - Today          |                               |
| - Projects       |                               |
| - Tags           |                               |
| - AI Context     |                               |
+------------------+-------------------------------+
| 可选详情抽屉 / Markdown 编辑器                   |
+--------------------------------------------------+
```

重要 UI 能力：

- 快速创建任务。
- 键盘优先操作。
- Markdown 任务详情。
- 快速搜索和筛选。
- 项目切换。
- 一键复制 AI 上下文。
- 打开相关仓库或文件。
- 后续可支持运行或复制相关命令。

## 技术架构方向

当前 Electron + Vue 架构适合继续演进，但持久化不应该长期停留在 `localStorage`。

### Renderer

前端架构可以考虑：

- Vue 3 Composition API。
- 状态较小时继续使用 composables；状态复杂后可以引入 Pinia。
- Markdown 编辑和预览。
- 快捷键与命令面板系统。
- 任务数量增加后使用虚拟列表。

### 持久化

推荐演进路径：

```text
localStorage -> 本地 JSON/Markdown 文件 -> SQLite + Markdown 导出
```

`localStorage` 适合早期 demo，但不适合这个产品方向，原因是：

- 外部 AI 工具不方便读取。
- 不方便备份和人工检查。
- 不适合多工具协作。
- 数据迁移不够透明。

### Electron 边界

任何文件系统、数据库或 OS 集成都应该遵守项目已有边界规则：

- Renderer 不直接导入 Node API。
- 文件或数据库操作通过 main/preload 完成。
- Preload 暴露小而明确、面向能力的方法。
- 当多个功能依赖某个长期 bridge 合同时，应该写入文档。

未来 bridge 可以类似：

```ts
window.localTodo.tasks.list()
window.localTodo.tasks.create(input)
window.localTodo.tasks.update(id, patch)
window.localTodo.tasks.exportAiContext()
```

## 建议路线图

### Phase 1：把 Todo 基础做扎实

目标：从 demo 变成真正可用的任务管理器。

- 任务标题和 Markdown 描述。
- 状态。
- 优先级。
- 标签。
- 类型。
- 项目字段。
- 搜索。
- JSON 导入/导出。

### Phase 2：开发者增强

目标：适配全栈开发工作流。

- 项目/仓库绑定。
- 相关文件。
- 相关命令。
- 自定义任务类型。
- 自定义状态流。
- 快捷键。
- 命令面板。
- 列表/Kanban 视图切换。

### Phase 3：AI 友好工作流

目标：让 Claude Code、Cursor 等工具能读取有用的任务上下文。

- `.localtodo/tasks.json`。
- `.localtodo/AI_CONTEXT.md`。
- 每个任务导出 Markdown。
- `Copy AI Context` 操作。
- AI append-note 机制。
- 任务事件日志。

### Phase 4：外部集成

目标：把 LocalTodo 变成开发工作中枢。

- CLI。
- MCP Server。
- 本地 HTTP API。
- GitHub Issue / PR 链接。
- Git 分支关联。
- 从 diff 或 commit 生成任务总结。

## 近期最值得做的功能

当前最值得优先做的功能是：

1. 增加 Markdown 任务描述。
2. 增加状态、优先级、标签和任务类型。
3. 增加 AI Context 复制功能，先不依赖文件写入。
4. 增加 JSON 导入/导出，并引入 `schemaVersion`。
5. 通过 main/preload 将持久化从 `localStorage` 逐步迁移到应用数据目录中的 JSON 文件。
6. 增加项目/仓库绑定。
7. 为绑定仓库导出 `.localtodo/AI_CONTEXT.md` 和任务 Markdown。

这些功能做完后，LocalTodo 会从简单练手 Todo，明显进化成一个有差异化的开发者任务系统雏形。

## 总结

LocalTodo 的潜力不在于成为普通待办清单，而在于成为：

> 一个本地优先、开发者友好、同时适合人类和 AI 助手共享任务上下文的任务中枢。

最关键的设计决策是：任务数据模型、本地持久化格式，以及 AI 可读取的上下文格式。这三件事应该先想清楚，再进行大规模 UI 改造。
