# 配合 Claude Code 使用 LocalTodo

本文讲 **LocalTodo 与 Claude Code（以及 Cursor 等项目内 AI 工具）的实际协作流程**：怎么把 LocalTodo 里的任务变成 AI 能读懂的项目上下文。

> 如果你想了解 LocalTodo 的完整功能，请先看[用户使用说明](user-guide.md)；如果你想了解 Claude Code 本身的安装与项目结构，见 [Claude code.md](Claude%20code.md)。

## 它解决什么

开发时让 AI 理解「现在要做什么」往往要手动复述任务背景、验收标准和验证命令。LocalTodo 把这些信息结构化地存在每个任务里，并能一键导出成 Markdown 上下文，省去重复描述，也让 AI 拿到的是稳定、完整的任务信息。

下面三种方式从轻到重，按场景选用。

## 方式一：单任务粘贴（最轻量）

适合和 AI 讨论**某一个具体任务**时。

1. 在任务列表中点击 **Copy AI Context**，复制该任务的 Markdown 上下文。
2. 在 Claude Code 对话里直接粘贴。

AI 会拿到这个任务的标题、类型、描述、相关文件、验证命令，以及（如果有）按时间正序排列的进展记录（Activity Log），从而理解任务目标与历史，而不只是一句标题。详见用户指南的[复制单个任务上下文](user-guide.md#复制单个任务上下文)。

## 方式二：活跃 / 项目上下文（给 AI 当前全貌）

适合让 AI 先了解**当前整体工作**再展开。

- **Copy active context**：复制当前所有活跃（未完成）任务的整体上下文。
- **Copy project context**（顶部按钮）：复制全部任务的项目级上下文。
- **Copy context**（项目面板卡片内）：复制该项目分组的上下文。

把它粘进 Claude Code，可以让 AI 在动手前掌握当前还有哪些工作、各自处于什么状态。详见用户指南的 [AI Context 使用方式](user-guide.md#ai-context-使用方式)。

## 方式三：`.localtodo/` 工作区（推荐用于项目内协作）

适合 Claude Code **直接在你的代码仓库里工作**的场景——不必每次粘贴，AI 可以直接读仓库内的上下文文件。

1. 给项目任务填写一致的项目名称和仓库路径。
2. 在项目面板对应项目卡片中点击 **Export .localtodo/**（项目分组存在且只存在一个仓库路径时该按钮才会出现），会在对应仓库下生成：

   ```text
   .localtodo/
     AI_CONTEXT.md      项目级 AI 上下文
     tasks.json         该项目任务的结构化 JSON
     tasks/
       task_<id>.md     每个任务对应的 Markdown 上下文
   ```

3. Claude Code 在该仓库工作时即可读取这些文件，理解项目任务背景。

导出后如果有过期的 `task_<id>.md`（删除任务、改了项目名等导致），应用会列出并询问是否清理，默认不静默删除。完整说明见用户指南的 [`.localtodo/` 工作区导出](user-guide.md#localtodo-工作区导出)。

## 敏感任务边界

标记为敏感的任务**默认不会**写入任何 AI Context 复制或 `.localtodo/` 导出。只有你在本次操作中明确选择包含敏感任务时才会写入，应用还会要求确认。

> 如果任务包含个人计划、内部信息或敏感上下文，不要把 `.localtodo/` 生成文件提交到公开仓库。详见用户指南的[敏感任务](user-guide.md#敏感任务)。

## `.gitignore` 建议

导出 `.localtodo/` 时应用会询问是否把生成文件加入项目 `.gitignore`。推荐忽略：

```gitignore
.localtodo/tasks.json
.localtodo/AI_CONTEXT.md
.localtodo/tasks/
```

这样既能让本地 AI 工具读取上下文，又不会把任务信息提交进版本库。

## 一个推荐的协作循环

1. 在 LocalTodo 为要做的工作建任务，补好项目名称、仓库路径、相关文件和验证命令。
2. 单个任务讨论时用 **Copy AI Context** 粘给 Claude Code。
3. 需要让 AI 在仓库内长期协作时，导出 `.localtodo/` 工作区。
4. 任务推进时在 Activity Log 追加进展，让下次的上下文带上历史。
5. 阶段性用 **Export JSON** 备份。

---

相关文档：[用户使用说明](user-guide.md) · [项目 README](../README.md)
