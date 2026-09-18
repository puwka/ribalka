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
    compact === '<p></p>' ||
    compact === '<div></div>'
  );
}

const BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'DIV', 'BLOCKQUOTE']);

function hasBlockChild(el) {
  return [...el.childNodes].some(
    (n) => n.nodeType === 1 && BLOCK_TAGS.has(n.tagName)
  );
}

/** Keep a real paragraph so typing/deleting always works without toolbar. */
function ensureEditorStructure(el) {
  if (!el) return null;

  if (isBlankEditorHtml(el.innerHTML)) {
    el.innerHTML = '<p><br></p>';
    return el.querySelector('p');
  }

  // Loose text / only <br> at root → wrap into paragraph
  if (!hasBlockChild(el)) {
    const html = el.innerHTML.trim() || '<br>';
    el.innerHTML = `<p>${html}</p>`;
  }

  // Empty <p></p> blocks need a <br> or caret disappears in some browsers
  el.querySelectorAll('p, h2, h3').forEach((block) => {
    if (!block.innerHTML || block.innerHTML === '') {
      block.innerHTML = '<br>';
    }
  });

  return el.querySelector('p, h2, h3, li') || el;
}

function placeCaretInEmptyEditor(el) {
  const block = ensureEditorStructure(el);
  if (!block) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (block.firstChild?.nodeName === 'BR') {
    range.setStartBefore(block.firstChild);
  } else if (block.childNodes.length) {
    range.selectNodeContents(block);
    range.collapse(false);
  } else {
    range.setStart(block, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function caretInside(el) {
  const sel = window.getSelection?.();
  if (!sel?.anchorNode || !el) return false;
  return el === sel.anchorNode || el.contains(sel.anchorNode);
}

/**
 * Simple WYSIWYG for admin/owner description fields.
 * Always maintains an editable paragraph — no need to press «Абзац» to type.
 */
export default function RichTextEditor({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Текст описания…',
  minHeight = 160,
  /** Extended toolbar: headings, underline, link — for news articles */
  variant = 'basic',
}) {
  const ref = useRef(null);
  const focused = useRef(false);
  const extended = variant === 'extended';

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
    if (el.innerHTML !== next) {
      el.innerHTML = next;
      ensureEditorStructure(el);
    }
  }, [value]);

  const emit = () => {
    if (!ref.current || !onChange) return;
    ensureEditorStructure(ref.current);
    onChange(normalizeRichHtml(ref.current.innerHTML));
  };

  const prepare = () => {
    const el = ref.current;
    if (!el || disabled) return null;
    el.focus();
    ensureEditorStructure(el);
    if (!caretInside(el) || isBlankEditorHtml(el.innerHTML)) {
      placeCaretInEmptyEditor(el);
    }
    return el;
  };

  const run = (command, arg = null) => (e) => {
    e.preventDefault();
    if (disabled) return;
    const el = prepare();
    if (!el) return;
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, arg || 'p');
    } else if (command === 'createLink') {
      const url = window.prompt('Ссылка (https://…)', 'https://');
      if (!url || !/^https?:\/\//i.test(url.trim())) return;
      document.execCommand('createLink', false, url.trim());
    } else {
      document.execCommand(command, false, arg);
    }
    ensureEditorStructure(el);
    emit();
  };

  const handleFocus = () => {
    focused.current = true;
    prepare();
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const wasBlank = isBlankEditorHtml(el.innerHTML);
    ensureEditorStructure(el);
    if (wasBlank || isBlankEditorHtml(el.innerHTML)) {
      placeCaretInEmptyEditor(el);
    }
    emit();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    // Always keep structure before typing / deleting
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Enter' ||
      (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
    ) {
      ensureEditorStructure(el);
      if (!caretInside(el)) {
        placeCaretInEmptyEditor(el);
      }
    }

    // After clearing everything, restore empty paragraph so next key works
    if (e.key === 'Backspace' || e.key === 'Delete') {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        if (isBlankEditorHtml(ref.current.innerHTML) || !String(ref.current.textContent || '').trim()) {
          ensureEditorStructure(ref.current);
          placeCaretInEmptyEditor(ref.current);
        }
      });
    }
  };

  return (
    <div
      className={`rich-editor${disabled ? ' is-disabled' : ''}${extended ? ' rich-editor--extended' : ''}`}
    >
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Форматирование">
        <ToolbarButton label="Ж" title="Жирный" onMouseDown={run('bold')} />
        <ToolbarButton label="К" title="Курсив" onMouseDown={run('italic')} />
        {extended ? (
          <ToolbarButton label="Ч" title="Подчёркнутый" onMouseDown={run('underline')} />
        ) : null}
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
        {extended ? (
          <>
            <span className="rich-editor__sep" />
            <ToolbarButton
              label="Обычный текст"
              title="Убрать заголовок, обычный абзац"
              onMouseDown={run('formatBlock', 'p')}
            />
            <ToolbarButton label="H2" title="Подзаголовок" onMouseDown={run('formatBlock', 'h2')} />
            <ToolbarButton label="H3" title="Мелкий заголовок" onMouseDown={run('formatBlock', 'h3')} />
            <span className="rich-editor__sep" />
            <ToolbarButton label="Ссылка" title="Вставить ссылку" onMouseDown={run('createLink')} />
            <ToolbarButton
              label="Очистить"
              title="Убрать форматирование"
              onMouseDown={run('removeFormat')}
            />
          </>
        ) : null}
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
        onMouseDown={() => {
          // Ensure structure before browser places caret
          if (disabled) return;
          const el = ref.current;
          if (!el) return;
          if (isBlankEditorHtml(el.innerHTML) || !hasBlockChild(el)) {
            ensureEditorStructure(el);
          }
        }}
        onClick={() => {
          if (disabled) return;
          const el = ref.current;
          if (!el) return;
          ensureEditorStructure(el);
          if (isBlankEditorHtml(el.innerHTML) || !caretInside(el)) {
            placeCaretInEmptyEditor(el);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          focused.current = false;
          emit();
        }}
        onInput={handleInput}
      />
      <p className="rich-editor__hint">
        {extended
          ? 'Кликните в поле и пишите. Enter — новый абзац. Можно выделить текст и оформить (жирный, списки, заголовки, ссылки).'
          : 'Кликните в поле и сразу пишите или удаляйте текст. Enter — новый абзац. Выделите текст, чтобы сделать жирным, курсивом или списком.'}
      </p>
    </div>
  );
}
