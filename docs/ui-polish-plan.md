# 界面美化计划（UI Polish）

聚焦提升 LocalTodo 的观感与交互质感。当前问题：样式像营销落地页而非生产力工具——超大标题、飘浮大阴影、散落的颜色字面量、无暗色、交互状态缺失。

## 现状盘点

- 全部样式集中在单文件 `src/renderer/src/styles.css`（591 行），三个 `.vue` 组件**零** scoped `<style>`，token 化干净无冲突。
- 颜色全是硬编码字面量：约 28 个唯一颜色（`#172033`/`#2563eb`/`rgba(...)` 等）散落 59 处，无任何 CSS 变量。
- 排版偏"营销"：`h1` 用 `clamp(2.25rem, 8vw, 4.5rem)`，信息密度低。
- 卡片：`border-radius: 24px` + `box-shadow: 0 24px 70px rgba(23,32,51,.12)`，飘、占地大。
- 纯亮色，无暗色模式。
- `:hover`/`:focus-visible`/`:disabled`/过渡基本缺失。

## 约束（沿用本仓库标准）

- 纯 renderer + CSS / localStorage，**不碰 preload/main/IPC/文件系统**。
- 不引入 UI 框架/CSS 库（与现有零依赖、手写样式的风格一致）。
- 主题/语言等用户偏好走 localStorage（仿 `localtodo.locale`、savedView、customTemplate 模式）。
- 提交前按 collaboration-mode 跑 **code-reviewer**；本计划纯前端展示层，可不跑 security-auditor。
- 破坏性/外发操作无关；环境变更（工具链/镜像/全局安装）需先批准。

## 分阶段计划（按性价比与依赖排序）

每个阶段都是独立可验收的小闭环；阶段 1 是后续所有项的地基。

### 阶段 1 — 设计 Token 化（地基，必须先做）

把散落的颜色/圆角/阴影/间距抽成 `:root` 下的 CSS 变量，全文件改为引用变量。**不改变任何视觉效果**，纯重构——这样后续调整与暗色都只动 token。

建议的 token 分组：
- 颜色：`--bg`、`--surface`、`--surface-2`、`--border`、`--border-strong`、`--text`、`--text-muted`、`--text-subtle`、`--accent`、`--accent-hover`、`--accent-ring`、语义色（`--danger`/`--warning`/`--success`、各自的 `-soft` 背景）。
- 形状：`--radius-sm`、`--radius`、`--radius-lg`。
- 阴影：`--shadow-sm`、`--shadow`、`--shadow-lg`。
- 间距（可选）：`--space-1..6` 或沿用现有数值。

验收：`npm run typecheck` clean；`npm run dev` 肉眼对比——视觉应与改动前**完全一致**。

### 阶段 2 — 暗色模式

token 化之后只需加一套 `[data-theme="dark"]` 覆盖变量 + 切换器。
- 主题状态走 localStorage（如 `localtodo.theme`，值 `light|dark|system`），仿 `useLocale` 的单例 + 持久化 + `prefers-color-scheme` 首次自动判定。
- 切换器放在 hero 卡片 `.hero-top`，与语言切换器并列。
- 文案进 i18n 字典（`app.theme` / `theme.light` / `theme.dark` / `theme.system`）。

验收：两套主题切换即时生效、刷新后保持；对比度可读；语言切换器风格协调。

### 阶段 3 — 排版与密度收紧

- `h1` 降到 ~`1.75–2rem`，去掉营销级 `clamp`。
- 收紧卡片 `padding`、`margin-top`、`gap`，提高任务列表信息密度。
- 统一字号阶梯（标题/正文/辅助文字/标签）。

验收：同屏可见更多任务；标题不再喧宾夺主。

### 阶段 4 — 圆角 / 阴影 / 边框统一

- 圆角从 `24px` 收到 `12–16px`（用 token）。
- 阴影更克制（减小模糊与偏移），卡片更"贴"、更像工具。
- 边框/分隔统一走 `--border`。

验收：整体观感从"飘浮卡片"转向"紧凑工具面板"。

### 阶段 5 — 交互状态补齐

- 按钮/输入/下拉的 `:hover`、`:focus-visible`（可见焦点环用 `--accent-ring`）、`:disabled`。
- 列表项 hover 高亮；操作按钮 hover 反馈。
- 统一过渡（`transition: ... 120–160ms ease`），尊重 `prefers-reduced-motion`。

验收：键盘 Tab 有清晰焦点；hover/disabled 有反馈；无突兀闪烁。

### 阶段 6 — 任务项视觉层级

- 优先级/状态用色块或左侧色条快速区分（语义 token），而非纯文字 label。
- 敏感标记更醒目。
- 完成项的弱化样式更统一。

验收：扫视即可分辨优先级与状态；敏感任务一眼可见。

## 执行方式

- 逐阶段实现 + 验收，**先做阶段 1**，验收通过再推进 2–6（顺序可按需调整，但 1 必须最先）。
- 每阶段保持小 commit，便于回滚与审查。
- 阶段 2/6 涉及新文案时同步更新 `en.ts` / `zh.ts`（保持键对齐，`useLocale.test.ts` 的 parity 测试会守住）。

## 不在本计划范围

- 引入第三方 UI/CSS 框架。
- 业务逻辑、数据模型、preload/main/IPC 改动。
- 任务模板"用户自定义模板"功能（见 `docs/` 既有 plan，属功能轮次，非美化）。

## 提交后

- 视情况在 `docs/future-optimizations.md` 或 dev-progress 记录已完成的美化阶段。
