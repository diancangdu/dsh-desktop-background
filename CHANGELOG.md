# Changelog

## v1.0.0 — 2026-09-25

首个正式版本。已在实际的 DSH 桌面端上验证有效。

### 功能

- **背景图**：浅色/深色各一张，按明暗主题自动切换；图**内联为 data URI**，零网络请求。
- **五档透明度，各自独立**：
  - `maskOpacity` —— 压在图上的一层暗纱
  - `surfaceOpacity` —— 其余面板
  - `inputOpacity` —— 输入框（composer 输入框；提问卡、审批卡共用同一 token）
  - `todoOpacity` —— 待办框条（输入框上方的任务进度面板）
  - `optionOpacity` —— 答案选项（提问卡的选项行）
  - 后三档不配置时跟随 `surfaceOpacity`，**与只有两档时行为完全一致**（已用测试钉死为字节相同）。
- **作用范围开关**：`todoScope` / `optionScope` 可选 `precise`（默认，只影响这一处）或
  `broad`（连同共用同一 token 的其它表面）。
- **右下角按钮 + 实时调参卡片**：五个滑块 + 两个范围开关，**改完立即生效、不用重启**；
  值存 `localStorage` 跨重启保留；「复制配置」输出可粘贴进 `cordis.patch.yml` 的片段。

### 实现要点

- 走**结构化 index 注入行**（`style` + `script`），因为 DSH 桌面窗口的 `index.html` 直接读磁盘、
  **不经过 `webServer.tapIndex`** —— 依赖它的主题插件在桌面端会静默失效。
- 精确作用域的做法是把 token **声明在目标元素本身**（`[data-testid="todo-panel"]`、
  `[data-question-key]`），于是只有该元素及其子树看得到新值。
- 广模式的两组规则同样生成，由 `<html>` 上的属性门控 —— 因此**切换范围也是实时的**，
  且构建产物与配置无关（脚本没跑时自动落到安全的精确模式）。

### 踩过并修掉的坑

- `broad` 最初只改写 `--dsw-specific-menu`，**菜单与对话框毫无变化**：该 token 只是
  `--dsw-menu-surface-fill` 的别名，而前端外壳里共享的菜单材质直接消费真身
  （`.material { background: var(--dsw-menu-surface-fill) }`）。现在两个名字一起写。
- 面板不透明度必须与暗纱分开：界面是「外壳 → 布局 → 会话 → 正文」多层半透明叠加，
  图只按各层透过率的**乘积**存活；每层都 0.45 时，聊天区实测为 `(26,26,30)`，与没有背景无异。
- 范围开关最初只从 `localStorage` 播种，**忽略了注入的默认值** ⇒ 配置项静默失效。
  现在「先看存储、再回默认」，且「还原默认」回的是配置里的值。

### 已知边界

- 精确锚点依赖 DSH 当前的属性名（`data-testid="todo-panel"`、`data-question-key`）。
  DSH 改版若调整这些名字，广模式仍然有效，精确模式会退化为「只作用于全局规则」而非报错。
- `surfaceOpacity` 是对多层叠加的近似补偿：DSH 增删层级时可能需要重新调这个值。
- 调参值存于浏览器 `localStorage`；换 profile 或清缓存会回到配置文件的默认值。
