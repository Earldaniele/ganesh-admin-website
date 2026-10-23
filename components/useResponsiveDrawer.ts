"use client";

import { useEffect, type RefObject } from "react";

// Keep this query aligned with the shared 900px drawer breakpoint in CSS.
export function useResponsiveDrawer({ open, close, drawer, trigger, background }: {
  open: boolean;
  close: () => void;
  drawer: RefObject<HTMLElement | null>;
  trigger: RefObject<HTMLButtonElement | null>;
  background?: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    const panel = drawer.current;
    const opener = trigger.current;
    if (!panel) return;
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => {
      panel.toggleAttribute("inert", media.matches && !open);
      if (!media.matches && open) close();
    };
    sync();
    media.addEventListener("change", sync);
    if (!open || !media.matches) return () => media.removeEventListener("change", sync);

    const previous = document.activeElement as HTMLElement | null;
    const main = background?.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    main?.setAttribute("inert", "");
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>("a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']")).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      media.removeEventListener("change", sync);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      main?.removeAttribute("inert");
      if (media.matches) (opener ?? previous)?.focus();
    };
  }, [open, close, drawer, trigger, background]);
}
