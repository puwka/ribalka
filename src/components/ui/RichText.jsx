import { looksLikeHtml, plainTextToHtml, sanitizeRichHtml } from '../../lib/richText';
import './RichText.css';

/** Renders description: HTML from editor, or plain/legacy text with line breaks. */
export default function RichText({ value, className = '' }) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const classes = ['rich-text', className].filter(Boolean).join(' ');
  const html = looksLikeHtml(raw)
    ? sanitizeRichHtml(raw)
    : sanitizeRichHtml(plainTextToHtml(raw));

  if (!html) return null;

  return <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />;
}
