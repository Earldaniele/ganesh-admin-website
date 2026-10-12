import fixture from "./current-design.json" with { type: "json" };
import type { ContentSnapshot } from "./schema";

// Reviewed public-site fixture. Regenerate collections with scripts/import-public-fixture.ts.
// Server loaders and seed tooling validate this before use; it is never an editor save base.
export const initialContent = fixture as ContentSnapshot;
