import { useRef, useState } from 'react';
import './ForumEmojiTextarea.css';

const EMOJI_GROUPS = [
  {
    title: 'Частые',
    items: ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔', '😅', '😢', '😡', '👍', '👎', '👏', '🙏', '🔥', '❤️', '💪'],
  },
  {
    title: 'Рыбалка',
    items: ['🎣', '🐟', '🐠', '🐡', '🦐', '🦀', '🦞', '🌊', '🏞️', '⛺', '🛶', '🚤', '☀️', '🌧️', '❄️', '🍺', '📸', '⭐'],
  },
];

/**
 * Textarea with an emoji picker that inserts at the caret.
 */
export default function ForumEmojiTextarea({
  value = '',
  onChange,
  rows = 4,
  required = false,
  placeholder = '',
  disabled = false,
  id,
}) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  const insertEmoji = (emoji) => {
    const el = ref.current;
    const current = String(value ?? '');
    if (!el) {
      onChange?.(current + emoji);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    onChange?.(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* ignore */
      }
    });
  };

  return (
    <div className="forum-emoji">
      <textarea
        ref={ref}
        id={id}
        required={required}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <div className="forum-emoji__bar">
        <button
          type="button"
          className={`forum-emoji__toggle${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-label="Смайлики"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          😊 Смайлики
        </button>
      </div>
      {open ? (
        <div className="forum-emoji__panel" role="listbox" aria-label="Выбор смайлика">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.title} className="forum-emoji__group">
              <div className="forum-emoji__group-title">{group.title}</div>
              <div className="forum-emoji__grid">
                {group.items.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="forum-emoji__btn"
                    onClick={() => insertEmoji(emoji)}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
