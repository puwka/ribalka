import { useEffect, useRef, useState } from 'react';
import { normalizeRichHtml, toEditorHtml } from '../../lib/richText';
import './RichTextEditor.css';

function ToolbarButton({ label, title, onMouseDown, active = false }) {
  return (
    <button
      type="button"
      className={`rich-editor__btn${active ? ' is-active' : ''}`}
      title={title}
      aria-pressed={active}
      onMouseDown={onMouseDown}
    >
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
  return [...el.childNodes].some((n) => n.nodeType === 1 && BLOCK_TAGS.has(n.tagName));
}

/** Keep a real paragraph so typing/deleting always works without toolbar. */
function ensureEditorStructure(el) {
  if (!el) return null;

  if (isBlankEditorHtml(el.innerHTML)) {
    el.innerHTML = '<p><br></p>';
    return el.querySelector('p');
  }

  if (!hasBlockChild(el)) {
    const html = el.innerHTML.trim() || '<br>';
    el.innerHTML = `<p>${html}</p>`;
  }

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

function closestBlock(node, root) {
  let cur = node?.nodeType === 3 ? node.parentElement : node;
  while (cur && cur !== root) {
    if (BLOCK_TAGS.has(cur.tagName) && cur.tagName !== 'LI') return cur;
    if (cur.tagName === 'LI') return cur;
    cur = cur.parentElement;
  }
  return null;
}

function currentBlockTag(root) {
  const sel = window.getSelection?.();
  if (!sel?.anchorNode || !root) return 'P';
  const block = closestBlock(sel.anchorNode, root);
  if (!block) return 'P';
  if (block.tagName === 'LI') {
    const list = block.closest('ul, ol');
    return list?.tagName || 'LI';
  }
  return block.tagName;
}

/**
 * Apply block format. Browsers disagree on formatBlock arg (`h2` vs `<h2>`),
 * so we try both and fall back to replace the current block element.
 */
function applyFormatBlock(root, tagName) {
  const tag = String(tagName || 'p').toLowerCase().replace(/[<>]/g, '');
  const tries = [tag, `<${tag}>`, tag.toUpperCase(), `<${tag.toUpperCase()}>`];
  for (const arg of tries) {
    try {
      if (document.execCommand('formatBlock', false, arg)) {
        // Verify it stuck (some browsers return true but wrap in div)
        const now = currentBlockTag(root);
        if (now.toLowerCase() === tag || (tag === 'p' && (now === 'P' || now === 'DIV'))) {
          return true;
        }
      }
    } catch {
      /* try next */
    }
  }

  const sel = window.getSelection?.();
  if (!sel?.rangeCount) return false;
  const block = closestBlock(sel.anchorNode, root);
  if (!block || block === root) return false;
  if (block.tagName === 'LI') {
    // Convert list item text to heading after the list
    const heading = document.createElement(tag);
    heading.innerHTML = block.innerHTML || '<br>';
    const list = block.closest('ul, ol');
    if (list?.parentNode) {
      list.parentNode.insertBefore(heading, list.nextSibling);
      block.remove();
      if (!list.querySelector('li')) list.remove();
    }
    return true;
  }

  const next = document.createElement(tag);
  next.innerHTML = block.innerHTML || '<br>';
  block.replaceWith(next);
  const range = document.createRange();
  range.selectNodeContents(next);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
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
  const [, setTick] = useState(0);
  const extended = variant === 'extended';
  const activeBlock = (() => {
    try {
      return currentBlockTag(ref.current);
    } catch {
      return 'P';
    }
  })();

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

  const refreshToolbar = () => setTick((n) => n + 1);

  const emit = () => {
    if (!ref.current || !onChange) return;
    ensureEditorStructure(ref.current);
    onChange(normalizeRichHtml(ref.current.innerHTML));
    refreshToolbar();
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
    e.stopPropagation();
    if (disabled) return;
    const el = prepare();
    if (!el) return;
    if (command === 'formatBlock') {
      applyFormatBlock(el, arg || 'p');
    } else if (command === 'createLink') {
      const url = window.prompt('Ссылка (https://…)', 'https://');
      if (!url || !/^https?:\/\//i.test(url.trim())) return;
      document.execCommand('createLink', false, url.trim());
    } else {
      document.execCommand(command, false, arg);
    }
    ensureEditorStructure(el);
    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      if (!caretInside(el) || isBlankEditorHtml(el.innerHTML)) {
        placeCaretInEmptyEditor(el);
      }
    }
    emit();
  };

  const handleFocus = () => {
    focused.current = true;
    prepare();
    refreshToolbar();
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const wasBlank = isBlankEditorHtml(el.innerHTML);
    ensureEditorStructure(el);
    if (wasBlank) {
      placeCaretInEmptyEditor(el);
    }
    emit();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        const html = ref.current.innerHTML;
        const text = String(ref.current.textContent || '').trim();
        if (isBlankEditorHtml(html) || !text) {
          ensureEditorStructure(ref.current);
          placeCaretInEmptyEditor(ref.current);
        }
        refreshToolbar();
      });
    } else {
      requestAnimationFrame(refreshToolbar);
    }
  };

  const isH2 = activeBlock === 'H2';
  const isH3 = activeBlock === 'H3';
  const isP = activeBlock === 'P' || activeBlock === 'DIV';

  return (
    <div
      className={`rich-editor${disabled ? ' is-disabled' : ''}${extended ? ' rich-editor--extended' : ''}`}
      onMouseDown={(e) => {
        if (e.target.closest('.rich-editor__toolbar')) {
          e.preventDefault();
        }
      }}
    >
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Форматирование">
        <ToolbarButton label="Ж" title="Жирный" onMouseDown={run('bold')} />
        <ToolbarButton label="К" title="Курсив" onMouseDown={run('italic')} />
        {extended ? (
          <ToolbarButton label="Ч" title="Подчёркнутый" onMouseDown={run('underline')} />
        ) : null}
        <span className="rich-editor__sep" />
        <ToolbarButton
          label="Текст"
          title="Обычный абзац"
          active={isP && extended}
          onMouseDown={run('formatBlock', 'p')}
        />
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
              label="Заголовок"
              title="Крупный подзаголовок (H2)"
              active={isH2}
              onMouseDown={run('formatBlock', 'h2')}
            />
            <ToolbarButton
              label="Подзаголовок"
              title="Мелкий заголовок (H3)"
              active={isH3}
              onMouseDown={run('formatBlock', 'h3')}
            />
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
        onMouseUp={refreshToolbar}
        onKeyUp={refreshToolbar}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (disabled) return;
          const el = ref.current;
          if (!el) return;
          if (isBlankEditorHtml(el.innerHTML) || !hasBlockChild(el)) {
            ensureEditorStructure(el);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          const el = ref.current;
          if (!el) return;
          ensureEditorStructure(el);
          if (isBlankEditorHtml(el.innerHTML) || !caretInside(el)) {
            placeCaretInEmptyEditor(el);
          }
          refreshToolbar();
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
          ? 'Выделите строку и нажмите «Заголовок» или «Подзаголовок» — в тексте они крупнее обычного абзаца. Enter — новый абзац.'
          : 'Кликните в поле и сразу пишите. Enter — новый абзац. Кнопка «Текст» возвращает обычный абзац, если список мешает набору.'}
      </p>
    </div>
  );
}
