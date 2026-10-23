"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

type Tone = "success" | "error";
type Notification = { id: number; message: string; tone: Tone };
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const active = useRef<Notification | null>(null);
  const sequence = useRef(0);
  const notify = useCallback((message: string, tone: Tone = "success") => {
    if (active.current?.message === message && active.current.tone === tone) return;
    const next = { id: ++sequence.current, message, tone };
    active.current = next;
    setNotification(next);
  }, []);
  const close = useCallback(() => { active.current = null; setNotification(null); }, []);

  return <ToastContext.Provider value={notify}>
    {children}
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{notification?.tone === "success" ? notification.message : ""}</div>
    <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{notification?.tone === "error" ? notification.message : ""}</div>
    {notification ? <Toast key={notification.id} {...notification} onClose={close} /> : null}
  </ToastContext.Provider>;
}

export function Toast({ message, tone, onClose }: Notification & { onClose: () => void }) {
  const [exiting, setExiting] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const remaining = useRef(4000);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = useRef(new Set<string>());
  const dismiss = useCallback(() => setExiting(true), []);
  const resume = useCallback((reason: string) => {
    paused.current.delete(reason);
    if (tone !== "success" || paused.current.size || timer.current) return;
    started.current = Date.now();
    timer.current = setTimeout(dismiss, remaining.current);
  }, [dismiss, tone]);
  function pause(reason: string) {
    paused.current.add(reason);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
    }
  }
  useEffect(() => {
    resume("initial");
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [resume]);
  useEffect(() => {
    if (!exiting) return;
    const exit = setTimeout(onClose, 180);
    return () => clearTimeout(exit);
  }, [exiting, onClose]);
  useEffect(() => {
    // Keep the toast below the admin header, including a wrapped mobile toolbar.
    const headers = [...document.querySelectorAll(".ve-toolbar, .ve-status, .ve-panel > header, .page-header")];
    if (!headers.length) return;
    const position = () => {
      if (viewport.current) viewport.current.style.top = `${Math.max(0, ...headers.map((header) => header.getBoundingClientRect().bottom)) + 12}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    headers.forEach((header) => observer.observe(header));
    window.addEventListener("scroll", position, { passive: true });
    window.addEventListener("resize", position);
    return () => { observer.disconnect(); window.removeEventListener("scroll", position); window.removeEventListener("resize", position); };
  }, []);

  return <div className="toast-viewport" ref={viewport}>
    <div className={`toast toast--${tone}${exiting ? " toast--exiting" : ""}`}
      onMouseEnter={() => pause("hover")} onMouseLeave={() => resume("hover")}
      onFocusCapture={() => pause("focus")} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) resume("focus"); }}>
      <span className="toast-icon" aria-hidden="true"><Icon name={tone === "success" ? "check" : "x"} /></span>
      <span className="toast-message">{message}</span>
      <button type="button" onClick={dismiss} aria-label="Dismiss notification"><Icon name="x" /></button>
    </div>
  </div>;
}
