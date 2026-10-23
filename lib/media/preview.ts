/** Only authenticated, same-origin uploads may enter the private preview transport. */
export function privateMediaLinks(content: unknown, origin: string) {
  const links = new Map<string, string>();
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    if ("src" in node && typeof node.src === "string") {
      try {
        const url = new URL(node.src, origin);
        if (url.origin === origin && url.pathname.startsWith("/media/content/")) links.set(node.src, url.href);
      } catch { /* Invalid input remains a content validation issue. */ }
    }
    Object.values(node).forEach(visit);
  }
  visit(content);
  return links;
}

/** A small queue bounds memory/network work and deduplicates concurrent consumers. */
export class PreviewMediaLoader {
  cache = new Map<string, string>();
  private jobs = new Map<string, { controller: AbortController; promise: Promise<string>; run: () => Promise<void>; reject: (error: Error) => void; started: boolean }>();
  private active = 0;
  private read: (src: string, signal: AbortSignal) => Promise<string>;
  private concurrency: number;
  constructor(read: (src: string, signal: AbortSignal) => Promise<string>, concurrency = 4) { this.read = read; this.concurrency = concurrency; }
  load(src: string): Promise<string> {
    const cached = this.cache.get(src);
    if (cached !== undefined) return Promise.resolve(cached);
    const existing = this.jobs.get(src);
    if (existing) return existing.promise;
    const controller = new AbortController();
    let resolve!: (data: string) => void, reject!: (error: Error) => void;
    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    const job = { controller, promise, reject, started: false, run: async () => {
      this.active++;
      try {
        const data = await this.read(src, controller.signal);
        if (controller.signal.aborted) throw new DOMException("Obsolete preview request", "AbortError");
        this.cache.set(src, data); resolve(data);
      } catch (error) { reject(error as Error); }
      finally { this.active--; if (this.jobs.get(src) === job) this.jobs.delete(src); this.pump(); }
    } };
    this.jobs.set(src, job); this.pump(); return promise;
  }
  retain(sources: Set<string>) {
    for (const [src, job] of this.jobs) if (!sources.has(src)) {
      job.controller.abort();
      job.reject(new DOMException("Obsolete preview request", "AbortError"));
      this.jobs.delete(src);
    }
    this.pump();
  }
  private pump() {
    for (const job of this.jobs.values()) {
      if (this.active >= this.concurrency) break;
      if (!job.started) { job.started = true; void job.run(); }
    }
  }
}

export async function readPreviewMedia(src: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(src, { cache: "no-store", credentials: "same-origin", signal });
  if (!response.ok) throw new Error("A draft image could not load. Sign in again or replace the image.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => { reader.abort(); reject(new DOMException("Obsolete preview request", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    reader.onloadend = () => signal.removeEventListener("abort", abort);
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Preview media could not be read."));
    if (signal.aborted) abort(); else reader.readAsDataURL(blob);
  });
}
