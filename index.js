// desktop-background - native Cordis plugin: a background image for the DSH
// Desktop window (and the browser carrier), with zero network requests.
//
// WHY THIS EXISTS (measured 2026-09-25, not inferred):
//   The Desktop shell does NOT render index.html through the host web server.
//   Electron main.js (protocol.handle for dsh-app://app) routes "/", "/index.html"
//   and "/assets/*" to serveWebDocument(), which reads dsh-web-frontend/dist/
//   index.html straight off disk and only splices __DSH_BOOT_READY__ into it.
//   => webServer.tapIndex() transforms never run in the Desktop window.
//   dsh-host-webserver documents tapIndex as the escape hatch that is NOT
//   carried in the boot payload, and dsh-desktop-host builds that payload with
//   `injections: ctx.webServer.collectIndexInjections()` - i.e. only the
//   STRUCTURED rows travel to the window. The page-side interpreter in
//   dsh-web-frontend handles them, including: case "style" -> create <style>.
//
//   So this plugin contributes exactly one structured { kind: 'style' } row.
//   The background image is inlined as a data URI, so nothing is fetched at
//   runtime: no route, no auth cookie, no CSP, no race with the config fetch.
//
// Failure policy: if the image cannot be read the plugin injects nothing and
// logs why - it never breaks the app shell.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const LOG =
  process.env.DSH_BACKGROUND_LOG || join(tmpdir(), 'desktop-background-events.jsonl');

function record(entry) {
  try {
    appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
  } catch {
    // logging must never break the plugin
  }
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const MAX_BYTES = 12 * 1024 * 1024;

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value, fallback) {
  return Math.min(1, Math.max(0, num(value, fallback)));
}

/** Read one image and turn it into a data URI, or null (with a reason). */
function toDataUri(path) {
  if (typeof path !== 'string' || path.trim() === '') return { uri: null, reason: 'empty-path' };
  try {
    if (!existsSync(path)) return { uri: null, reason: 'not-found' };
    const bytes = readFileSync(path);
    if (bytes.length > MAX_BYTES) return { uri: null, reason: 'too-large' };
    const mime = MIME[extname(path).toLowerCase()] || 'image/jpeg';
    return { uri: `data:${mime};base64,${bytes.toString('base64')}`, reason: 'ok', bytes: bytes.length };
  } catch (error) {
    return { uri: null, reason: 'read-failed:' + String(error && error.message) };
  }
}

// Panel alphas derive from ONE knob, because the app stacks several translucent
// surfaces (shell -> layout -> conversation -> transcript); the image only
// survives the PRODUCT of their transmissions, so per-layer alpha must stay
// small or the picture washes out to flat dark. Extra chrome (sidebar/input)
// keeps a margin for readability. Measured 2026-09-25: with every layer at 0.45
// the chat area came out (26,26,30) - indistinguishable from no background.
//
// The knob itself is the CSS variable --dbg-surface, NOT a baked-in number, so
// the injected tuning panel can change it at runtime without a restart. All
// colours and all derived offsets stay here: the client script owns no values.
function surfaceBlock(hex) {
  const alpha = (expr) => `rgb(${hex.base} / ${expr})`;
  return [
    `--dsw-alias-bg-base:${alpha('var(--dbg-surface)')}`,
    `--dsw-specific-tip:rgb(${hex.tip} / var(--dbg-surface))`,
    `--dsw-specific-bubble:rgb(${hex.bubble} / var(--dbg-surface))`,
    `--dsw-specific-bubble-highlight:rgb(${hex.highlight} / var(--dbg-surface))`,
    `--dsw-specific-sidebar-fill:rgb(${hex.sidebar} / min(1, calc(var(--dbg-surface) + 0.15)))`,
    `--dsw-specific-input-major:rgb(${hex.input} / min(1, calc(var(--dbg-surface) + 0.35)))`,
  ].join('!important;') + '!important';
}

// Space-separated channels on purpose: these feed the modern `rgb(R G B / a)`
// form. Mixing the legacy comma form with a slash is invalid CSS.
const LIGHT_HEX = {
  base: '255 255 255',
  tip: '245 246 247',
  bubble: '237 243 254',
  highlight: '211 226 255',
  sidebar: '249 250 251',
  input: '255 255 255',
};

const DARK_HEX = {
  base: '21 21 23',
  tip: '44 44 46',
  bubble: '44 44 46',
  highlight: '53 54 56',
  sidebar: '16 16 20',
  input: '44 44 46',
};

