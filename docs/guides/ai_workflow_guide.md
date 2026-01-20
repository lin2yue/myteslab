# AI 协作与进度追溯指南

这是一个关于如何让 AI Agent (如 Cursor, Windsurf, Copilot 等) 高效协作并在多次会话间保持进度的指南。

## 核心原则：文档即记忆

AI 没有长期的跨会话记忆。为了防止 AI "失忆"或"胡乱发挥"，我们必须将**项目状态**和**决策历史**显性化地记录在文件中。

## 1. 核心上下文文件：`docs/CONTEXT.md`

我们建立了一个核心文件 `docs/CONTEXT.md`。这是给 AI 看的"登机牌"。

### 包含内容：
- **项目身份**：我们在做什么？
- **当前状态**：MVP 完了吗？正在修 Bug 吗？
- **技术约束**：能用什么库？架构红线是什么？（例如：本项目的 "No Shared Package" 策略）
- **下一步计划**：待办事项清单。

### 使用方法：
- **开始工作前**：提示 AI "请先阅读 `docs/CONTEXT.md` 了解项目背景"。
- **结束工作后**：要求 AI "请根据今天完成的工作，更新 `docs/CONTEXT.md` 中的状态和待办事项"。

## 2. 决策记录 (ADR)

不要让 AI 反复推翻之前的决定。如果做出了重要架构决定（例如：为什么不拆分 packages），请记录在 `docs/architecture/` 下。

- 当 AI 质疑现有架构时，让它阅读 `docs/architecture/monorepo_analysis.md`。

## 3. 任务追踪

使用 `task.md` 或在 `docs/CONTEXT.md` 中维护一个简易的 Roadmap。
- 不要只说 "优化代码"。
- 要说 "优化 model-viewer 加载速度，目标是减少 LCP 200ms"。

## 最佳实践流程 (SOP)

1. **启动会话 (Onboarding)**
   > User: "阅读 `docs/CONTEXT.md`，然后帮我实现 UI 的多语言切换按钮。"

2. **执行任务 (Execution)**
   > AI: (读取文档 -> 了解 UI 库是 Tailwind -> 了解 i18n 是 next-intl -> 编写代码)

3. **结束会话 (Offboarding)**
   > User: "任务完成。请把'添加语言切换器'从 `docs/CONTEXT.md` 的 Pending Tasks 中勾选掉，并更新当前状态。"

通过这种"**读配置 -> 干活 -> 更新配置**"的闭环，任何新的 AI Agent 进来都能无缝接手工作。
