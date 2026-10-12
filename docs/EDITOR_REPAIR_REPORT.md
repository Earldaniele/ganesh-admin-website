# Visual Editor repair — 2026-10-09

Admin: `C:\xampp\htdocs\ganesh-admin-website`. Public source: `C:\xampp\htdocs\ganesh-website`.

## Root cause

The public repository lacked `/editor-preview`, ticket verification, a parent-message bridge and CMS data bindings. Its signed preview URL returned 404. A route alone would still leave actual components disconnected from saved content.

HMR is separate. The installed Next.js 16.3 implementation uses `/_next/hmr`; both ports returned WebSocket upgrade status 101 there. The old `/_next/webpack-hmr` endpoint timed out. The referenced original screenshot was unavailable in this chat, so its precise historical WebSocket failure cannot be established. Current HMR works; preview routing is not claimed as its fix.

## Changes

- Server-verified, expiring, origin-bound preview shell. Snapshots arrive through source/origin/token-checked parent messages; private uploaded media stays in frame memory. No anonymous draft-reading endpoint was added.
- Existing public pages/components remain the rendering source. Copy, image and collection adapters consume private preview or published snapshots. Legacy publication v35 keeps the current public-source fallback until an integration-version-2 draft is deliberately published. CSS, fonts, branding and motion were preserved.
- Featured Product copy/specifications/qualities, MP4 video, caption URL, poster and gallery; fabric descriptions, benefits and recommended uses; current section/control copy and media; support demo copy; order defaults, navigation and SEO/media bindings.
- MP4 add/replace/remove controls support 32 MB uploads. Images retain 5 MB decode/re-encode checks. Video container validation, byte ranges and private/published asset rules share existing media storage.
- Sidebar grouping/search, descriptive names, page/section context, spacing, scrolling, sticky actions and full-width compact panel. Page switching while editing is prevented. Overlapping preview buttons are separated.
- Matching local preview/content/media configuration and preview-only headers. Verification builds are isolated and ignored to prevent Tailwind scanning binary/cache content. The resulting CSS scan error encountered during testing was cleared without changing styling.

## Database

`004_editor_design_imports.sql` adds a journal with site key, draft version, imported snapshot hash, backup path and timestamp. New fields remain in existing JSON snapshots; video uses existing media tables.

`scripts/sync-current-design.ts` locks the draft, merges only missing fields by stable ID, validates, verifies a backup and writes draft/version/journal/audit changes in one transaction. Existing values, custom/deleted entries and order win. Publications, published media, publication history and live revalidation are untouched.

Migration applied; private draft v38; publication remains v35 (2026-09-12). Independent database readback verified unchanged existing products, Home content and global settings; the user's custom fabric entry remains. Backups: `.local-setup/draft-before-design-sync-*.json`. Public originals/preparation tooling are in git-ignored `.local-setup/`.

## Verification

- Admin typecheck, lint, 24 tests and final production build passed.
- Public application source lint, TypeScript and final production build passed.
- Browser: actual iframe handshake, five preview pages, live hero-copy update, current Featured Product video/gallery and selection controls using checked-in public-source content. Preview inspected at desktop and 390 px mobile. Evidence: `.visual-qa/visual-editor/`.
- Tests: import idempotence/private-value preservation, serialization, unsafe video URLs, empty galleries and complete/truncated/disguised MP4 files.
- Full public lint fails on pre-existing `.temp`/`.tmp` generated caches/helper scripts. Those unrelated artifacts/configuration remain intact; scoped source lint passed.

## Remaining blocker

Old temporary credentials in `.local-setup/admin-access.txt` are rejected. Current user sign-in is required for authenticated `/editor` save/reload, uploaded-video persistence and desktop/mobile sidebar/panel checks. Publish transaction testing remains unverified. No password/account changes or live publication were made.

After sign-in: capture original draft/version, edit one featured field/video, Apply, Save Draft, reload, verify panel/iframe, then restore only tested values through version-checked saving. Check section search and compact panel. Do not run historical smoke scripts that publish live content. Test publish transactions only in an isolated rollback environment.

## Files

Complete inventory follows. Initial unrelated admin package/lockfile/README changes and public design/data/docs changes were retained.

### Admin repair files

- `.gitignore`
- `app/api/media/route.ts`
- `app/media/content/[filename]/route.ts`
- `components/EditorFields.tsx`
- `components/VisualEditor.tsx`
- `components/visual-editor.css`
- `lib/content/schema.ts`
- `lib/content/seed.ts`
- `lib/content/current-design.json`
- `lib/content/design-inventory.json`
- `lib/content/sync-design.ts`
- `lib/editor-fields.ts`
- `lib/media/validate.ts`
- `lib/visual-editor.ts`
- `database/migrations/004_editor_design_imports.sql`
- `scripts/sync-current-design.ts`
- `scripts/verify-design-draft.ts`
- `scripts/diagnose-preview.mjs`
- `scripts/prepare-preview-qa.ts`
- `tests/content.test.ts`
- `tests/design-sync.test.ts`
- `eslint.config.mjs`
- `tsconfig.json`
- `docs/tasks.md`
- `docs/handoff.md`
- `docs/checklist.md`
- `docs/EDITOR_REPAIR_REPORT.md`

### Public integration files

- `.env.local`
- `.gitignore`
- `app/api/revalidate/route.ts`
- `app/customize/Content.tsx`
- `app/customize/page.tsx`
- `app/editor-preview/page.tsx`
- `app/layout.tsx`
- `app/our-work/Content.tsx`
- `app/our-work/page.tsx`
- `app/production/Content.tsx`
- `app/production/page.tsx`
- `app/products/Content.tsx`
- `app/products/page.tsx`
- `components/cms/CmsContent.tsx`
- `components/cms/PreviewShell.tsx`
- `components/layout/SiteFooter.tsx`
- `components/layout/SiteHeader.tsx`
- `components/sections/BrandStatement.tsx`
- `components/sections/BrandValues.tsx`
- `components/sections/BuildYourOrder.tsx`
- `components/sections/FabricExplorer.tsx`
- `components/sections/FeaturedProduct.tsx`
- `components/sections/HelpfulBeforeOrdering.tsx`
- `components/sections/HeroHeader.tsx`
- `components/sections/OurWork.tsx`
- `components/sections/ProductionProcess.tsx`
- `components/sections/WhatWeMake.tsx`
- `components/support/SupportChat.tsx`
- `components/support/support-demo.ts`
- `docs/checklist.md`
- `docs/handoff.md`
- `docs/tasks.md`
- `lib/cms/server.ts`
- `next.config.ts`
- `tsconfig.json`

Local environment secrets are omitted. Existing unrelated public CSS/data/UI/config changes are not repair changes.
