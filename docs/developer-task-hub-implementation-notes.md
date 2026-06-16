# 开发者任务中枢实现备注

这份文档补充 `developer-task-hub-vision.md` 中偏落地的实现判断，用于指导后续拆任务和技术选型。

## 推荐落地顺序

不要直接从当前 `localStorage` Todo 跳到 SQLite、MCP 或自动命令执行。更稳妥的路径是先验证任务模型和 AI Context 体验。

### Step 1：扩展任务模型，但继续使用 localStorage

目标：低风险验证核心字段和 UI 交互。

建议变更：

- 将 `completed: boolean` 迁移为 `status`。
- 增加 `priority`、`type`、`tags`、`description`。
- 增加旧数据迁移函数。
- 先不引入文件系统写入。

这样可以避免同时修改数据模型、持久化层和 Electron bridge。

### Step 2：增加 Copy AI Context

目标：最快体现产品差异化。

建议先做纯前端生成：

- 单任务 AI Context。
- 当前进行中任务汇总。
- 当前 blocked/review 任务汇总。
- 使用 Clipboard API 复制 Markdown。

这个阶段不需要外部 AI 写回，也不需要 `.localtodo/` 文件。

### Step 3：增加 JSON 导入/导出

目标：建立可迁移、可备份的数据格式。

建议：

- 导出 `schemaVersion`。
- 导入前校验结构。
- 导入时支持预览或确认。
- 保留旧数据，避免导入失败造成数据丢失。

### Step 4：通过 main/preload 接入文件持久化

目标：从浏览器式存储迁移到桌面应用存储。

建议：

- main 负责文件读写。
- preload 暴露小而明确的方法。
- renderer 不直接访问 Node API。
- 写文件使用原子写策略：先写临时文件，再 rename。
- 保存失败时向 UI 返回可理解错误。

可能的 bridge：

```ts
window.localTodo.storage.loadData()
window.localTodo.storage.saveData(data)
window.localTodo.storage.exportJson(data)
window.localTodo.aiContext.copyTask(taskId)
window.localTodo.aiContext.exportProject(projectId)
```

### Step 5：项目绑定和 `.localtodo/` 导出

目标：让 Claude Code、Cursor 等项目内 AI 工具自然读取上下文。

建议：

- 先支持手动选择项目目录或填写 `repoPath`。
- 为绑定项目生成 `.localtodo/AI_CONTEXT.md`。
- 为任务生成 `.localtodo/tasks/task_<id>.md`。
- 默认提示用户将个人任务数据加入 `.gitignore`。

## 不建议过早做的能力

以下能力方向正确，但不适合 MVP 早期：

- SQLite：在查询、事件日志和任务规模确实变复杂后再引入。
- MCP Server：等数据模型和命令语义稳定后再暴露给外部工具。
- 本地 HTTP API：有安全和端口管理成本，晚于 CLI/MCP 评估。
- 自动执行命令：涉及权限、安全、终端输出、失败恢复和用户确认。
- AI 删除任务：破坏性太强，应排在 append-note/status update 之后。

## 技术拆分建议

为了让功能可测试，建议逐步把业务逻辑从 Vue composable 中拆出来：

```text
src/renderer/src/domain/
  taskModel.ts
  taskMigration.ts
  aiContext.ts
  taskFilters.ts
```

这些模块应尽量是纯函数，不依赖 Vue、Electron 或 DOM。

Vue composable 负责状态组合，Electron main/preload 负责系统能力，domain 模块负责业务规则。

## 验收重点

每个阶段都应该有明确验收：

- 旧 todo 数据不会丢。
- AI Context 输出内容稳定、可读、可复制。
- JSON 导入导出可以 round-trip。
- Renderer 没有引入 Node API。
- 文件写入失败时不会破坏已有数据。
- 敏感任务默认不会进入 AI Context 导出。
