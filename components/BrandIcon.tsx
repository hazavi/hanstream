/** Soft icon tile adapted for HanStream from 21st.dev's Featured icons pattern. */
export function BrandIcon({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`brand-icon inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2 translate-x-px">
        <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
