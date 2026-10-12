# Ganesh repair and verification — 2026-10-09

## Verdict

**Admin: repaired defects pass locally; complete acceptance remains UNVERIFIED. Public: repaired defects and current production checks pass locally; deployed verification remains UNVERIFIED. Integration: isolated integration passes for the tested paths; active integration is not enabled/verified. The whole system is not yet certified ready.**

The owner selected **planner/demo scope with explicit UI limitations**. Real quote/order submission, order lookup/live support, self-service password recovery and Notifications remain NOT IMPLEMENTED, outside that accepted initial scope. Upload abort and CMS VTT upload are also NOT IMPLEMENTED. A deployed environment and exhaustive individual field/state verification are still needed.

This report supersedes the failures in [the original audit](SYSTEM_VERIFICATION_2026-10-09.md) only where current passing evidence is named below. Original audit evidence is retained. No user manual acceptance checkbox is completed.

## Repairs and source of truth

- Connected the eleven reported fields to the intended public sections/actions. Global quote copy and legacy footer legal copy reconcile with their current Design copy controls only when deliberately edited. Unrelated saves/load/publication retain preexisting divergent values; incompatible simultaneous edits are rejected. Both editors use the saved server snapshot. See [CMS_SOURCE_OF_TRUTH.md](CMS_SOURCE_OF_TRUTH.md).
- Connected additional builder/dialog labels, current interior page actions/kickers and actual Global navigation collection. Retained legacy controls show a read-only explanation rather than pretending to edit current public sections. Existing content is retained.
- Gallery thumbnails/enlarged images honor focal points; video uses its saved accessible description and fallback poster metadata. Local published image transport uses a bounded, exact-loopback, image-only route while Next private-IP protections remain enabled. Draft anonymous access remains denied.
- Fixed Home's concatenated inline brand statement fragments and scoped wrapping; preserved the intentional carousel. Structured confirmation uses a native modal dialog with Escape, focus containment and trigger restoration.
- Normal public ESLint excludes generated/build/temp output while linting real source. Added focused alias/media security regressions and a reusable public browser suite. SEO includes Home/interior descriptions, social-image alt, configured metadata origin and private draft preview metadata.
- Added clear planner/demo/recovery notices and disabled unavailable Notifications. No external services were connected.

## Current verification table

All evidence below is local, with isolated admin/public origins `localhost:3101`/`localhost:3100`, isolated database, storage and synthetic accounts. JSON/logs/screenshots are ignored private artifacts under `.visual-qa/repair-2026-10-09/`; credentials and snapshots are not report content.

| Feature / test performed | Result | Current evidence |
|---|---|---|
| Eleven reported bindings: individual draft save/reload, signed private preview, draft privacy, isolated publication and exact public text/destination/source | PASS after final server restart | `field-lifecycle-results.json` |
| Link/external/media reference bindings | PASS for exercised paths | `link-binding-results.json`, `seo-contact-results.json` |
| All Global footer contact selectors, Facebook, Home/interior title/description, social alt and metadata origin | PASS | `seo-contact-results.json` |
| Custom footer values, empty-category/clear-search labels, all three video-less poster descriptions and inactive fabric activation/name | PASS | `conditional-fields-results.json`; hydration/intro allowed to finish before UI interactions |
| Gallery ordering/caption/alt/crop; saved video description | PASS | `gallery-final-results.json` |
| New upload: anonymous draft 404, published bytes available, Next optimization 200, revalidation | PASS | `upload-production-before.json` (400 before), `upload-production-results.json` |
| Image/MP4 upload, replacement/removal, private media, playback and byte ranges | PASS for exercised assets | `admin-integration-results.json`, `gallery-final-results.json`, `backend-final-results.json`, `public-final-results.json` |
| Progress/error retention/retry, panel cancellation, image and video limits | PASS | `media-ui-results.json`, `recovery-results.json` |
| In-flight network upload cancellation | NOT IMPLEMENTED | No exposed abort control; panel Cancel does not imply upload abort |
| Saved VTT URL and browser cue parsing | PASS with isolated same-origin response | `media-ui-results.json`; does not prove deployed cross-origin caption delivery |
| CMS VTT file upload | NOT IMPLEMENTED | Supported uploads are images/MP4; deployment caption URL/CORS remains UNVERIFIED |
| Structured publish Escape, eight Tab cycles and trigger focus restoration | PASS | `remaining-ui-results.json` |
| Five public routes × desktop/tablet/mobile: metadata, width, image loads, runtime; gallery Escape/focus | PASS, 16/16 | `tests/public.e2e.mjs`, actual `npm run test:e2e` run |
| Carousel wheel/all eight product dialogs, galleries/video, demo support, radio labels, quantities, keyboard tabs and local navigation/fragment targets | PASS in tested desktop/mobile states | `public-final-results.json`, `public-targeted-results.json`, `links-results.json` |
| Root collection UI add/edit/reorder/remove/save refresh: products, fabrics, production steps, portfolio categories, brand values, FAQs, size guides, featured products | PASS | `remaining-ui-results.json` |
| Nested tiles/size rows/navigation/support prompts, order option collections/default selectors; dedicated fabric/category and gallery UI | PASS for exercised paths | `remaining-ui-results.json`, `admin-extra-results.json`, `gallery-final-results.json` |
| Every other nested collection/state and every non-text field individually | UNVERIFIED where not mapped to execution evidence | Field inventory; API round trips are not substituted for UI proof |
| Login/protected routes/API authorization/CSRF/validation/conflicts/unsaved changes/logout/session expiry | PASS for tested cases | `admin-integration-results.json`, `admin-error-results.json`, `backend-final-results.json` |
| Editor/custom roles/admin-only accounts, permission changes/session revocation, password-change revocation on synthetic account | PASS | `admin-retest-results.json`, `recovery-results.json` |
| Actual isolated database outage, retained draft/cache and recovery | PASS | `recovery-results.json` |
| Public revalidation endpoint outage and explicit retry | PASS: outage 502, recovery/retry 200 | `revalidation-recovery-results.json` |
| Restart persistence | PASS: session valid, draft and publication content/version retained | `restart-results.json` |
| Admin/public production builds, TypeScript, full unscoped lint | PASS locally | `build-admin.log`, `build-public.log`, `types-*.log`, `lint-*.log`; normal `npm run lint` also passed |
| Automated unit tests | PASS: admin 31/31, public 3/3 | Actual `npm test`; `unit-admin.log` |
| Publication 35 upgrade candidate preserves every original value; staged/published only in isolation | PASS | `scripts/prepare-publication-upgrade.ts`, `upgrade-results.json`; ignored candidate pair retained for owner review |
| Active publication upgrade/active CMS rendering | UNVERIFIED, not performed | Publication 35 still lacks integration version 2 and therefore uses source fallback |
| Deployed hostname/TLS/media/storage/cache/auth/caption CORS/SEO | UNVERIFIED | No deployment execution/access supplied |
| Quote/order backend, live support/order lookup, recovery, Notifications | NOT IMPLEMENTED; accepted planner/demo scope | Explicit UI notices; no business backend/service integration |

