import './ScenicRidge.css';

/** Flat watercolour ridge used as a calm scenic footer inside light sheets. */
export default function ScenicRidge({ className = '', tone = 'blue' }) {
  return (
    <div className={`scenic-ridge scenic-ridge--${tone} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 1440 220" preserveAspectRatio="none" focusable="false">
        <path
          className="scenic-ridge__far"
          d="M0 150C120 110 210 132 312 100c108-34 168-70 260-46 98 26 152 76 246 62 90-14 140-56 234-40 96 16 168 64 246 48 46-10 92-20 142-44v140H0Z"
        />
        <path
          className="scenic-ridge__mid"
          d="M0 178c96-46 190-24 286-44 94-20 168-58 264-38 96 20 162 58 258 44 100-14 154-50 250-30 94 20 156 50 242 32 48-10 88-16 140-34v112H0Z"
        />
        <path
          className="scenic-ridge__near"
          d="M0 198c116-32 214-20 314-6 120 18 188 4 292-4 98-8 166 12 260 6 110-6 180-26 284-8 104 18 186 26 290 2v32H0Z"
        />
        <g className="scenic-ridge__trees">
          <path d="M118 176l12-30 12 30h-7v10h-10v-10Z" />
          <path d="M145 181l9-23 9 23h-5v8h-8v-8Z" />
          <path d="M1120 170l14-34 14 34h-8v12h-12v-12Z" />
          <path d="M1152 176l10-25 10 25h-6v9h-8v-9Z" />
          <path d="M1237 182l8-20 8 20h-5v7h-6v-7Z" />
        </g>
      </svg>
    </div>
  );
}
