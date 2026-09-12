"use client";

import { useEffect, useRef } from "react";

export function useLivePoll(
  callback: () => void,
  options: { live: boolean; liveMs?: number; idleMs?: number }
) {
  const saved = useRef(callback);
  const liveMs = options.liveMs ?? 12_000;
  const idleMs = options.idleMs ?? 45_000;

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    const run = () => saved.current();
    run();

    let timer: number;
    const arm = () => {
      window.clearInterval(timer);
      const delay = options.live ? liveMs : idleMs;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") run();
      }, delay);
    };

    arm();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        run();
        arm();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [options.live, liveMs, idleMs]);
}
