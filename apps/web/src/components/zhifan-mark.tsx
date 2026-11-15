export function ZhifanMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="22" height="22" rx="5" className="text-brand" />
      <path d="M6 6v12h12M8 14l4-4 3 2 4-6" className="text-brand" />
    </svg>
  );
}
