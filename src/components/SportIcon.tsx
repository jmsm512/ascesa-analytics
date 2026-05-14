export function HockeyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <ellipse cx="12" cy="13" rx="8" ry="3.2" />
      <path d="M4 13v2c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2v-2" />
    </svg>
  );
}

export function FencingIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 21L14 10" />
      <path d="M14 10l3-3 4 4-3 3" />
      <circle cx="20" cy="14" r="1.2" fill="currentColor" />
      <path d="M14 10l-2-2" />
    </svg>
  );
}

export function SportIcon({ sport, className }: { sport: string; className?: string }) {
  return sport === "hockey" ? <HockeyIcon className={className} /> : <FencingIcon className={className} />;
}
