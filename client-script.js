/* desktop-background · floating button + live tuning card.
 *
 * Injected as a structured { kind: 'script' } row, because that is a carrier
 * the Desktop window actually interprets (webServer.tapIndex is not).
 *
 * This file deliberately holds NO design values. All colours and every derived
 * alpha stay in the host-side stylesheet (index.js buildCss); this script only
 * writes three custom properties on <html> with priority 'important':
 *     --dbg-mask-light, --dbg-mask-dark, --dbg-surface
 * so there is exactly one source of truth for how the theme looks.
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
    : { mask: 0.3, surface: 0.08 };

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

  var stored = null;
  try { stored = JSON.parse(readStore(STORE_KEY) || 'null'); } catch (error) { stored = null; }
  if (typeof stored !== 'object' || stored === null) stored = {};

  var state = {
    mask: clamp(stored.mask, 0, 1, DEFAULTS.mask),
    surface: clamp(stored.surface, 0, 0.6, DEFAULTS.surface),
  };

  function apply() {
    var m = state.mask.toFixed(3);
    root.style.setProperty('--dbg-mask-light', 'rgba(255,255,255,' + m + ')', 'important');
    root.style.setProperty('--dbg-mask-dark', 'rgba(9,9,13,' + m + ')', 'important');
    root.style.setProperty('--dbg-surface', state.surface.toFixed(3), 'important');
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

    '#' + PANEL_ID + '{position:fixed;right:18px;bottom:70px;z-index:2147483000;width:272px;',
    'box-sizing:border-box;padding:12px 14px 11px;background:#1c1c22;color:#e9e9f0;',
    'border:1px solid #3b3b46;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.6);',
    'font:12px/1.55 system-ui,"Segoe UI",sans-serif;user-select:none}',
    '#' + PANEL_ID + '[hidden]{display:none}',
    '#' + PANEL_ID + ' .t{display:flex;align-items:center;justify-content:space-between;',
    'font-weight:600;margin-bottom:9px}',
    '#' + PANEL_ID + ' .r{display:flex;align-items:center;gap:8px;margin:7px 0}',
    '#' + PANEL_ID + ' .r label{flex:0 0 96px;color:#b9b9c6}',
    '#' + PANEL_ID + ' input[type=range]{flex:1;min-width:0;accent-color:#7e9cff}',
    '#' + PANEL_ID + ' .v{flex:0 0 38px;text-align:right;font-variant-numeric:tabular-nums}',
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
  var maskInput = null;
  var maskValue = null;
  var surfInput = null;
  var surfValue = null;

  var ICON = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"',
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<rect x="3" y="4" width="18" height="16" rx="2.5"></rect>',
    '<circle cx="8.5" cy="9.5" r="1.6"></circle>',
    '<path d="M21 15.5 16.5 11 7 20"></path></svg>',
  ].join('');

  function sync() {
    if (maskInput !== null) maskInput.value = String(state.mask);
    if (maskValue !== null) maskValue.textContent = state.mask.toFixed(2);
    if (surfInput !== null) surfInput.value = String(state.surface);
    if (surfValue !== null) surfValue.textContent = state.surface.toFixed(2);
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
    return '        maskOpacity: ' + state.mask.toFixed(2) + '\n' +
           '        surfaceOpacity: ' + state.surface.toFixed(2);
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
      '<div class="r"><label>暗纱 mask</label><input type="range" min="0" max="1" step="0.01" data-k="mask"><span class="v" data-v="mask"></span></div>',
      '<div class="r"><label>面板 surface</label><input type="range" min="0" max="0.6" step="0.01" data-k="surface"><span class="v" data-v="surface"></span></div>',
      '<div class="f"><button data-act="copy">复制配置</button><button data-act="reset">还原默认</button></div>',
      '<div class="h">面板值越小背景越明显。改完立即生效并记住；Ctrl+Alt+B 也可开合。</div>',
    ].join('');

    maskInput = panel.querySelector('input[data-k=mask]');
    maskValue = panel.querySelector('[data-v=mask]');
    surfInput = panel.querySelector('input[data-k=surface]');
    surfValue = panel.querySelector('[data-v=surface]');

    function bindSlider(key, input, hi) {
      input.addEventListener('input', function () {
        state[key] = clamp(input.value, 0, hi, DEFAULTS[key]);
        apply();
        save();
        sync();
      });
    }
    bindSlider('mask', maskInput, 1);
    bindSlider('surface', surfInput, 0.6);

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
