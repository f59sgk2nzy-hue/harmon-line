import { cn } from "@/lib/utils";

export function EmptyState({
  kicker = "THE HARMON LINE",
  headline,
  detail,
  action,
  className,
}: {
  kicker?: string;
  headline: string;
  detail: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("empty-panel px-5 py-6 text-center sm:px-8 sm:py-12", className)}>
      <p className="font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">{kicker}</p>
      <p className="mt-3 font-display text-xl tracking-[0.12em] text-white sm:text-2xl">
        {headline}
      </p>
      <p className="mx-auto mt-3 max-w-lg font-sans text-sm leading-relaxed text-white/58">
        {detail}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
