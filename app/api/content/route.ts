import { NextResponse } from "next/server";
import { getDraftContent, saveDraft, publishDraft } from "@/lib/content/store";
import { requireAdmin } from "@/lib/auth/session";
import { isSameOrigin, readJson } from "@/lib/auth/request";

export const runtime = "nodejs";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try { return NextResponse.json(await getDraftContent(), { headers: { "cache-control": "private, no-store" } }); }
  catch (error) { console.error("Content load failed", error); return NextResponse.json({ error: "Your saved content could not be loaded. Please try again or contact your administrator." }, { status: 503, headers: { "cache-control": "no-store" } }); }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  if (!await requireAdmin()) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await readJson(request).catch(() => null) as { content?: unknown; version?: number } | null;
  if (!body || typeof body.version !== "number" || body.content === undefined) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await saveDraft(body.content, body.version).catch(() => ({ ok: false as const, status: 503, error: "The database is unavailable. Your edits have not been saved." }));
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!user.permissions.publish) return NextResponse.json({ error: "Your role can save drafts but cannot publish. Ask an administrator to publish." }, { status: 403 });
  const body = await readJson(request, 4096).catch(() => null) as { version?: number } | null;
  if (!body || typeof body.version !== "number") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await publishDraft(body.version).catch(() => ({ ok: false as const, status: 503, error: "The database is unavailable. Publication did not complete." }));
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
