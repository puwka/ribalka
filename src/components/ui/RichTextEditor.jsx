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
    const el = ref.current;
    if (!el || focused.current) return;
    const next = toEditorHtml(value);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const emit = () => {
    if (!ref.current || !onChange) return;
    onChange(normalizeRichHtml(ref.current.innerHTML));
  };

  const run = (command, value = null) => (e) => {
    e.preventDefault();
    if (disabled) return;
    ref.current?.focus();
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, value || 'p');
    } else {
      document.execCommand(command, false, value);
    }
    emit();
  };

  return (
    <div className={`rich-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Форматирование">
        <ToolbarButton label="Ж" title="Жирный" onMouseDown={run('bold')} />
        <ToolbarButton label="К" title="Курсив" onMouseDown={run('italic')} />
        <span className="rich-editor__sep" />
        <ToolbarButton label="• Список" title="Маркированный список" onMouseDown={run('insertUnorderedList')} />
        <ToolbarButton label="1. Список" title="Нумерованный список" onMouseDown={run('insertOrderedList')} />
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
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          emit();
        }}
        onInput={emit}
      />
      <p className="rich-editor__hint">
        Enter — новый абзац. Можно выделять текст и делать жирным, курсивом или списком.
      </p>
    </div>
  );
}
