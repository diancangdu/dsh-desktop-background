# dsh-desktop-background

给 **DeepSeek Harness（DSH）桌面窗口**加背景图的原生插件，附带右下角实时调参按钮。

零外部依赖、零网络请求。

## 为什么需要它（而不是随便找个主题插件）

DSH 桌面窗口的 `index.html` **不经过宿主 web server**：

- Electron 主进程把 `dsh-app://app/` 的 `/`、`/index.html`、`/assets/*` 交给一个直接从磁盘读
  `dsh-web-frontend/dist/index.html` 的函数，只替换一句 `__DSH_BOOT_READY__`
- ⇒ `webServer.tapIndex()` 的变换**在桌面窗口永不执行**
- ⇒ 凡是把样式全部交给 `tapIndex` 注入的主题插件，在桌面窗口都会**静默失效**：
  设置卡片照常出现（那是纯客户端 slot 注册），但界面毫无变化

能到达桌面窗口的只有两条路：

1. **结构化 index 注入行** —— 桌面窗口的 boot payload 就是
   `injections: ctx.webServer.collectIndexInjections()`，而页面侧解释器里有
   `case "style"` 与 `case "script"`
2. **客户端插件自己注入 `<style>`**

本插件走第 1 条，并且把背景图**内联成 data URI**，于是完全不依赖路由 / 鉴权 cookie / CSP /
任何可能在桌面窗口里失败的请求。

## 安装

把插件目录放到 profile 下，然后在 profile 的 `cordis.patch.yml` 里加一个 insert：

```yaml
- insert:
    - id: desktop-background
      name: './desktop-background/index.js'
      config:
        lightImage: 'D:/pictures/light.jpg'
        darkImage: 'D:/pictures/dark.jpg'
        maskOpacity: 0.30
        surfaceOpacity: 0.08
```

⚠️ **`name` 必须指向具体文件**（`./desktop-background/index.js`）。写成目录会触发 Node ESM 的
`ERR_UNSUPPORTED_DIR_IMPORT`，插件静默不加载、没有任何报错。

改完重启 DSH。profile 配置只在进程启动时读一次，没有热重载。

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `lightImage` | — | 浅色模式的背景图（绝对路径，建议 jpg ≤ 1920×1080） |
| `darkImage` | — | 深色模式的背景图 |
| `image` | — | 只给一张时的回退值 |
| `maskOpacity` | 0.35 | 压在图上的一层暗纱，0 = 原图，1 = 全遮。用来压亮度保可读性 |
| `surfaceOpacity` | 0.10 | **其余面板**的不透明度。想背景更明显就调小这个 |
| `inputOpacity` | 跟随 `surfaceOpacity` | **A 输入框**（composer 输入框） |
| `todoOpacity` | 跟随 `surfaceOpacity` | **B 待办框条**（输入框上方那条任务进度面板） |
| `optionOpacity` | 跟随 `surfaceOpacity` | **C 答案选项**（提问卡里的选项行） |
| `todoScope` | `precise` | B 的作用范围：`precise` 只影响待办框条 / `broad` 连同菜单、对话框一起变 |
| `optionScope` | `precise` | C 的作用范围：`precise` 只影响选项行 / `broad` 连同预设卡、选择器一起变 |

三个分区旋钮**不写就跟随 `surfaceOpacity`**，所以不配它们时行为与只有两个旋钮时完全相同。

### 三处分区是怎么定位的（不是猜的）

| 区域 | 锚点 | 依据 |
|---|---|---|
| A 输入框 | token `--dsw-specific-input-major` | composer 用它；提问卡、审批卡、它们的文本行**共用同一个 token** |
| B 待办框条 | `[data-testid="todo-panel"]` | 待办面板挂在插槽 `conversation.input.dock`（输入框上方），自带的稳定属性 |
| C 答案选项 | `[data-question-key]` | 提问卡根节点带这个属性；选项是 `role="radio|checkbox"` 的按钮 |

### `precise` 与 `broad` 的实际差别

`precise`（默认）把 token **声明在目标元素本身上** —— 只有该元素及其子树看得到新值，
所以菜单、对话框、预设卡都不受影响，这才是真正「分开设置」。

`broad` 把同一份声明提升到 `html body`，于是**所有共用该 token 的表面**一起变：

- B 用的 `--dsw-specific-menu` 同时是**所有菜单与对话框**的底
- C 用的 `--dsw-alias-bg-module-platform` 同时被 **agent 预设卡、模型选择器、告警条**用

两种模式都已生成为 CSS 规则，`broad` 那组由 `<html>` 上的属性门控，因此**切换范围是实时的**。

### 为什么面板不透明度要单独一个旋钮

DSH 的界面是**多层半透明表面叠加**（外壳 → 布局 → 会话 → 正文），背景图只能按各层透过率的
**乘积**活下来。实测把所有层都设成 0.45 时，聊天区的像素统计是 `(26,26,30)` —— 跟没有背景
几乎没有区别。所以「暗纱」和「面板」必须是两个独立的值。

侧栏固定为 `surfaceOpacity + 0.15`。输入框已有独立旋钮，不再叠加旧的 `+ 0.35`。

## 实时调参

插件同时注入一个 `script` 行，在右下角放一个圆形按钮。点开是一张调参卡片：

- **五个滑块**（暗纱 / 面板 / 输入框 / 待办框条 / 答案选项），**拖动立即生效，不用重启**
- B、C 各带一个「同类一起变」开关，对应 `precise` / `broad`，**切换同样实时**
- 值存在 `localStorage`，跨重启保留
- 「复制配置」把当前值输出成可粘贴的 `cordis.patch.yml` 片段；想固化成默认值就用它
- `Ctrl+Alt+B` 开合面板

面板**只写三个 CSS 变量**（`--dbg-mask-light` / `--dbg-mask-dark` / `--dbg-surface`），
所有颜色与推导公式都留在宿主样式里 —— 这样不存在两份真值。

## 不含背景图

仓库里**没有任何图片**。DSH 是通用宿主，背景图请自备（注意版权）。
`maskOpacity` 与 `surfaceOpacity` 的调参不依赖具体图片，换图只要改配置里的路径。

## 目录

```
index.js           宿主半侧：读图 → 内联 data URI → 生成样式；推 style + script 两行注入
client-script.js   浏览器半侧：右下角按钮 + 调参卡片（被 index.js 读入后作为 script 行注入）
```

## 已知边界

- 只在 **DSH 桌面窗口**验证过；同样的结构化行在浏览器载体（`dsh web` 打印的 URL）下也应当生效，
  因为那条路径两者都会执行
- `surfaceOpacity` 是对「多层叠加」的近似补偿：DSH 改版增删层级时，可能需要重新调这个值
- 面板的打开/收起状态与调参值存于浏览器 `localStorage`；换 profile 或清缓存会回到配置文件的默认值
