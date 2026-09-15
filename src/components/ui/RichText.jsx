import { looksLikeHtml, sanitizeRichHtml } from '../../lib/richText';
import './RichText.css';

/** Renders description: HTML from editor, or plain text with line breaks. */
export default function RichText({ value, className = '' }) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const classes = ['rich-text', className].filter(Boolean).join(' ');

  if (!looksLikeHtml(raw)) {
    return (
      <div className={`${classes} rich-text--plain`}>
        {raw}
      </div>
    );
  }

  const html = sanitizeRichHtml(raw);
  if (!html) return null;

  return <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />;
}
