import { teamHref } from "@/lib/team-url";
import Link from "next/link";
import type { ReactNode } from "react";

export function TeamLink({
  teamId,
  children,
  className = "",
  title,
}: {
  teamId: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <Link
      href={teamHref(teamId)}
      title={title}
      className={`inline-flex min-h-11 max-w-full items-center text-inherit no-underline hover:text-[#f3c14b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000] ${className}`}
    >
      {children}
    </Link>
  );
}