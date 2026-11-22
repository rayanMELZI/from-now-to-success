import { TAG_COLORS, type TagColor } from "./types";

/**
 * Formatted text kept in a plain string, so it travels through the API (and
 * its length limit) untouched. Close to Markdown on purpose, so it still
 * reads sensibly where it is shown raw (the same marks as the mobile app):
 *
 *   **bold**   _italic_   ~~struck~~   ++underlined++   {red:coloured}
 *
 * A marker without its partner is just text, and a marker character meant
 * literally is escaped with a backslash.
 */

export interface RichStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  color?: TagColor;
}

export type ToggleKey = "bold" | "italic" | "strike" | "underline";

export interface Run {
  text: string;
  style: RichStyle;
}

const MARKERS: { key: ToggleKey; mark: string }[] = [
  { key: "bold", mark: "**" },
  { key: "italic", mark: "_" },
  { key: "strike", mark: "~~" },
  { key: "underline", mark: "++" },
];

const COLOR_OPEN = new RegExp(`^\\{(${TAG_COLORS.join("|")}):`);
const SPECIAL = new Set(["\\", "*", "_", "~", "+", "{", "}"]);

export function sameStyle(a: RichStyle, b: RichStyle): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.strike === !!b.strike &&
    !!a.underline === !!b.underline &&
    (a.color ?? null) === (b.color ?? null)
  );
}

export const isPlainStyle = (s: RichStyle) => sameStyle(s, {});

/** Drops empty runs and merges neighbours that look the same. */
export function normalize(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = out[out.length - 1];
    if (last && sameStyle(last.style, run.style)) last.text += run.text;
    else out.push({ text: run.text, style: { ...run.style } });
  }
  return out;
}

/* ---------------------------------------------------------------- reading */

type Token =
  | { kind: "text"; text: string }
  | { kind: "mark"; key: ToggleKey; raw: string; paired?: boolean }
  | { kind: "open"; color: TagColor; raw: string; paired?: boolean }
  | { kind: "close"; raw: string; paired?: boolean };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length && SPECIAL.has(source[i + 1])) {
      tokens.push({ kind: "text", text: source[i + 1] });
      i += 2;
      continue;
    }
    const marker = MARKERS.find((m) => source.startsWith(m.mark, i));
    if (marker) {
      tokens.push({ kind: "mark", key: marker.key, raw: marker.mark });
      i += marker.mark.length;
      continue;
    }
    const open = COLOR_OPEN.exec(source.slice(i));
    if (open) {
      tokens.push({ kind: "open", color: open[1] as TagColor, raw: open[0] });
      i += open[0].length;
      continue;
    }
    if (ch === "}") {
      tokens.push({ kind: "close", raw: "}" });
      i += 1;
      continue;
    }
    tokens.push({ kind: "text", text: ch });
    i += 1;
  }
  return tokens;
}

/** Splits a stored string into styled runs. */
export function parseRich(source: string): Run[] {
  const tokens = tokenize(source);

  // Pair the markers up; whatever has no partner is read as plain text.
  const openMark: Partial<Record<ToggleKey, number>> = {};
  const colorStack: number[] = [];
  tokens.forEach((t, i) => {
    if (t.kind === "mark") {
      const at = openMark[t.key];
      if (at === undefined) openMark[t.key] = i;
      else {
        (tokens[at] as { paired?: boolean }).paired = true;
        t.paired = true;
        delete openMark[t.key];
      }
    } else if (t.kind === "open") {
      colorStack.push(i);
    } else if (t.kind === "close") {
      const at = colorStack.pop();
      if (at !== undefined) {
        (tokens[at] as { paired?: boolean }).paired = true;
        t.paired = true;
      }
    }
  });

  const runs: Run[] = [];
  const style: RichStyle = {};
  const colors: TagColor[] = [];
  for (const t of tokens) {
    if (t.kind === "text" || !t.paired) {
      runs.push({ text: t.kind === "text" ? t.text : t.raw, style: { ...style, color: colors[colors.length - 1] } });
    } else if (t.kind === "mark") {
      style[t.key] = !style[t.key];
    } else if (t.kind === "open") {
      colors.push(t.color);
    } else {
      colors.pop();
    }
  }
  return normalize(runs.map((r) => ({ text: r.text, style: clean(r.style) })));
}

/** Leaves out the flags that are off, so styles compare and spread simply. */
function clean(style: RichStyle): RichStyle {
  const out: RichStyle = {};
  for (const { key } of MARKERS) if (style[key]) out[key] = true;
  if (style.color) out.color = style.color;
  return out;
}

