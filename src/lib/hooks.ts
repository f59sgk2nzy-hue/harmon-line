"use client";

import { useEffect, useRef } from "react";

/** Default board / game refresh: 10 minutes. */
export const BOARD_REFRESH_MS = 10 * 60 * 1000;

export function useLivePoll(
  callback: () => void,
  options: { intervalMs?: number; runOnMount?: boolean } = {}
) {
  const saved = useRef(callback);
  const intervalMs = options.intervalMs ?? BOARD_REFRESH_MS;
  const runOnMount = options.runOnMount ?? false;

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    const run = () => saved.current();
    if (runOnMount) run();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);

    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, runOnMount]);
}