/** Compose the stylesheet; returns null when there is no usable image. */
export function buildCss(config) {
  const cfg = config && typeof config === 'object' ? config : {};
  const mask = clamp01(cfg.maskOpacity, 0.35);
  const surface = clamp01(cfg.surfaceOpacity, 0.10);

  const darkFile = toDataUri(cfg.darkImage);
  const lightFile = toDataUri(cfg.lightImage);
  const fallback = toDataUri(cfg.image);
  const chosenDark = darkFile.uri ? darkFile : fallback;
  const chosenLight = lightFile.uri ? lightFile : fallback;

  if (!chosenDark.uri && !chosenLight.uri) {
    return {
      css: null,
      report: {
        event: 'bg-skip',
        reason: 'no-image',
        dark: darkFile.reason,
        light: lightFile.reason,
        image: cfg.image ?? null,
      },
    };
  }

  const darkUri = (chosenDark.uri || chosenLight.uri);
  const lightUri = (chosenLight.uri || chosenDark.uri);

  // The mask is a flat translucent layer stacked over the image on the canvas,
  // so no pseudo-element and no z-index trickery is involved; body is made
  // transparent so the canvas is actually visible behind the app surfaces.
  // `maskOpacity` softens the picture for contrast; `surfaceOpacity` decides how
  // much of it survives the stacked panels. They are separate knobs on purpose.
  const css = [
    ':root{',
    `--dbg-image-light:url("${lightUri}");`,
    `--dbg-image-dark:url("${darkUri}");`,
    `--dbg-mask-light:rgba(255,255,255,${mask.toFixed(3)});`,
    `--dbg-mask-dark:rgba(9,9,13,${mask.toFixed(3)});`,
    `--dbg-surface:${surface.toFixed(3)};`,
    '}',
    'html{',
    '--dbg-image:var(--dbg-image-light)!important;',
    '--dbg-mask:var(--dbg-mask-light)!important;',
    'background-image:linear-gradient(var(--dbg-mask),var(--dbg-mask)),var(--dbg-image)!important;',
    'background-size:cover,cover!important;',
    'background-position:center center,center center!important;',
    'background-repeat:no-repeat,no-repeat!important;',
    'background-attachment:fixed,fixed!important;',
    '}',
    // body carries data-ds-dark-theme, so :has() is how html can react to it.
    'html:has(body[data-ds-dark-theme]){',
    '--dbg-image:var(--dbg-image-dark)!important;',
    '--dbg-mask:var(--dbg-mask-dark)!important;',
    '}',
    'body{background-color:transparent!important;}',
    `html body{${surfaceBlock(LIGHT_HEX)}}`,
    `html body[data-ds-dark-theme]{${surfaceBlock(DARK_HEX)}}`,
  ].join('');

  return {
    css,
    report: {
      event: 'bg-built',
      maskOpacity: mask,
      surfaceOpacity: surface,
      darkReason: chosenDark.reason,
      lightReason: chosenLight.reason,
      darkBytes: chosenDark.bytes ?? 0,
      lightBytes: chosenLight.bytes ?? 0,
      cssLength: css.length,
    },
  };
}

/** The live tuning panel source, with its defaults placeholder substituted. */
export function buildClientScript(defaults) {
  const file = fileURLToPath(new URL('./client-script.js', import.meta.url));
  const source = readFileSync(file, 'utf8');
  // split/join, not replace: the placeholder appears several times (typeof
  // guard + the value itself), and replace() would only patch the first one.
  return source.split('__DSH_BG_DEFAULTS__').join(JSON.stringify(defaults));
}

/**
 * Build every structured row this plugin contributes. Split out from apply()
 * so tests can assert the rows without a Cordis context.
 */
export function buildRows(config) {
  const cfg = config && typeof config === 'object' ? config : {};
  const { css, report } = buildCss(cfg);
  if (css === null) return { rows: [], report };

  const rows = [{ kind: 'style', text: css }];
  try {
    rows.push({
      kind: 'script',
      placement: 'body',
      text: buildClientScript({
        mask: clamp01(cfg.maskOpacity, 0.35),
        surface: clamp01(cfg.surfaceOpacity, 0.10),
      }),
    });
  } catch (error) {
    // A missing/broken panel must never cost us the background itself.
    report.scriptError = String(error && error.message);
  }
  return { rows, report };
}

export function apply(ctx, config = {}) {
  const { rows, report } = buildRows(config);
  record({ event: 'bg-ready', ...report, rowCount: rows.length });

  if (rows.length === 0) return;

  let injected = 0;
  ctx.on('webserver/index-inject', (table) => {
    if (!Array.isArray(table)) return;
    // Fresh table per collect call, so one push per row per emit is correct.
    for (const row of rows) table.push(row);
    injected += 1;
    record({
      event: 'bg-inject',
      rows: table.length,
      count: injected,
      kinds: rows.map((row) => row.kind).join('+'),
    });
  });
}