## Field coverage and limitations

[FIELD_VERIFICATION_REPAIR_2026-10-09.tsv](FIELD_VERIFICATION_REPAIR_2026-10-09.tsv) classifies all **1,004 baseline snapshot scalars**: 748 supported, 192 read-only, 64 inactive/obsolete retained values. These are scalar inventory counts, not counts of independent editable controls. Dynamic focal-point/newly-added fields also have separate targeted evidence.

The bulk text run saved/reloaded/published 617 unique probes and observed **539** in tested DOM states without runtime errors. After mapping exact lifecycle/SEO/link/conditional evidence, the inventory records **563 supported scalars PASS and 185 UNVERIFIED**. Remaining entries include individual media sources, collection visibility booleans, per-item builder/related-product selectors, external flags and defaults whose representative tests do not prove every scalar. Conditional poster/custom-footer/search/activation checks are now specifically mapped. Do not infer that all 185 failed, or that representative tests prove every scalar. Bulk publication is not an individual edit/preview/publication lifecycle. Full per-field acceptance is still unfinished.

## Remaining issues and reproduction

| Severity | Issue | Reproduction / required action |
|---|---|---|
| P1 deployment gate | Active publication remains on legacy fallback | Inspect publication 35 without changing it: integration version 2 is absent. Review the preserving candidate and differences in linked copy; explicitly authorize an intended publication before applying it. |
| P2 verification gap | Exhaustive supported-field/conditional/nested UI coverage remains incomplete | Follow the 185 UNVERIFIED inventory entries, including per-item media, active switches, selector/external/default bindings, and exercise all remaining nested arrays through the UI. Record exact binding evidence rather than serialized snapshot matches. Custom footer, empty-search, poster and inactive-fabric activation/name states now have targeted passing evidence. |
| P2 capability gap | Upload has no in-flight abort | Start a delayed upload: progress exists but no Abort button. Panel Cancel is supported; it is not network abort. Decide whether abort is a release requirement, then implement/test cancellation and orphan handling. |
| P2 capability gap | VTT cannot be uploaded through CMS | Choose a caption URL: it persists and cues parse, but VTT selection/upload is not supported. Host a valid VTT URL with correct MIME/CORS, or specify a CMS-caption storage workflow. |
| P2 deployment gap | Production behavior not exercised | Repeat the isolated checks against an authorized staging/deployed environment, including TLS, hostname allowlists, optimization, durable storage, cookies, revalidation failure/retry, crawler metadata and caption delivery. |

No remaining confirmed failure in the original eleven field bindings, gallery crop/video description, scoped local uploaded-image optimization, Home overflow or structured Escape is being waived. Later failures must be reproduced against the final restarted build before attribution; building over a running Next server can invalidate its preview assets.

## Exact steps before readiness

1. Finish the UNVERIFIED supported fields/conditional states and unexercised nested collection UI operations; retain individual evidence and restore isolated content afterward.
2. Decide whether in-flight upload abort or CMS-hosted VTT upload is required for the accepted release. Implement if required; otherwise document the supported limits in release acceptance.
3. Review the preserving publication candidate, linked-copy differences and isolated rendering. Obtain explicit active publication authorization; do not migrate/publish automatically.
4. Verify an authorized deployed/staging environment with production origins, TLS, durable database/media, secret configuration, cookie settings, cache invalidation, optimization and captions. Local production mode is not deployed production evidence.
5. Obtain owner visual/manual acceptance. Existing manual checkboxes remain unchecked until that confirmation.

Active content/accounts/passwords/media are protected by read-only baseline integrity checks; test-only content restoration and process cleanup are recorded in the final integrity evidence. No database reset, external service or active publication is authorized by this report.

Final preservation check: all six baseline active-table hashes match; all 16 active media files have their expected size; nine database tables pass integrity checks; 37 generated client assets contain no configured database/revalidation secret. Evidence: `persistence-results.json`. The isolated original draft/publication were restored with original divergent legacy values retained and only isolation origin URLs rewritten; versions advance monotonically (`clone-restoration.json`). Test accounts/uploads remain solely in ignored isolated storage/database; no active users/media were deleted. Only tracked test processes on 3100/3101 were stopped.
