# CMS repair handoff — 2026-09-08

## Current editor repair — 2026-10-09

See `docs/EDITOR_REPAIR_REPORT.md`. Missing public preview/CMS integration is now connected to existing components. New fields are imported into draft v38; publication v35 is unchanged. Final admin/public builds and scoped checks pass. Invalid old credentials block authenticated save/reload, video upload and sidebar/panel checks until user sign-in. No password/account changes or live publish occurred; do not run historical live-publishing smoke scripts.

Local MariaDB migration and seed are applied and tested. Public app is on localhost:3000, admin on localhost:3001. Read README_CMS.md for setup, safety boundaries, backup/rollback and verification. First-login credentials are only in the git-ignored .local-setup/admin-access.txt.

Key fixes: pnpm/Windows dependency links; public hero blur crash; generated-build Tailwind scanning; current-draft preservation; Save & Publish saving unsaved edits; real settings and dashboard state; structured collection editor; bounded same-origin/authenticated writes; safe persistent media with private draft access; immediate protected revalidation.

mysql.db was corrupted before permissions could be granted. With explicit user approval, a verified table-file backup was taken and targeted repair completed with CHECK TABLE OK. Backup location and procedure are in README_CMS.md.

Both repositories pass type/lint/build checks. All 13 unit tests, MariaDB integration, browser editor and expanded content-coverage smoke tests passed; original content was restored (draft/publication version 20 at final check). Retain test revision history/media for audit and rollback. All five public desktop/mobile captures in .visual-qa/completed returned 200 with no runtime errors/overflow. Normal-motion menu, dialog, fabric keyboard tabs and FAQ checks passed at both widths.

Remaining legacy wiring is complete: interior copy/SEO/images, shared headers/footers, inverse/footer logos, production guidance/FAQs, builder labels/defaults/fabric options. The public loader is server-only with a full validated seed fallback. scripts/extend-content.ts adds missing fields without overwriting edits; verified backup: .local-setup/content-before-extension-1788800494481.json. Optional contact values may use existing footer detail slots, without added UI. No quotation/order backend was added.

The pnpm launcher encountered a registry-signature network verification failure. Checks ran directly against installed Next/TypeScript/ESLint binaries without disabling security verification. A transient Windows public build cache EBUSY warning cleared on the final successful rebuild.

Preserve unrelated dirty changes. Public CSS, fonts and animation modules were not redesigned. Do not mark user manual checks complete without user confirmation.

Visual Editor continuation: see docs/VISUAL_EDITOR.md for the canonical public views, private preview protocol, administrator workflow and current verification. Original content restored exactly (draft 28; publication remains 26). Temporary-content live publication was blocked by automatic approval review and remains unverified.

Final Visual Editor verification: both apps pass final TypeScript, ESLint and production builds; all 16 tests pass. Full verification limits remain documented in VISUAL_EDITOR.md.

## Users & Roles — September 9, 2026

Removed Export working draft from the Visual Editor, including the error-state action. Settings > Users & Roles supports administrator-only account creation, changing another account’s role, and adding/editing custom roles. All roles edit/save drafts; Editor cannot publish, and custom roles can optionally publish. Administrator is the only role that manages users. Role changes revoke the affected user’s sessions; custom role permissions are read from the database on each request. Built-in roles and changing your own role are protected. Optimistic role conflicts are checked and successful changes are audited without passwords.

Migration 003_users_roles.sql applied using the existing local setup database administrator because ganesh_app correctly has no DDL permissions. Existing account-role backup: .local-setup/accounts-before-role-migration.json. Runtime credentials and database grants were unchanged.

Verified: TypeScript, ESLint, production build, 18 unit tests, real MariaDB transaction tests with complete rollback, anonymous API rejection and cross-origin account-write rejection. In the authenticated browser, Users & Roles loads, required create-account/custom-role fields prevent blank submission, self role changes are disabled, there is no horizontal overflow at the current viewport, and the editor no longer shows Export working draft. No real account or role was created for testing.

