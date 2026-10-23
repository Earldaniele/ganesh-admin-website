import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { isSameOrigin, readJson } from "@/lib/auth/request";
import { getEditorDraft, listEditorDrafts, saveEditorDraft } from "@/lib/content/editor-drafts";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    const result = id ? await getEditorDraft(id) : await listEditorDrafts();
    if (!result) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    return NextResponse.json(id ? { draft: result } : { drafts: result }, { headers: { "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Saved drafts could not be loaded. Check the database migrations and retry." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  if (!await requireAdmin()) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await readJson(request, 6 * 1024 * 1024).catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await saveEditorDraft(body).catch(() => ({ ok: false as const, status: 503, error: "Database unavailable. Your edits are retained." }));
  return NextResponse.json(result, { status: result.ok ? 201 : result.status });
}
