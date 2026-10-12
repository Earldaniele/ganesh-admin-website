# CMS repair tasks

## Active

- 2026-10-09 Visual Editor: preview/content bridge, featured video/gallery/fabric/support fields, sidebar usability, backed-up draft-only sync and scoped checks implemented. Authenticated save/reload and sidebar/panel verification await current user sign-in. Do not publish during testing.

- Implementation and local verification complete. Ready for user acceptance and first-login password change.

## Completed

- Repair dependencies and runtime errors; apply MariaDB migrations and actual public seed.
- Repair mysql.db after explicit approval, with verified backup.
- Wire secure auth, media, drafts, publish, revalidation and conflict/error handling.
- Preserve loaded snapshot data; fix unsaved Save & Publish behavior and settings loading.
- Add structured repeatable-content controls and real dashboard state.
- Clean the reusable implementation prompt for MariaDB and the public-UI preservation boundary.
- Run type/lint/build, unit/security, live MariaDB and browser editing checks.

- Complete interior copy/images/metadata, shared header/footer/logo, production guidance/FAQs, builder labels/defaults, dynamic fabric counts and validated server-only fallback.
- Apply the additive content migration with verified backup and idempotence checks.
- Verify 13 unit tests, actual MariaDB/browser publication and normal-motion desktop/mobile interactions. Restore original content.

## Pending

- User confirmation of final public visuals/motion and first-login password change.

## Visual Editor continuation

- Implemented shared canonical views for all five pages, authenticated live preview, edit panels, product dialogs, media upload, immutable state, undo/redo and conflict handling.
- Responsive public checks passed at 1440/768/390; authenticated draft editing/upload/reload verified and original content restored.
- Remaining: user visual acceptance and explicit approval for a temporary-content live publish test. See VISUAL_EDITOR.md.

## Users & Roles — completed September 9, 2026

- Removed Export working draft everywhere in the Visual Editor.
- Added administrator-only account creation, role assignment and custom roles in Settings.
- Enforced Editor draft-only access and optional custom-role publishing in the API and UI.
- Applied the preserving schema migration; all 18 tests, database rollback integration checks, type/lint/build and authenticated UI checks passed.

- 2026-10-09: Implemented Fabrics sidebar categories and category-scoped Public cards through the existing visual editor and Save Draft flow; legacy content remains compatible. Added regression coverage for empty categories, membership, required pictures and persistence serialization.

- Completed 2026-10-09: functional Featured Products video/gallery editor and direct Save Changes; real upload/save/reload/public-preview and responsive verification passed. Existing draft/publication workflow retained.

## Whole-system verification — 2026-10-09

Audit completed with explicit FAIL/UNVERIFIED coverage; this does not mark the whole system ready or implement repairs. Full matrix, evidence and exact follow-up checks: [SYSTEM_VERIFICATION_2026-10-09.md](SYSTEM_VERIFICATION_2026-10-09.md). Manual user checklist confirmations remain unchanged.

## Repair follow-up — 2026-10-09

Current known CMS/media/layout/lint defects repaired and retested in isolated production. Admin 31 unit tests and both builds/types/full lint pass; public has 3 unit and 16 browser regressions. See SYSTEM_REPAIR_2026-10-09.md and FIELD_VERIFICATION_REPAIR_2026-10-09.tsv for evidence and remaining coverage. Whole-system acceptance, exhaustive conditional/per-field coverage and deployed checks remain UNVERIFIED. Owner selected planner/demo scope with explicit limitations. Active publication upgrade is prepared read-only and tested in isolation; no active publication authorized. User manual checkboxes remain unchanged.
