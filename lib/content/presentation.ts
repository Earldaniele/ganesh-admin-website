import { fieldLabel } from "../editor-fields.ts";
import { mediaPlacement } from "../media/presentation.ts";

type ContentIssue = { path: PropertyKey[]; code?: string; message: string; minimum?: unknown; maximum?: unknown; origin?: string };
export function contentIssueSummary(issues: ContentIssue[], content: unknown): string {
  return [...new Set(issues.map((issue) => {
    const keys = issue.path.map(String);
    const placement = mediaPlacement(keys.join("."), content);
    const field = keys.at(-1) ?? "Content";
    const label = /^\d+$/.test(field) ? `Item ${Number(field) + 1}` : fieldLabel(field);
    const context = placement.page === "Website" ? fieldLabel(keys[0] ?? "Content") : `${placement.page} · ${placement.section}`;
    let instruction = "Check this value before saving.";
    if (issue.code === "too_small") instruction = issue.minimum === 1 ? "Enter a value." : `Use at least ${issue.minimum} ${issue.origin === "array" ? "items" : "characters"}.`;
    if (issue.code === "too_big") instruction = `Use no more than ${issue.maximum} ${issue.origin === "array" ? "items" : "characters"}.`;
    if (/description|alt text/i.test(issue.message)) instruction = "Add a short description of the image.";
    if (/URL|local.*path|HTTP|safe.*link/i.test(issue.message)) instruction = "Enter a valid link or choose a file from the Media Library.";
    if (issue.code === "custom" && !/\b(ID|IDs|key|schema|reference|slug|snapshot)\b|[a-z]+\.[a-z]+/i.test(issue.message)) instruction = issue.message;
    return `${context} · ${label}: ${instruction}`;
  }))].slice(0, 5).join("\n");
}
