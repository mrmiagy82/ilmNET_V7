export function Mark({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const line = tone === 'light' ? '#26241f' : '#fff7eb';
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {/* abstract open book — a neutral mark of a curated library */}
      <path
        d="M20 12.5C16.2 9.8 11.2 9.2 7.5 10.6V31.2C11.2 29.8 16.2 30.4 20 33.1Z"
        fill="#a2ab73"
        stroke={line}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M20 12.5C23.8 9.8 28.8 9.2 32.5 10.6V31.2C28.8 29.8 23.8 30.4 20 33.1Z"
        fill="#8b9560"
        stroke={line}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="21.5" r="2.5" fill="#cc3a63" />
    </svg>
  );
}

export function Wordmark({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span
      className={`font-display text-[1.35rem] leading-none font-extrabold tracking-[-0.045em] ${
        tone === 'light' ? 'text-ink' : 'text-cream'
      } ${className}`}
    >
      ilm<span className={tone === 'light' ? 'text-olive-deep' : 'text-olive'}>Net</span>
    </span>
  );
}
