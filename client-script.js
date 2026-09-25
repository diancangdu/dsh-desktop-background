/* desktop-background · floating button + live tuning card.
 *
 * Injected as a structured { kind: 'script' } row, because that is a carrier
 * the Desktop window actually interprets (webServer.tapIndex is not).
 *
 * This file deliberately holds NO design values. All colours and every derived
 * offset stay in the host-side stylesheet (index.js buildCss); this script only
 * writes six custom properties on <html> with priority 'important':
 *     --dbg-mask-light, --dbg-mask-dark,
 *     --dbg-surface, --dbg-input, --dbg-todo, --dbg-option
 * plus two scope attributes (data-dbg-todo-broad / data-dbg-option-broad) that
 * gate the broad-scope rules. So there is exactly one source of truth for how
 * the theme looks.
 *
 * UI: a small round button in the bottom-right corner. Clicking it expands the
 * tuning card above it; the card's x collapses it again, and Ctrl+Alt+B does
 * the same. Values persist in localStorage across restarts - use the copy
 * button to move them into cordis.patch.yml as the real defaults.
 */
(function () {
  'use strict';

  var STORE_KEY = 'dsh-desktop-bg-tuning';
  var OPEN_KEY = 'dsh-desktop-bg-panel-open';
  var BTN_ID = 'dsh-bg-tuning-btn';
  var PANEL_ID = 'dsh-bg-tuning-panel';

  var DEFAULTS = (typeof __DSH_BG_DEFAULTS__ === 'object' && __DSH_BG_DEFAULTS__ !== null)
    ? __DSH_BG_DEFAULTS__
    : { mask: 0.3, surface: 0.08, input: 0.08, todo: 0.08, option: 0.08 };

  var root = document.documentElement;

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { /* session-only */ }
  }

  function clamp(v, lo, hi, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  function fallbackOf(key, general) {
    return DEFAULTS[key] != null ? DEFAULTS[key] : general;
  }

  // Scope must seed from the injected defaults too, not only from storage -
  // otherwise the config option would be silently ignored on a fresh profile.
  function scopeOf(key, storedValue) {
    if (storedValue === 'broad' || storedValue === 'precise') return storedValue;
    return DEFAULTS[key] === 'broad' ? 'broad' : 'precise';
  }

  var stored = null;
  try { stored = JSON.parse(readStore(STORE_KEY) || 'null'); } catch (error) { stored = null; }
  if (typeof stored !== 'object' || stored === null) stored = {};

  // The three region knobs fall back to the general surface value, mirroring
  // what the host does when the config omits them.
  var baseSurface = clamp(stored.surface, 0, 1, DEFAULTS.surface);
  var state = {
    mask: clamp(stored.mask, 0, 1, DEFAULTS.mask),
    surface: baseSurface,
    input: clamp(stored.input, 0, 1, fallbackOf('input', baseSurface)),
    todo: clamp(stored.todo, 0, 1, fallbackOf('todo', baseSurface)),
    option: clamp(stored.option, 0, 1, fallbackOf('option', baseSurface)),
    todoScope: scopeOf('todoScope', stored.todoScope),
    optionScope: scopeOf('optionScope', stored.optionScope),
  };

  function apply() {
    var m = state.mask.toFixed(3);
    root.style.setProperty('--dbg-mask-light', 'rgba(255,255,255,' + m + ')', 'important');
    root.style.setProperty('--dbg-mask-dark', 'rgba(9,9,13,' + m + ')', 'important');
    root.style.setProperty('--dbg-surface', state.surface.toFixed(3), 'important');
    root.style.setProperty('--dbg-input', state.input.toFixed(3), 'important');
    root.style.setProperty('--dbg-todo', state.todo.toFixed(3), 'important');
    root.style.setProperty('--dbg-option', state.option.toFixed(3), 'important');
    // Scope is a CSS-rule switch, so it rides on attributes rather than a var.
    if (state.todoScope === 'broad') root.setAttribute('data-dbg-todo-broad', '1');
    else root.removeAttribute('data-dbg-todo-broad');
    if (state.optionScope === 'broad') root.setAttribute('data-dbg-option-broad', '1');
    else root.removeAttribute('data-dbg-option-broad');
  }

  function save() {
    writeStore(STORE_KEY, JSON.stringify(state));
  }

  // ---------------------------------------------------------------- styles

  var CSS = [
    '#' + BTN_ID + '{position:fixed;right:18px;bottom:18px;z-index:2147483000;',
    'width:42px;height:42px;padding:0;display:grid;place-items:center;cursor:pointer;',
    'background:#1c1c22;color:#e9e9f0;border:1px solid #3b3b46;border-radius:50%;',
    'box-shadow:0 8px 24px rgba(0,0,0,.55);transition:background .15s,transform .15s}',
    '#' + BTN_ID + ':hover{background:#2b2b35;transform:translateY(-1px)}',
    '#' + BTN_ID + '[data-open="1"]{background:#31518f;border-color:#4a6fbe}',
    '#' + BTN_ID + ' svg{width:20px;height:20px;display:block}',

    '#' + PANEL_ID + '{position:fixed;right:18px;bottom:70px;z-index:2147483000;width:302px;',
    'box-sizing:border-box;padding:12px 14px 11px;background:#1c1c22;color:#e9e9f0;',
    'border:1px solid #3b3b46;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.6);',
    'font:12px/1.55 system-ui,"Segoe UI",sans-serif;user-select:none;max-height:72vh;overflow:auto}',
    '#' + PANEL_ID + '[hidden]{display:none}',
    '#' + PANEL_ID + ' .t{display:flex;align-items:center;justify-content:space-between;',
    'font-weight:600;margin-bottom:9px}',
    '#' + PANEL_ID + ' .sep{margin:11px 0 7px;padding-top:9px;border-top:1px solid #33333d;',
    'color:#8b8b99;font-size:11px;letter-spacing:.04em}',
    '#' + PANEL_ID + ' .r{display:flex;align-items:center;gap:8px;margin:7px 0}',
    '#' + PANEL_ID + ' .r label{flex:0 0 88px;color:#b9b9c6}',
    '#' + PANEL_ID + ' input[type=range]{flex:1;min-width:0;accent-color:#7e9cff}',
    '#' + PANEL_ID + ' .v{flex:0 0 38px;text-align:right;font-variant-numeric:tabular-nums}',
    '#' + PANEL_ID + ' .s{display:flex;align-items:center;gap:6px;margin:0 0 8px 96px;',
    'color:#8b8b99;font-size:11px;cursor:pointer}',
    '#' + PANEL_ID + ' .s input{accent-color:#7e9cff;margin:0}',
    '#' + PANEL_ID + ' button{background:#2b2b34;color:#e9e9f0;border:1px solid #45454f;',
    'border-radius:7px;padding:4px 9px;font:inherit;cursor:pointer}',
    '#' + PANEL_ID + ' button:hover{background:#35353f}',
    '#' + PANEL_ID + ' .f{display:flex;gap:7px;margin-top:10px}',
    '#' + PANEL_ID + ' .h{margin-top:9px;color:#8b8b99;font-size:11px;line-height:1.45}',
  ].join('');

  function installCss() {
    if (document.getElementById(PANEL_ID + '-css') !== null) return;
    var style = document.createElement('style');
    style.id = PANEL_ID + '-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------ dom

  var panel = null;
  var button = null;
  var nodes = {};

  var ICON = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"',
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<rect x="3" y="4" width="18" height="16" rx="2.5"></rect>',
    '<circle cx="8.5" cy="9.5" r="1.6"></circle>',
    '<path d="M21 15.5 16.5 11 7 20"></path></svg>',
  ].join('');

  var SLIDERS = [
    { key: 'mask', label: '暗纱 mask' },
    { key: 'surface', label: '面板 surface' },
    { key: 'input', label: '输入框', section: '分区微调（不设则跟随面板）' },
    { key: 'todo', label: '待办框条', scope: 'todoScope', scopeHint: '菜单 / 对话框也跟变' },
    { key: 'option', label: '答案选项', scope: 'optionScope', scopeHint: '预设卡 / 选择器也跟变' },
  ];

  function sync() {
    for (var i = 0; i < SLIDERS.length; i += 1) {
      var k = SLIDERS[i].key;
      if (nodes[k + 'Input']) nodes[k + 'Input'].value = String(state[k]);
      if (nodes[k + 'Value']) nodes[k + 'Value'].textContent = state[k].toFixed(2);
    }
    if (nodes.todoScope) nodes.todoScope.checked = state.todoScope === 'broad';
    if (nodes.optionScope) nodes.optionScope.checked = state.optionScope === 'broad';
  }

  function isOpen() {
    return panel !== null && panel.hasAttribute('hidden') === false;
  }

  function setOpen(open) {
    if (panel === null || button === null) return;
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
    button.setAttribute('data-open', open ? '1' : '0');
    button.title = open ? '收起背景设置' : '背景设置';
    writeStore(OPEN_KEY, open ? '1' : '0');
  }

  function snippet() {
    var lines = [
      '        maskOpacity: ' + state.mask.toFixed(2),
      '        surfaceOpacity: ' + state.surface.toFixed(2),
      '        inputOpacity: ' + state.input.toFixed(2),
      '        todoOpacity: ' + state.todo.toFixed(2),
      '        optionOpacity: ' + state.option.toFixed(2),
    ];
    if (state.todoScope === 'broad') lines.push("        todoScope: 'broad'");
    if (state.optionScope === 'broad') lines.push("        optionScope: 'broad'");
    return lines.join('\n');
  }

  function sliderMarkup() {
    var html = '';
    for (var i = 0; i < SLIDERS.length; i += 1) {
      var s = SLIDERS[i];
      if (s.section) html += '<div class="sep">' + s.section + '</div>';
      html += '<div class="r"><label>' + s.label + '</label>' +
        '<input type="range" min="0" max="1" step="0.01" data-k="' + s.key + '">' +
        '<span class="v" data-v="' + s.key + '"></span></div>';
      if (s.scope) {
        html += '<label class="s"><input type="checkbox" data-scope="' + s.scope + '">' +
          '同类一起变' + (s.scopeHint ? '（' + s.scopeHint + '）' : '') + '</label>';
      }
    }
    return html;
  }

  function build() {
    if (document.getElementById(BTN_ID) !== null) return;
    installCss();

    button = document.createElement('button');
    button.id = BTN_ID;
    button.type = 'button';
    button.innerHTML = ICON;
    button.setAttribute('data-open', '0');
    button.title = '背景设置';
    button.addEventListener('click', function () { setOpen(!isOpen()); });

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('hidden', '');
    panel.innerHTML = [
      '<div class="t"><span>背景设置</span><button data-act="collapse" title="收起">x</button></div>',
      sliderMarkup(),
      '<div class="f"><button data-act="copy">复制配置</button><button data-act="reset">还原默认</button></div>',
      '<div class="h">值越小背景越明显。改完立即生效并记住；Ctrl+Alt+B 也可开合。</div>',
    ].join('');

    for (var i = 0; i < SLIDERS.length; i += 1) {
      var k = SLIDERS[i].key;
      nodes[k + 'Input'] = panel.querySelector('input[data-k=' + k + ']');
      nodes[k + 'Value'] = panel.querySelector('[data-v=' + k + ']');
    }
    nodes.todoScope = panel.querySelector('input[data-scope=todoScope]');
    nodes.optionScope = panel.querySelector('input[data-scope=optionScope]');

    function bindSlider(key, input) {
      input.addEventListener('input', function () {
        state[key] = clamp(input.value, 0, 1, DEFAULTS[key]);
        apply();
        save();
        sync();
      });
    }
    for (var j = 0; j < SLIDERS.length; j += 1) {
      bindSlider(SLIDERS[j].key, nodes[SLIDERS[j].key + 'Input']);
    }

    function bindScope(key, box) {
      box.addEventListener('change', function () {
        state[key] = box.checked ? 'broad' : 'precise';
        apply();
        save();
        sync();
      });
    }
    bindScope('todoScope', nodes.todoScope);
    bindScope('optionScope', nodes.optionScope);

    panel.addEventListener('click', function (event) {
      var target = event.target;
      var el = target && target.closest ? target.closest('button') : null;
      if (el === null) return;
      var act = el.getAttribute('data-act');
      if (act === 'collapse') {
        setOpen(false);
      } else if (act === 'reset') {
        state.mask = DEFAULTS.mask;
        state.surface = DEFAULTS.surface;
        state.input = fallbackOf('input', DEFAULTS.surface);
        state.todo = fallbackOf('todo', DEFAULTS.surface);
        state.option = fallbackOf('option', DEFAULTS.surface);
        state.todoScope = DEFAULTS.todoScope === 'broad' ? 'broad' : 'precise';
        state.optionScope = DEFAULTS.optionScope === 'broad' ? 'broad' : 'precise';
        apply(); save(); sync();
      } else if (act === 'copy') {
        var text = snippet();
        var done = function () {
          el.textContent = '已复制';
          window.setTimeout(function () { el.textContent = '复制配置'; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          done();
        }
      }
    });

    document.body.appendChild(panel);
    document.body.appendChild(button);
    sync();
    // Remember whether the card was left open; the default is just the button.
    setOpen(readStore(OPEN_KEY) === '1');
  }

  // Apply stored values before anything is built, so the first paint is right.
  apply();

  if (document.body === null) {
    document.addEventListener('DOMContentLoaded', function () { build(); }, { once: true });
  } else {
    build();
  }

  document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.altKey && (event.key === 'b' || event.key === 'B')) {
      event.preventDefault();
      setOpen(!isOpen());
    }
  }, true);
})();
