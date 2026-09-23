export default function AudioPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div data-testid="audio-placeholder" className={`bg-sand neu-inset grid place-items-center ${className}`}>
      <div className="bg-cream neu-raised-sm grid h-16 w-16 place-items-center rounded-2xl">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-olive-deep" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    </div>
  );
}
