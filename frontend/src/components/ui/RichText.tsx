"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Bold, Italic, Palette, RemoveFormatting, Strikethrough, Underline, X } from "lucide-react";
import {
  diffText,
  isPlainStyle,
  parseRich,
  rangeHas,
  replaceRange,
  restyleRange,
  runsText,
  serializeRich,
  styleAt,
  type RichStyle,
  type Run,
  type ToggleKey,
} from "@/lib/richText";
import { TAG_COLORS, type TagColor } from "@/lib/types";

/**
 * The shade a coloured word is drawn in: the tag palette's text tones, a
 * touch stronger so a single word still reads in a sentence. Spelled out in
 * full so Tailwind sees the classes.
 */
const RUN_COLOR: Record<TagColor, string> = {
  gray: "text-stone-500 dark:text-stone-400",
  red: "text-red-600 dark:text-red-400",
  orange: "text-orange-600 dark:text-orange-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
  teal: "text-teal-600 dark:text-teal-400",
  sky: "text-sky-600 dark:text-sky-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  violet: "text-violet-600 dark:text-violet-400",
  pink: "text-pink-600 dark:text-pink-400",
};

/** The swatch of each colour in the formatting bar. */
const SWATCH: Record<TagColor, string> = {
  gray: "bg-stone-500 dark:bg-stone-400",
  red: "bg-red-600 dark:bg-red-400",
  orange: "bg-orange-600 dark:bg-orange-400",
  amber: "bg-amber-600 dark:bg-amber-400",
  green: "bg-emerald-600 dark:bg-emerald-400",
  teal: "bg-teal-600 dark:bg-teal-400",
  sky: "bg-sky-600 dark:bg-sky-400",
  indigo: "bg-indigo-600 dark:bg-indigo-400",
  violet: "bg-violet-600 dark:bg-violet-400",
  pink: "bg-pink-600 dark:bg-pink-400",
};

/** The classes one run is drawn with ("" for plain words). */
function runClass(style: RichStyle): string {
  const lines = [style.underline && "underline", style.strike && "line-through"].filter(Boolean);
  return [
    style.bold && "font-bold",
    style.italic && "italic",
    lines.length === 2 ? "[text-decoration-line:underline_line-through]" : lines[0],
    style.color && RUN_COLOR[style.color],
  ]
    .filter(Boolean)
    .join(" ");
}

/** A formatted string, drawn with its bold, italics, lines and colours. */
export function RichText({ source, className }: { source: string; className?: string }) {
  const runs = useMemo(() => parseRich(source), [source]);
  return (
    <span className={className}>
      {runs.map((run, i) =>
        isPlainStyle(run.style) ? (
          run.text
        ) : (
          <span key={i} className={runClass(run.style)}>
            {run.text}
          </span>
        ),
      )}
    </span>
  );
}

/* ------------------------------------------------------ the editable box */

type Selection = { start: number; end: number };

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The markup the box holds for some runs — compared with what is there. */
function runsHtml(runs: Run[]): string {
  return runs
    .map((run) => {
      const cls = runClass(run.style);
      return cls ? `<span class="${cls}">${escapeHtml(run.text)}</span>` : escapeHtml(run.text);
    })
    .join("");
}

/** The words in the box, as the browser left them after an edit. */
const boxText = (box: HTMLElement) => (box.textContent ?? "").replace(/ /g, " ").replace(/[\r\n]/g, "");

/** Where a DOM point falls in the box's words. */
function offsetOf(box: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(box);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** The selection as offsets in the words, or null when it is elsewhere. */
function readSelection(box: HTMLElement): Selection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;
  if (!box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) return null;
  const a = offsetOf(box, sel.anchorNode, sel.anchorOffset);
  const f = offsetOf(box, sel.focusNode, sel.focusOffset);
  return { start: Math.min(a, f), end: Math.max(a, f) };
}

