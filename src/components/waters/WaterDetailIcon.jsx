const ICONS = {
  pin: (
    <>
      <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </>
  ),
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10h17" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  chat: (
    <path d="M20.5 11.5a7.5 7.5 0 0 1-10.8 6.7L4 20l1.8-5.6A7.5 7.5 0 1 1 20.5 11.5Z" />
  ),
  bath: (
    <>
      <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z" />
      <path d="M6 12V6.5A2.5 2.5 0 0 1 8.5 4h1A2.5 2.5 0 0 1 12 6.5V7" />
      <path d="M7 19v2M17 19v2M8 8.5c.8-.7 1.7-.7 2.5 0M13 8.5c.8-.7 1.7-.7 2.5 0" />
    </>
  ),
  car: (
    <>
      <path d="m5 16-1 2v2h2l1-2h10l1 2h2v-2l-1-2" />
      <path d="M4 16h16l-1.5-5.5A2 2 0 0 0 16.6 9H7.4a2 2 0 0 0-1.9 1.5L4 16Z" />
      <circle cx="7.5" cy="16" r="1.5" />
      <circle cx="16.5" cy="16" r="1.5" />
    </>
  ),
  fish: (
    <>
      <path d="M4 12c3-4 7-6 12-5 1.3.3 2.6.9 4 2-1.4 1.1-2.7 1.7-4 2-5 1-9-1-12-1Z" />
      <path d="M6 10c1.5 2 1.5 4 0 6" />
      <circle cx="16" cy="11" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  wifi: (
    <>
      <path d="M3.5 9a13 13 0 0 1 17 0" />
      <path d="M6.5 12.5a8.5 8.5 0 0 1 11 0" />
      <path d="M9.5 16a4 4 0 0 1 5 0" />
      <circle cx="12" cy="19" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M15.5 14.3A4.4 4.4 0 0 1 20.5 18" />
    </>
  ),
  home: (
    <>
      <path d="m3.5 11 8.5-7 8.5 7" />
      <path d="M5.5 10v10h13V10" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4c-8.5 0-14 4.4-14 10.5A5.5 5.5 0 0 0 11.5 20C17.6 20 20 14.5 20 4Z" />
      <path d="M4 20c2.5-5.5 6.5-9.5 12-12" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.4 2" />
    </>
  ),
  phone: (
    <path d="M7.5 3.5 10 8 8 9.7a14 14 0 0 0 6.3 6.3l1.7-2 4.5 2.5-1 3a2 2 0 0 1-2.2 1.2C9.6 19.8 4.2 14.4 3.3 6.7A2 2 0 0 1 4.5 4.5l3-1Z" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.3 2.5 3.4 5.5 3.4 9S14.3 18.5 12 21c-2.3-2.5-3.4-5.5-3.4-9S9.7 5.5 12 3Z" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5M9 12h6M9 15.5h6" />
    </>
  ),
  images: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 5-5 3 3 2-2 4 4" />
    </>
  ),
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  map: (
    <>
      <path d="m3.5 6.5 5-2 7 2 5-2v13l-5 2-7-2-5 2v-13Z" />
      <path d="M8.5 4.5v13M15.5 6.5v13" />
    </>
  ),
  arrowRight: <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />,
  chevronRight: <path d="m9 5.5 6.5 6.5L9 18.5" />,
  chevronDown: <path d="m5.5 9 6.5 6.5L18.5 9" />,
  heart: (
    <path d="M20.4 8.6c0 4.4-8.4 10-8.4 10s-8.4-5.6-8.4-10A4.7 4.7 0 0 1 12 5.7a4.7 4.7 0 0 1 8.4 2.9Z" />
  ),
  video: (
    <>
      <rect x="3" y="6" width="12" height="12" rx="2.5" />
      <path d="m15 10 6-3v10l-6-3" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10a2.5 2.5 0 0 0 2.5-2.5V3M7 10v11" />
      <path d="M16 3c-1.8 1.7-2.5 3.7-2.5 6.5V13H18V3M16 13v8" />
    </>
  ),
  waves: (
    <>
      <path d="M3 8c2 0 2.5-1.5 4.5-1.5S10 8 12 8s2.5-1.5 4.5-1.5S19 8 21 8" />
      <path d="M3 12c2 0 2.5-1.5 4.5-1.5S10 12 12 12s2.5-1.5 4.5-1.5S19 12 21 12" />
      <path d="M3 16c2 0 2.5-1.5 4.5-1.5S10 16 12 16s2.5-1.5 4.5-1.5S19 16 21 16" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </>
  ),
};

export default function WaterDetailIcon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] || ICONS.check}
    </svg>
  );
}