/** The words alone, for labels, alerts and anything shown unformatted. */
export const plainText = (source: string) => runsText(parseRich(source));

export const runsText = (runs: Run[]) => runs.map((r) => r.text).join("");

/** True when the string carries any formatting at all. */
export const hasFormatting = (source: string) => parseRich(source).some((r) => !isPlainStyle(r.style));

/* ---------------------------------------------------------------- writing */

const escape = (text: string) =>
  [...text].map((ch) => (SPECIAL.has(ch) ? `\\${ch}` : ch)).join("");

/**
 * Back to a string. Text without any formatting is stored exactly as typed,
 * so a plain title stays plain on the web app too.
 */
export function serializeRich(runs: Run[]): string {
  const merged = normalize(runs);
  const plain = runsText(merged);
  if (merged.every((r) => isPlainStyle(r.style)) && sameRuns(parseRich(plain), merged)) return plain;
  return merged
    .map(({ text, style }) => {
      let out = escape(text);
      for (const { key, mark } of [...MARKERS].reverse()) if (style[key]) out = `${mark}${out}${mark}`;
      return style.color ? `{${style.color}:${out}}` : out;
    })
    .join("");
}

function sameRuns(a: Run[], b: Run[]): boolean {
  return a.length === b.length && a.every((r, i) => r.text === b[i].text && sameStyle(r.style, b[i].style));
}

/* ---------------------------------------------------------------- editing */

/** The style of the character at an index, or {} past the ends. */
export function styleAt(runs: Run[], index: number): RichStyle {
  let pos = 0;
  for (const run of runs) {
    if (index < pos + run.text.length) return run.style;
    pos += run.text.length;
  }
  return {};
}

/** Cuts the runs at [start, end) and hands each piece to a function. */
function mapRange(runs: Run[], start: number, end: number, change: (run: Run) => Run | null): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const run of runs) {
    const from = pos;
    const to = pos + run.text.length;
    pos = to;
    if (to <= start || from >= end) {
      out.push(run);
      continue;
    }
    const a = Math.max(start, from) - from;
    const b = Math.min(end, to) - from;
    out.push({ text: run.text.slice(0, a), style: run.style });
    const middle = change({ text: run.text.slice(a, b), style: run.style });
    if (middle) out.push(middle);
    out.push({ text: run.text.slice(b), style: run.style });
  }
  return normalize(out);
}

/** Replaces [start, end) with text in one style — what typing does. */
export function replaceRange(runs: Run[], start: number, end: number, text: string, style: RichStyle): Run[] {
  const kept = mapRange(runs, start, end, () => null);
  const out: Run[] = [];
  let pos = 0;
  let placed = false;
  for (const run of kept) {
    const len = run.text.length;
    if (!placed && start <= pos + len) {
      const cut = start - pos;
      out.push({ text: run.text.slice(0, cut), style: run.style });
      out.push({ text, style });
      out.push({ text: run.text.slice(cut), style: run.style });
      placed = true;
    } else out.push(run);
    pos += len;
  }
  if (!placed) out.push({ text, style });
  return normalize(out);
}

/** Changes the style of [start, end), leaving its text alone. */
export function restyleRange(runs: Run[], start: number, end: number, patch: (style: RichStyle) => RichStyle): Run[] {
  return mapRange(runs, start, end, (run) => ({ text: run.text, style: clean(patch(run.style)) }));
}

/** Whether every character of [start, end) has a flag on. */
export function rangeHas(runs: Run[], start: number, end: number, key: ToggleKey): boolean {
  let pos = 0;
  let any = false;
  for (const run of runs) {
    const from = pos;
    const to = pos + run.text.length;
    pos = to;
    if (to <= start || from >= end) continue;
    any = true;
    if (!run.style[key]) return false;
  }
  return any;
}

/**
 * What changed between two versions of the words: the replaced range in the
 * old text and what took its place. Found from the common start and end, the
 * way a keystroke, a paste or an autocorrect changes a field.
 */
export function diffText(prev: string, next: string, caret?: number): { start: number; end: number; inserted: string } {
  let start = 0;
  const max = Math.min(prev.length, next.length);
  // When the caret is known, the edit cannot begin after it.
  const limit = caret === undefined ? max : Math.min(max, caret);
  while (start < limit && prev[start] === next[start]) start++;
  let tail = 0;
  while (
    tail < prev.length - start &&
    tail < next.length - start &&
    prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail++;
  }
  return { start, end: prev.length - tail, inserted: next.slice(start, next.length - tail) };
}