/** The DOM point at an offset in the words. */
function pointAt(box: HTMLElement, offset: number): [Node, number] {
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  let left = offset;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const len = node.data.length;
    if (left <= len) return [node, left];
    left -= len;
    last = node;
  }
  return last ? [last, last.data.length] : [box, 0];
}

function placeSelection(box: HTMLElement, { start, end }: Selection) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const [sn, so] = pointAt(box, start);
  const [en, eo] = pointAt(box, end);
  range.setStart(sn, so);
  range.setEnd(en, eo);
  sel.removeAllRanges();
  sel.addRange(range);
}

const TOGGLES: { key: ToggleKey; label: string; shortcut: string; Icon: typeof Bold }[] = [
  { key: "bold", label: "Bold", shortcut: "Ctrl+B", Icon: Bold },
  { key: "italic", label: "Italic", shortcut: "Ctrl+I", Icon: Italic },
  { key: "strike", label: "Strikethrough", shortcut: "Ctrl+Shift+X", Icon: Strikethrough },
  { key: "underline", label: "Underline", shortcut: "Ctrl+U", Icon: Underline },
];

type Snapshot = { runs: Run[]; selection: Selection };

/**
 * A one-line text box whose words can be made bold, italic, struck,
 * underlined or coloured: select some text (or just place the cursor, for
 * what comes next) and press a button of the bar shown under it while it has
 * focus, or Ctrl+B / I / U / Shift+X. The value in and out is the stored
 * markup string; `maxLength` caps the words, and a note says when the
 * formatting makes the stored string too long — the same rules as the app.
 */
