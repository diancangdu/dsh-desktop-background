# 安装教程

两条路：**自动化脚本**（推荐）或**手动**（了解原理、或脚本不适用时）。

---

## 前置条件

| 项 | 要求 |
|---|---|
| DSH | 桌面端（Electron 窗口）或 `dsh web`；本文以 desktop profile 为例 |
| Node | 无需额外安装 —— 插件是纯 ESM，用 DSH 自带的运行时即可 |
| 背景图 | 自备 jpg/png，建议 ≤ 1920×1080（图会内联成 data URI，越大启动负载越高） |

---

## 一、自动化安装

```powershell
# 先干跑，看看会做什么（不会写盘）
.\install.ps1 -ProfileDir "$env:DSH_HOME\profiles\desktop" `
              -LightImage "D:\pictures\light.jpg" `
              -DarkImage  "D:\pictures\dark.jpg"

# 确认无误后写入
.\install.ps1 -ProfileDir "$env:DSH_HOME\profiles\desktop" `
              -LightImage "D:\pictures\light.jpg" `
              -DarkImage  "D:\pictures\dark.jpg" -Apply
```

脚本做三件事：

1. 把插件目录复制到 `<ProfileDir>\desktop-background\`
2. **备份** `cordis.patch.yml` 为 `cordis.patch.yml.bak_<时间戳>`
3. 把 insert 片段追加进 `cordis.patch.yml`（幂等：已存在 `id: desktop-background` 就跳过）

参数：

| 参数 | 默认 | 说明 |
|---|---|---|
| `-ProfileDir` | `$env:DSH_HOME\profiles\desktop` | 目标 profile 目录 |
| `-LightImage` / `-DarkImage` | 必填 | 背景图绝对路径 |
| `-MaskOpacity` | `0.30` | 暗纱，0 = 原图，1 = 全遮 |
| `-SurfaceOpacity` | `0.08` | 面板不透明度，**越小背景越明显** |
| `-InputOpacity` | `-1`（跟随 surface） | 输入框 |
| `-TodoOpacity` | `-1`（跟随 surface） | 待办框条 |
| `-OptionOpacity` | `-1`（跟随 surface） | 答案选项 |
| `-TodoScope` | `precise` | `precise` 只影响待办框条；`broad` 连同菜单/对话框 |
| `-OptionScope` | `precise` | `precise` 只影响选项行；`broad` 连同预设卡/选择器 |
| `-Apply` | 关 | 不加就是干跑 |

三个分区旋钮传负数（默认）就**不写进配置**，于是跟随 `SurfaceOpacity` —— 与只有两个旋钮时的
行为完全一致。

⚠️ 脚本**不会**帮你重启 DSH —— profile 配置只在进程启动时读一次，需要手动重启。

---

## 二、手动安装

### 1. 放插件

把 `index.js` 与 `client-script.js` 放进：

```
<DSH_HOME>/profiles/desktop/desktop-background/
├── index.js
└── client-script.js
```

### 2. 备份挂载点

```powershell
Copy-Item "$env:DSH_HOME\profiles\desktop\cordis.patch.yml" `
          "$env:DSH_HOME\profiles\desktop\cordis.patch.yml.bak"
```

### 3. 在 `cordis.patch.yml` 末尾追加

```yaml
- insert:
    - id: desktop-background
      name: './desktop-background/index.js'
      config:
        lightImage: 'D:/pictures/light.jpg'
        darkImage: 'D:/pictures/dark.jpg'
        maskOpacity: 0.30
        surfaceOpacity: 0.08
        # 可选：三处分区各自的不透明度（不写则跟随 surfaceOpacity）
        inputOpacity: 0.10
        todoOpacity: 0.05
        optionOpacity: 0.15
        # 可选：作用范围，precise = 只影响这一处（默认），broad = 连同同类表面
        todoScope: 'precise'
        optionScope: 'precise'
```

**两个必须注意的点**：

- `name` **必须指向具体文件**（`./desktop-background/index.js`）。写成目录
  （`./desktop-background`）会触发 Node ESM 的 `ERR_UNSUPPORTED_DIR_IMPORT`，
  插件静默不加载、**没有任何报错**。
- `config` 里的路径用**正斜杠**或**双反斜杠**（YAML 里单反斜杠是转义符）。

### 4. 重启 DSH

完全退出进程再打开，然后硬刷新窗口。

---

## 三、验证

**不要只看「有没有报错」** —— 这个插件的失败模式是静默的。用可复现判据：

| 判据 | 期望 |
|---|---|
| 事件日志（默认在系统临时目录） | 出现 `bg-ready` 且 `rowCount: 2` |
| 同文件 | 出现 `bg-inject` 且 `kinds: style+script` |
| 界面右下角 | 出现圆形按钮（图片图标） |
| 点开按钮 | 弹出「背景设置」卡片，滑块可拖动且立即生效 |

日志落点可用环境变量 `DSH_BACKGROUND_LOG` 指定；不设时在系统临时目录的
`desktop-background-events.jsonl`。

**`bg-ready` 出现但没有 `bg-inject`** ⇒ 插件加载了、注入没接上；
**两个都没有** ⇒ 插件没加载（九成是 `name` 写成了目录，或 YAML 缩进坏了）。

还有个更省事的办法：看右下角有没有那个按钮 —— 有按钮就说明两行注入都到位了。

---

## 四、卸载

```powershell
# 1. 从 cordis.patch.yml 删掉 desktop-background 那个 insert 块
#    （或就地禁用：给它加一行 disabled: true）
# 2. 重启 DSH
# 3. 可选：删掉插件目录
Remove-Item -Recurse -Force "<DSH_HOME>\profiles\desktop\desktop-background"
```

⚠️ 第 1 步之后、第 3 步之前**必须重启**：插件目录被删但配置仍指向它，启动会报模块找不到。

---

## 五、常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 右下角没有按钮，日志也没有 `bg-ready` | 插件没加载 | 检查 `name` 是不是指向了目录；检查 YAML 缩进 |
| 日志有 `bg-ready` 但没有按钮 | `script` 行没被执行 | 该页面的 CSP 可能禁止内联脚本；告诉我，改用 `global` 行 |
| 背景出来了但太淡 | 面板层不透明度太高 | 调小 `surfaceOpacity`（0.05 甚至 0.03） |
| 文字看不清 | 图太亮 | 调大 `maskOpacity`（压暗图），或把 `surfaceOpacity` 回调一点 |
| 改了配置没反应 | 没有重启 | profile 配置无热重载 |
