// A grey placeholder while content loads; size and shape come from className
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse ${className}`} />;
}
