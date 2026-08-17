/**
 * Selection and insertion helpers for the note editor's textarea.
 *
 * The editor is a plain <textarea> rather than a contenteditable, and these
 * helpers are why that stays workable. The stored value must be markdown
 * source, and a textarea's value *is* that source — no DOM-to-markdown
 * serializer sits between what the writer typed and what gets hashed onto a
 * chain permanently.
 */

/**
 * Inserts text at the current selection.
 *
 * Tries `execCommand("insertText")` first, and that is the whole point of
 * this function: it is the only way to make a programmatic edit join the
 * browser's NATIVE undo stack. Without it, pressing Ctrl+Z after clicking the
 * bold button either does nothing or reverts something the writer did much
 * earlier — a genuinely disorienting way to lose work.
 *
 * `setRangeText` is the fallback. It works everywhere but resets undo
 * history, so it is second choice, not first.
 */
export function insertAtSelection(el: HTMLTextAreaElement, text: string): void {
  el.focus();

  let inserted: boolean;
  try {
    inserted = document.execCommand("insertText", false, text);
  } catch {
    inserted = false;
  }

  if (!inserted) {
    const { selectionStart, selectionEnd } = el;
    el.setRangeText(text, selectionStart, selectionEnd, "end");
    // React listens for `input`, so the controlled value has to be told.
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** Trims a selection inward so trailing spaces stay outside the markers. */
function shrinkToWord(value: string, start: number, end: number): [number, number] {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(value[s]!)) s += 1;
  while (e > s && /\s/.test(value[e - 1]!)) e -= 1;
  return [s, e];
}

/**
 * Wraps or unwraps the selection in a marker pair.
 *
 * Three behaviours worth stating, because each fixes a specific annoyance:
 *
 *   * Already wrapped -> unwrap. The buttons toggle, which is what anyone
 *     who has used a text editor expects.
 *   * Empty selection -> insert the pair with the caret in the middle, so
 *     typing continues inside the mark.
 *   * Selection with surrounding whitespace -> shrink to the words first.
 *     `**word **` does not parse as bold in any markdown flavour, so
 *     wrapping the raw selection would produce visible asterisks instead of
 *     bold text.
 */
export function toggleWrap(el: HTMLTextAreaElement, marker: string): void {
  const value = el.value;
  const [start, end] = shrinkToWord(value, el.selectionStart, el.selectionEnd);
  const selected = value.slice(start, end);
  const len = marker.length;

  const wrappedOutside = value.slice(start - len, start) === marker && value.slice(end, end + len) === marker;
  const wrappedInside = selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= len * 2;

  if (wrappedOutside) {
    el.setSelectionRange(start - len, end + len);
    insertAtSelection(el, selected);
    el.setSelectionRange(start - len, end - len);
    return;
  }

  if (wrappedInside) {
    const inner = selected.slice(len, -len);
    el.setSelectionRange(start, end);
    insertAtSelection(el, inner);
    el.setSelectionRange(start, start + inner.length);
    return;
  }

  if (selected.length === 0) {
    insertAtSelection(el, marker + marker);
    const caret = el.selectionStart - len;
    el.setSelectionRange(caret, caret);
    return;
  }

  el.setSelectionRange(start, end);
  insertAtSelection(el, `${marker}${selected}${marker}`);
  // Reselect the inner text, not the markers, so a second click toggles off.
  el.setSelectionRange(start + len, start + len + selected.length);
}
