---
title: Claude Code
tags: [OpenClaw, AI, Tools]
categories: [AI编程与应用]
toc: true

---

Claude Code 是 Anthropic 推出的面向开发者的 AI 编程协作工具


<!-- more -->

这里只讲述CLI（命令行）的方式
桌面版，可在以下地址下载：https://claude.com/download

## **安装与部署**

使用官方脚本安装（推荐）

macOS、Linux、WSL：

curl -fsSL https://claude.ai/install.sh | bash
Windows PowerShell：

irm https://claude.ai/install.ps1 | iex
Windows CMD：

curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
Homebrew:

brew install --cask claude-code
WinGet:

winget install Anthropic.ClaudeCode
安装完成后，验证是否安装成功：

claude --version
如果终端输出了版本号（如 1.x.x），说明安装成功:

2.1.81 (Claude Code)

使用 npm 安装（不推荐）

npm install -g @anthropic-ai/claude-code

海外手机验证码：https://sms.useaiplus.com/

## **API 配置**

第三方工具 CC Switch：https://github.com/farion1231/cc-switch/
https://github.com/farion1231/cc-switch/releases    
参考文章：https://www.runoob.com/ai-agent/cc-switch.html


## **项目结构**
```text
your-project/
├── CLAUDE.md                    ← 团队共享指令，提交到 git
├── CLAUDE.local.md              ← 个人覆盖，被 git 忽略
└── .claude/
    ├── settings.json            ← 权限 + 配置，提交到 git
    ├── settings.local.json      ← 个人权限，被 git 忽略
    ├── commands/                ← 自定义斜杠命令
    │   ├── review.md            →  /project:review
    │   ├── fix-issue.md         →  /project:fix-issue
    │   └── deploy.md            →  /project:deploy
    ├── rules/                   ← 模块化指令文件（全局生效）
    │   ├── code-style.md
    │   ├── testing.md
    │   └── api-conventions.md
    ├── skills/                  ← 自动调用的工作流
    │   ├── security-review/
    │   │   └── SKILL.md
    │   └── deploy/
    │       └── SKILL.md
    └── agents/                  ← 子代理角色定义
        ├── code-reviewer.md
        └── security-auditor.md
```
### **CLAUDE.md**

CLAUDE.md 是 Claude 进入项目时第一个读取的文件

执行初始化命令后生成
```text
/init
```

### **CLAUDE.local.md**

CLAUDE.local.md 是个人专属的覆盖层，叠加在 CLAUDE.md 之上。

CLAUDE.local.md 存放只与你本人相关的偏好或临时指令，不应共享给团队。

### **.claude/settings.json**

settings.json 团队共享的配置文件，控制 Claude 允许或禁止执行哪些操作

### **settings.local.json**

settings.local.json 个人本地权限覆盖，临时放开或收紧某些权限，不影响团队其他成员。

### **.claude/commands/**

自定义斜杠命令

目录下每个 .md 文件自动映射为一条 /project:文件名 命令。

.claude/commands/ 是团队将重复性任务标准化的核心机制。

### **.claude/rules/**

将 CLAUDE.md 中的规则拆分模块化存放，Claude 在整个会话中始终遵守。适合存放长期稳定执行的行为约定，避免 CLAUDE.md 过于臃肿。

### **.claude/skills/**

Skills 是更高级的复合工作流。当 Claude 判断某个任务适合某个 skill 时，会自动读取并执行对应的 SKILL.md，无需手动调用。

每个 skill 是一个子目录，目录内包含 SKILL.md。

### **.claude/agents/**

定义可被主 Claude 实例派遣的专业子代理。在复杂任务中，主代理将子任务委派给对应专家角色，实现多代理协作。子代理在隔离上下文中运行，拥有独立的权限范围。

## **常用命令**

/cost   查看当前会话消耗
/compact    压缩上下文
/reset  重置会话
/docs   索引文档
/review     代码审查


## **常用操作**



## **项目结构**