Fabric Explorer categories/Publics (2026-10-09): added optional fabricCategories and per-card categoryId with legacy one-category-per-fabric fallback. The visual editor manages separate empty categories, selected-category cards, details, uploads, reorder/removal, Apply/Cancel and undo/redo using existing draft/version/media APIs. Public FabricExplorer and CmsContent adapters in the sibling website render the new membership; edit actions only appear in the signed preview. No schema migration or draft/publication write was performed. Unit/schema round-trip tests cover empty categories, multiple-card membership and stored media references; authenticated MariaDB save/upload remains an owner verification item.

Verification: all 27 unit tests passed, and admin/public TypeScript and changed-source lint passed. Headless Edge exercised the real components with fixture-only content/media APIs: Add Category, empty state, Add Public with picture/details, Apply, schema-validated Save Draft/reload, details modal, category isolation and 390px layout. The editor/category overlay interception was fixed. Mobile Home page width was 403px in a 374px frame for both baseline and edited fixtures; Fabrics itself fits and did not increase overflow. Live authenticated database persistence was not exercised. Temporary QA route was removed; scripts/check-fabric-editor.ts creates and cleans up its own fixture-only route.

Final verification: both production builds passed (isolated .next-editor-build output); changed-source lint passed. The temporary QA route is absent from source and production routes.

## Featured products editor — 2026-10-09

Added a dedicated product selector, editable text, original-audio MP4 upload/player, multi-image gallery uploads, previews, captions/alt text, replacement/removal/reordering and direct Save Changes in the existing Visual Editor sidebar. Files use the existing media storage/MariaDB API; XHR reports upload progress and errors. MP4 limit is 32 MB; images 5 MB; galleries 1–30. Save Changes persists a private draft; existing Save & Publish updates the public site. Public player remounts on replacement, and gallery keys use IDs. No schema migration or dependency added.

Verified: 27 tests, TypeScript, full admin lint and production build; actual local browser uploads, byte-for-byte MP4 preservation, byte ranges, gallery operations, text save/reload, public preview binding and mobile overflow. QA temporary account removed and original draft restored at a new version; publication unchanged. Uploaded QA media remain under normal retention. Reusable integration check: scripts/check-featured-editor.ts; screenshots/backups: .visual-qa/featured (ignored).

## Whole-system verification — 2026-10-09

Current audit, not a repair: see [SYSTEM_VERIFICATION_2026-10-09.md](SYSTEM_VERIFICATION_2026-10-09.md). Actual isolated MariaDB/browser tests confirm authentication, roles, draft saves/latest-state publication, real media and major public interactions. Whole-system readiness is not established: exposed CMS bindings, gallery crop/video description, CMS Home mobile overflow, structured publish Escape, local production uploaded-image optimization and full public lint have confirmed failures. Draft 42/publication 35 and active accounts/content/media remain unchanged; the older active publication lacks integration version 2 and the public loader uses fallback. Isolated content restored; test servers stopped. No application code/password/design changes. Next action: resolve documented failures, finish per-field/UI and deployed checks; active publication requires explicit authorization.

## Current repair handoff — 2026-10-09

Use SYSTEM_REPAIR_2026-10-09.md as current result and CMS_SOURCE_OF_TRUTH.md as the binding contract; historical audit above is preserved. Linked legacy/design copy reconciles only on deliberate edits and keeps untouched divergence. Gallery crop/video descriptions, scoped loopback image transport, Home overflow and structured publish Escape repaired. Normal public lint now passes after build. Active publication 35 retains fallback until owner reviews/authorizes a preserving candidate. Do not publish or migrate active content automatically. Planner/demo scope accepted; real quote/support/recovery/Notifications remain unavailable and disclosed. Ignored repair evidence contains private test state; do not commit credentials or snapshots. Follow remaining UNVERIFIED inventory/deployed/manual checks; no whole-system readiness claim.