export function RichField({
  value,
  onChange,
  maxLength,
  placeholder,
  ariaLabel,
  autoFocus = false,
  onEnter,
  onEscape,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [runs, setRuns] = useState<Run[]>(() => parseRich(value));
  const [focused, setFocused] = useState(false);
  const [choosingColor, setChoosingColor] = useState(false);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  // A style picked with nothing selected: it applies to what is typed next, there.
  const [pending, setPending] = useState<{ at: number; style: RichStyle } | null>(null);
  // Read by the event handlers, which may fire before a render catches up.
  const runsRef = useRef(runs);
  const selRef = useRef(selection);
  const pendingRef = useRef(pending);
  const emitted = useRef(value);
  const composing = useRef(false);
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // A value set from outside (cleared after adding, say) replaces the text.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      const next = parseRich(value);
      runsRef.current = next;
      undoStack.current = [];
      redoStack.current = [];
      setRuns(next);
      setPending(null);
    }
  }, [value]);

  // Draws the runs into the box — only when what is there differs, so plain
  // typing and composing an accent are never disturbed — and puts the
  // cursor back where the edit left it.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const html = runsHtml(runs);
    if (box.innerHTML === html) return;
    box.innerHTML = html;
    if (document.activeElement === box) placeSelection(box, selRef.current);
  }, [runs]);

  useEffect(() => {
    if (!autoFocus) return;
    const box = boxRef.current;
    if (!box) return;
    box.focus();
    const end = runsText(runsRef.current).length;
    selRef.current = { start: end, end };
    placeSelection(box, selRef.current);
  }, [autoFocus]);

  // Follows the cursor, for the bar's state and the next edit.
  useEffect(() => {
    if (!focused) return;
    const onChangeSel = () => {
      const box = boxRef.current;
      const sel = box && readSelection(box);
      if (!sel) return;
      selRef.current = sel;
      setSelection(sel);
      const p = pendingRef.current;
      // The pending style only goes once the cursor leaves for elsewhere.
      if (p && (sel.start !== sel.end || sel.start < p.at)) setPending(null);
    };
    document.addEventListener("selectionchange", onChangeSel);
    return () => document.removeEventListener("selectionchange", onChangeSel);
  }, [focused]);

  /**
   * The selection right now: read from the box, since selectionchange only
   * arrives a moment after a key has moved the cursor.
   */
  function liveSelection(): Selection {
    const box = boxRef.current;
    const sel = box && readSelection(box);
    if (sel) selRef.current = sel;
    return selRef.current;
  }

  const commit = useCallback(
    (next: Run[], nextSel: Selection, remember = true) => {
      if (remember) {
        undoStack.current.push({ runs: runsRef.current, selection: selRef.current });
        if (undoStack.current.length > 100) undoStack.current.shift();
        redoStack.current = [];
      }
      runsRef.current = next;
      selRef.current = nextSel;
      setRuns(next);
      setSelection(nextSel);
      const out = serializeRich(next);
      emitted.current = out;
      onChange(out);
    },
    [onChange],
  );

  /** Reads what the browser changed in the box and folds it into the runs. */
  function handleInput() {
    const box = boxRef.current;
    if (!box || composing.current) return;
    const current = runsRef.current;
    const prev = runsText(current);
    const next = boxText(box);
    if (next === prev) {
      // Same words, other markup (a stray <br>, say): draw it back clean.
      if (box.innerHTML !== runsHtml(current)) {
        box.innerHTML = runsHtml(current);
        placeSelection(box, selRef.current);
      }
      return;
    }
    const caret = readSelection(box);
    const { start, end, inserted } = diffText(prev, next, caret?.end);
    let text = inserted;
    if (maxLength !== undefined) {
      // The words alone can never be longer than what is stored.
      const room = maxLength - (prev.length - (end - start));
      text = text.slice(0, Math.max(0, room));
    }
    const p = pendingRef.current;
    const style =
      p && p.at === start && start === end
        ? p.style
        : start < end
          ? styleAt(current, start)
          : start > 0
            ? styleAt(current, start - 1)
            : styleAt(current, 0);
    setPending(null);
    const at = start + text.length;
    const updated = replaceRange(current, start, end, text, style);
    if (text !== inserted) {
      // Cut to fit: the box shows more than was kept, so redraw it now.
      box.innerHTML = runsHtml(updated);
      placeSelection(box, { start: at, end: at });
    }
    commit(updated, { start: at, end: at });
  }

  function restore(from: Snapshot[], to: Snapshot[]) {
    const snap = from.pop();
    if (!snap) return;
    to.push({ runs: runsRef.current, selection: liveSelection() });
    commit(snap.runs, snap.selection, false);
  }
  const undo = () => restore(undoStack.current, redoStack.current);
  const redo = () => restore(redoStack.current, undoStack.current);

  // Browser formatting and its own undo would bypass the runs (a native
  // listener: React's onBeforeInput carries no inputType).
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onBefore = (e: InputEvent) => {
      const type = e.inputType;
      if (type.startsWith("format") || type.startsWith("history") || type === "insertParagraph" || type === "insertLineBreak") {
        e.preventDefault();
        if (type === "historyUndo") undoRef.current();
        if (type === "historyRedo") redoRef.current();
      }
    };
    box.addEventListener("beforeinput", onBefore);
    return () => box.removeEventListener("beforeinput", onBefore);
  }, []);

  const sel = selection;
  const collapsed = sel.start === sel.end;
  const caretStyle = pending && pending.at === sel.start ? pending.style : styleAt(runs, sel.start - 1);
  const isOn = (key: ToggleKey) => (collapsed ? !!caretStyle[key] : rangeHas(runs, sel.start, sel.end, key));
  const activeColor = collapsed ? caretStyle.color : styleAt(runs, sel.start).color;

  function restyle(patch: (style: RichStyle) => RichStyle) {
    const s = liveSelection();
    if (s.start === s.end) {
      const p = pendingRef.current;
      const base = p && p.at === s.start ? p.style : styleAt(runsRef.current, s.start - 1);
      const next = { at: s.start, style: patch(base) };
      pendingRef.current = next;
      setPending(next);
      return;
    }
    commit(restyleRange(runsRef.current, s.start, s.end, patch), s);
  }

  const toggle = (key: ToggleKey) => {
    const s = liveSelection();
    const p = pendingRef.current;
    const on =
      s.start === s.end
        ? !(p && p.at === s.start ? p.style : styleAt(runsRef.current, s.start - 1))[key]
        : !rangeHas(runsRef.current, s.start, s.end, key);
    restyle((style) => ({ ...style, [key]: on }));
  };
  const paint = (color: TagColor | undefined) => {
    restyle((style) => ({ ...style, color }));
    setChoosingColor(false);
  };
  const clear = () => restyle(() => ({}));

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter?.();
      return;
    }
    if (e.key === "Escape") {
      if (choosingColor) setChoosingColor(false);
      else onEscape?.();
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const shortcut: Record<string, () => void> = {
      b: () => toggle("bold"),
      i: () => toggle("italic"),
      u: () => toggle("underline"),
      z: () => (e.shiftKey ? redo() : undo()),
      y: redo,
    };
    if (e.shiftKey && k === "x") {
      e.preventDefault();
      toggle("strike");
    } else if (shortcut[k] && (!e.shiftKey || k === "z")) {
      e.preventDefault();
      shortcut[k]();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    // Words only, on one line: whatever formatting they came with is dropped.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\s*[\r\n]+\s*/g, " ");
    if (text) document.execCommand("insertText", false, text);
  }

  const stored = serializeRich(runs).length;
  const over = maxLength !== undefined && stored > maxLength;

  return (
    <div className="min-w-0 flex-1">
      <div
        ref={boxRef}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-placeholder={placeholder}
        aria-multiline={false}
        data-placeholder={placeholder}
        spellCheck
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          handleInput();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setChoosingColor(false);
        }}
        className={`field cursor-text whitespace-pre-wrap break-words empty:before:pointer-events-none empty:before:text-ink-faint empty:before:content-[attr(data-placeholder)] ${className}`}
      />
      {focused && (
        <div
          // Pressing the bar must not take the focus (and the selection) away.
          onMouseDown={(e) => e.preventDefault()}
          className="mt-1.5 flex flex-wrap items-center gap-0.5 rounded-lg bg-surface-sunken p-1"
          role="toolbar"
          aria-label="Formatting"
        >
          {choosingColor ? (
            <>
              <ToolButton label="Default colour" onPress={() => paint(undefined)} active={!activeColor}>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-ink" />
              </ToolButton>
              {TAG_COLORS.map((name) => (
                <ToolButton key={name} label={`Colour ${name}`} onPress={() => paint(name)} active={activeColor === name}>
                  <span className={`h-3.5 w-3.5 rounded-full ${SWATCH[name]}`} />
                </ToolButton>
              ))}
              <ToolButton label="Close colours" onPress={() => setChoosingColor(false)}>
                <X size={15} />
              </ToolButton>
            </>
          ) : (
            <>
              {TOGGLES.map(({ key, label, shortcut, Icon }) => (
                <ToolButton key={key} label={label} title={`${label} (${shortcut})`} onPress={() => toggle(key)} active={isOn(key)}>
                  <Icon size={15} strokeWidth={isOn(key) ? 2.75 : 2} />
                </ToolButton>
              ))}
              <ToolButton label="Text colour" onPress={() => setChoosingColor(true)} active={!!activeColor}>
                <Palette size={15} className={activeColor ? RUN_COLOR[activeColor] : undefined} />
              </ToolButton>
              <ToolButton label="Clear formatting" onPress={clear}>
                <RemoveFormatting size={15} />
              </ToolButton>
              <span className="ml-auto pr-1.5 text-[11px] tabular-nums text-ink-faint">
                {collapsed ? "Select text to format it" : `${sel.end - sel.start} selected`}
              </span>
            </>
          )}
        </div>
      )}
      {over && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Too long with its formatting ({stored}/{maxLength}) — shorten it or remove some styles.
        </p>
      )}
    </div>
  );
}

/** One square button of the formatting bar, tinted while its style is on. */
function ToolButton({
  label,
  title,
  onPress,
  active = false,
  children,
}: {
  label: string;
  title?: string;
  onPress: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-line hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
