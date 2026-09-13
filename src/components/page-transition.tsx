import { ViewTransition } from "react";

const navMotion = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={navMotion} exit={navMotion} default="none">
      {children}
    </ViewTransition>
  );
}
