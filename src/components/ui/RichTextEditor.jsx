import { useEffect, useRef } from 'react';
import { normalizeRichHtml, toEditorHtml } from '../../lib/richText';
import './RichTextEditor.css';

function ToolbarButton({ label, title, onMouseDown }) {
  return (
    <button type="button" className="rich-editor__btn" title={title} onMouseDown={onMouseDown}>
      {label}
    </button>
  );
}

function isBlankEditorHtml(html) {
  const compact = String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
  return (
    !compact ||
    compact === '<br>' ||
    compact === '<br/>' ||
    compact === '<div><br></div>' ||
    compact === '<div><br/></div>' ||
    compact === '<p><br></p>' ||
    compact === '<p><br/></p>' ||
    compact === '<p></p>'
  );
}

function ensureEditableParagraph(el) {
  if (!el) return null;
  if (isBlankEditorHtml(el.innerHTML)) {
    el.innerHTML = '<p><br></p>';
  }
  return el.querySelector('p') || el;
}

function placeCaretInEditor(el) {
  const block = ensureEditableParagraph(el);
  if (!block || typeof window === 'undefined') return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (block.firstChild?.nodeName === 'BR') {
    range.setStartBefore(block.firstChild);
  } else if (block.firstChild) {
    range.setStart(block.firstChild, 0);
  } else {
    range.setStart(block, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Simple WYSIWYG for admin/owner description fields.
 * Stores sanitized HTML; plain text with newlines is converted on load.
 */
export default function RichTextEditor({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Текст описания…',
  minHeight = 160,
}) {
  const ref = useRef(null);
  const focused = useRef(false);

  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    const next = toEditorHtml(value);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const emit = () => {
    if (!ref.current || !onChange) return;
    onChange(normalizeRichHtml(ref.current.innerHTML));
  };

  const run = (command, arg = null) => (e) => {
    e.preventDefault();
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    ensureEditableParagraph(el);
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, arg || 'p');
    } else {
      document.execCommand(command, false, arg);
    }
    emit();
  };

  const handleFocus = () => {
    focused.current = true;
    const el = ref.current;
    if (!el || disabled) return;
    ensureEditableParagraph(el);
    // If caret is not inside the editor yet, put it in the first paragraph.
    const sel = window.getSelection();
    const anchorInEditor = sel?.anchorNode && el.contains(sel.anchorNode);
    if (!anchorInEditor || isBlankEditorHtml(el.innerHTML)) {
      placeCaretInEditor(el);
    }
  };

  return (
    <div className={`rich-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Форматирование">
        <ToolbarButton label="Ж" title="Жирный" onMouseDown={run('bold')} />
        <ToolbarButton label="К" title="Курсив" onMouseDown={run('italic')} />
        <span className="rich-editor__sep" />
        <ToolbarButton
          label="• Список"
          title="Маркированный список"
          onMouseDown={run('insertUnorderedList')}
        />
        <ToolbarButton
          label="1. Список"
          title="Нумерованный список"
          onMouseDown={run('insertOrderedList')}
        />
        <span className="rich-editor__sep" />
        <ToolbarButton label="Абзац" title="Обычный абзац" onMouseDown={run('formatBlock', 'p')} />
      </div>
      <div
        ref={ref}
        className="rich-editor__area"
        style={{ minHeight }}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onFocus={handleFocus}
        onClick={() => {
          if (disabled) return;
          const el = ref.current;
          if (!el) return;
          if (isBlankEditorHtml(el.innerHTML)) placeCaretInEditor(el);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const el = ref.current;
          if (!el) return;
          // First printable key in an empty editor — guarantee a paragraph block.
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            ensureEditableParagraph(el);
          }
        }}
        onBlur={() => {
          focused.current = false;
          emit();
        }}
        onInput={emit}
      />
      <p className="rich-editor__hint">
        Просто начните печатать. Enter — новый абзац; можно выделить текст и сделать жирным,
        курсивом или списком.
      </p>
    </div>
  );
}
