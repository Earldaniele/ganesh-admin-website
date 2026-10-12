# Ganesh system verification — 2026-10-09

**Current follow-up:** repairs and final local retests are in [SYSTEM_REPAIR_2026-10-09.md](SYSTEM_REPAIR_2026-10-09.md). The original audit below is historical; do not interpret its old failures as final repair results. Whole-system acceptance remains UNVERIFIED.

**Verdict: the whole system is not yet verified as ready.** The admin's tested authentication, draft persistence, publishing, media and role workflows work locally. The public site's tested routes and major interactions work, but current CMS content exposes rendering defects. Integration fails for several saved fields. Deployed/production-host verification remains **UNVERIFIED**.

This is a current audit of both repositories, not a repair or a claim that every button/field passed. No application code, design, existing passwords or accounts were changed. Existing dirty source changes were preserved. No test content was published to the active site.

## Environment and evidence boundaries

- Admin: `C:\xampp\htdocs\ganesh-admin-website`, Next 16.3.4. Public: `C:\xampp\htdocs\ganesh-website`, Next 16.3.2. Node 22.20, Windows/XAMPP MariaDB at port 3307, headless Microsoft Edge through Playwright.
- Both AGENTS.md files, project documentation and relevant installed Next guides were read. No subagents were used.
- Existing public origin `http://localhost:3000` was inspected read-only. Isolated production builds ran on admin 3101/public 3100, with separate database `ganesh_verify_20261009` and a copied media directory. Synthetic administrator/editor/custom-role accounts were created only in that database.
- Isolated migrations 001–003 cover the tested workflows. Active database also has migration 004 (`editor_design_imports`); that auxiliary import table/workflow was not exercised. Isolation used a local database administrator, whereas active runtime grants are SELECT/INSERT/UPDATE/DELETE on its database only. Testing does not establish equivalence of deployed database privileges.
- Evidence lives under `C:\xampp\htdocs\ganesh-admin-website\.visual-qa\system-2026-10-09`. This ignored directory contains private configuration, cookies and original content copies; do not upload it wholesale. The named results/logs below are the audit evidence.
- PASS applies to the stated operation and environment. Inventory/opening a control does not establish its end-to-end correctness. UNVERIFIED means missing evidence, not an assumed failure. NOT IMPLEMENTED identifies intentionally absent backend/workflow behavior.

## Active data and publication state

Active draft remains **42**, publication **35**. Before/after SHA-256 comparisons match for drafts, publications, profiles, roles, media metadata and revision history. All 16 active media files match recorded byte sizes; nine database tables returned integrity OK. No existing password was changed. A real-database role verification used a transaction and rolled it back; it left no synthetic users/roles in active data.

The active draft has `editorIntegrationVersion: 2`; its older publication does not. The current public loader requires version 2 and therefore renders its source fallback for that publication. The successful active-site route scan **does not prove that the current CMS draft is published or connected**. Isolated publication of the current draft was required to expose and test that connection.

The isolated original publication and original draft were restored, at clone draft version **174**. Test accounts, audit history and media in the separate test environment are retained as evidence; this is not an exact database rollback. No active database reset or deletion was performed. Test servers are stopped when this audit concludes; original ports are left alone.

## Verification matrix

Evidence filenames in this table are relative to the evidence directory above. Some early raw runs contain harness failures; the corrected results named here take precedence (see interpretation notes).

| Feature | Actual test performed | Status | Current evidence / limit |
|---|---|---|---|
| Admin inventory | Enumerated dashboard, content, all five settings views, login/root/editor; recorded controls and fields | PASS | `admin-inventory.json`; inventory is coverage input, not blanket functional approval |
| Visual editor inventory | Opened/cancelled all 47 panels across all five public pages | PASS | `editor-inventory.json`; field and button lists per panel |
| Login/logout/session | Synthetic-account browser login, refresh, logout; forged and expired session requests | PASS | `admin-integration-results.json`, `backend-final-results.json`; actual owner login not tested |
| Remember me/password visibility | Show/hide password; 30-day cookie issued and browser navigation retained session | PASS | `ui-final-results.json`; HttpOnly, SameSite=Lax, Secure observed on localhost |
| Protected routes/roles | Anonymous denial, editor draft writes, editor publish/team denial, users redirect | PASS | `admin-integration-results.json`, `admin-extra-results.json` |
| Users/custom roles | UI create role/member; change member to Editor; old session rejected; transaction verifies duplicates, built-ins/self protection/stale writes | PASS | `admin-retest-results.json`, `team-transaction.log` |
| Correct-password account change | Did not change any password | UNVERIFIED | Wrong current password returned 401; successful password change excluded by user instruction |
| Dashboard/navigation | Loaded dashboard, desktop/mobile routes, mobile menu open/close, root redirect, invalid settings 404 | PASS | `admin-inventory.json`, `ui-final-results.json` |
| General/contact settings | Required-field browser validation, save, refresh and reread | PASS | `admin-integration-results.json`; Maps public binding fails separately |
| Branding view | Loaded view and its editor entry; actual logo/favicon/social-image public binding probes | PASS | `admin-inventory.json`, `link-binding-results.json`; not every image variation individually tested |
| Editor preview/search/viewports | Signed iframe, five page selection, no-match search, desktop/tablet/mobile selectors | PASS | `editor-inventory.json`, `ui-final-results.json`; widths 1150/768/390 |
| Apply/Cancel/Undo/Redo | Actual editor edits and cancellation; undo/redo before save/publish | PASS | `admin-extra-results.json`, `featured-check.log`; not every nested collection's UI sequence |
| Save Changes / Save Draft | Real database save and refresh, private draft vs old publication | PASS | `admin-integration-results.json`, `featured-check.log`, `field-audit.log` |
| Save & Publish latest edits/cache | Published latest unsaved editor edits; refreshed public; revalidation true | PASS | `admin-extra-results.json`, version 57; isolated only |
| Save validation/errors | Missing media/schema 422, stale draft/publish 409, invalid JSON/oversized payload 400 | PASS | `admin-integration-results.json`, `backend-final-results.json` |
| Unsaved changes/retry | Actual refresh beforeunload; simulated 503 retains edit, real retry persists; concurrent save retains working copy | PASS | `admin-error-results.json` |
| Publish confirmation keyboard | Visual editor focus/Escape; structured content Escape | FAIL | Visual editor passes; structured content confirmation stays open on Escape, Cancel works |
| Repeatable collection persistence | API add/edit/reorder/remove and GET refresh for ten collections | PASS | `collections-results.json`: products, fabrics, productionSteps, workCategories, brandValues, faqs, sizeGuides, featuredProducts, editorial.productionPreparation/Questions |
| Fabric categories/Public cards | UI add category/card with actual image/details, order, membership, save/refresh, cancellation | PASS | `admin-extra-results.json`; generic category API template probe remains unverified because legacy snapshot has no explicit array |
| Featured text/images/galleries | Actual upload, replace/remove/reorder, required alt, save/refresh, preview, captions/alt in published DOM | PASS | `featured-check.log`, `gallery-final-results.json` |
| Gallery focal point/video description | Save changed crop and accessible video description, publish, inspect public computed style/label | FAIL | `gallery-final-results.json`: crop 10% 90% becomes 50% 50%; description ignored |
| Video upload/playback | Real MP4 upload, identical bytes, authenticated/public range 206, controls and playback progress | PASS | `featured-check.log`, `public-final-results.json`; physical audio/fullscreen/VTT tracks unverified |
| Media privacy/validation | Draft anonymous 404/auth 200; publication raw media 200; invalid image/video 415, invalid range 416 | PASS | `admin-integration-results.json`, `featured-check.log`, `backend-final-results.json` |
| Newly uploaded image optimization | Publish actual CMS image, request production Next image transform | FAIL | `upload-production-results.json`: raw 200, optimized 400; loopback/private-IP restriction in local production |
| Text field persistence | 619 schema-safe mutable text sentinels saved/refreshed and isolated published | PASS | `all-fields-results.json`; snapshot has 1004 scalar values, not 1004 editable fields |
| Every field's public binding | Public DOM/interactive-state probes and targeted follow-ups | FAIL | 504/619 bulk text probes observed; confirmed missing bindings below; remaining individual fields UNVERIFIED in TSV |
| Text/CTA/contact bindings | Targeted quote label, Home section copy, CTA URLs, map URL, footer contact source/legal | FAIL | `field-probe-results.json`, `link-binding-results.json`; exact failed paths below |
| Branding/SEO media | Published changed logo, favicon and social image references; actual DOM metadata | PASS | `link-binding-results.json`; uploaded-image transform issue remains separate |
| Public routes | Five public routes × 1440/768/390, active fallback and isolated CMS publication | PASS | `active-public-results.json`, `isolated-public-results.json`; 15/15 HTTP 200 in each scan |
| Public header/footer/local links | Collected destinations, checked origin-relative route/fragment existence | PASS | `links-results.json`: 35 local destinations; external Maps destination UNVERIFIED; editable URLs fail separately |
| Product carousel/quick views | Actual wheel navigation and all eight quick views at desktop/mobile | PASS | `public-final-results.json`; not physical touchscreen swipe |
| Featured products/gallery dialogs | All three featured products, gallery navigation, playback, Escape/focus return | PASS | `public-final-results.json`, `public-targeted-results.json` |
| Fabrics/work/size tabs/FAQs | Visible selection/detail controls, eight work/size tabs, ArrowRight, FAQ expansion | PASS | `isolated-public-results.json`, `public-targeted-results.json`; every arbitrary data combination not tested |
| Customization controls | All seven product and six fabric options, quantity 75, sizing/customization/note | PASS | `public-targeted-results.json`; client-side selections only |
| Quote/order submission | Click Prepare quote, inspect handler/request/response behavior | NOT IMPLEMENTED | Builder changes locally; no quotation/order backend or successful submission workflow |
| Public support chat | Four suggestion replies, thinking state, disabled composer, minimize/reopen, Escape | NOT IMPLEMENTED | Demo UI interactions pass in `public-final-results.json`; no live support/order lookup/chat backend |
| Forgot Password delivery | Click button, inspect displayed response | NOT IMPLEMENTED | Advisory directs administrator to local CMS database; no reset email/token flow |
| Admin Notifications | Click settled dashboard button; compare UI and requests | NOT IMPLEMENTED | `ui-final-results.json`: unchanged UI, no request; button has no handler |
| Loaded assets/browser errors | Scan five routes at three widths, images, failed requests and error responses | PASS | Route scans: zero runtime errors, failed requests, bad responses or broken loaded images; dedicated uploaded-image test fails separately |
| Responsive page width | Measure document width with dialogs closed | FAIL | CMS Home 403px at 390px viewport; other 14 isolated scenarios fit; all active fallback scenarios fit |
| Keyboard controls | Tabs/radios/dialog Escape/focus return/publish dialog | FAIL | Tested public interactions pass; structured admin publish confirmation fails; exhaustive accessibility audit unverified |
| Public titles/metadata | Actual title/description DOM and isolated title/social/favicon edits | FAIL | Active Home title Ganesh has no description; interiors have metadata. Full canonical/robots/OG/crawler coverage unverified |
| API authorization | CSRF 403, anonymous/forged/expired 401, editor 403, invalid preview 404, preview GET 405, setup disabled 410, revalidation 401 | PASS | `admin-extra-results.json`, `admin-error-results.json`, `backend-final-results.json` |
| Login rate limit | Eleven invalid attempts with isolated synthetic identity | PASS | `admin-extra-results.json`: 429 and retry 900 seconds |
| DB/media restart persistence | Restart isolated production servers, replay session, compare stored draft/publication hashes | PASS | `restart-results.json`: session 200, draft version/content and publication preserved |
| Active data integrity/security scan | Before/after six table hashes, 16 media sizes, nine table integrity checks, client secret search | PASS | `persistence-results.json`; 37 compiled client files, no configured secret match; not penetration testing |
| Admin automated unit suite | Current installed Node test runner | PASS | `unit.log`: 27/27 |
| Public committed unit suite | Inspect current scripts/tests | NOT IMPLEMENTED | No public test script/formal unit suite; current ad hoc browser audit does exist |
| Admin lint/typecheck/build | Installed ESLint; Next typegen + TypeScript; production build | PASS | `lint-admin.log`, `types-admin.log`, `build-admin.log` |
| Public typecheck/build | Next typegen + direct TypeScript; independent and isolated production builds | PASS | `types-public-independent.log`, `build-public-independent.log`, `build-public-isolated.log` |
| Full public lint | Current unscoped ESLint command | FAIL | `lint-public.log`: 931 errors, 20072 warnings; generated/temp directories included |
| Public source lint | ESLint app/components/lib/other source scope used by current audit | PASS | `lint-public-source.log`; does not override failing full lint |
| Deployed site/production infrastructure | No deployed origin supplied or verified | UNVERIFIED | Local production builds are not deployed-host verification |

## Confirmed issues and reproduction

Severity: P1 blocks content correctness/readiness; P2 is a functional/accessibility/configuration defect requiring follow-up. Reproduce mutations in the isolated environment only, then restore original content.

1. **P1 — saved controls do not affect the public site.** Set unique text or URLs in Content fields/contact settings, Save Draft, Save & Publish, refresh the public route. Database/public-content snapshot contains the change, but the public DOM does not. Confirmed paths: `global.quoteLabel`; `pages.home.fabrics.copy`, `pages.home.values.copy`, `pages.home.help.copy`; `pages.home.hero.primary.href`, `.secondary.href`; `pages.home.footer.primary.href`, `.secondary.href`; `global.maps`; `pages.home.footer.details.0.source` (address source selection does not resolve global address); `pages.home.footer.legal`. Some newer `designCopy` controls are wired while overlapping legacy controls remain exposed. Evidence: targeted field/link JSON. Do not label all unobserved snapshot values defective without further testing.
2. **P2 — gallery focal point and video accessible description ignored.** In the first featured product, change gallery focal point to `10% 90%`, change video description, save/publish, open public product. Computed `object-position` remains `50% 50%`; video aria-label remains “Full Sublimation Jersey video preview.” Caption/alt/reordering otherwise persisted and rendered. Evidence: `gallery-final-results.json`.
3. **P2 — CMS Home horizontal overflow on mobile.** Publish the current source draft in isolation, open Home at 390×844 with dialogs closed, measure `document.documentElement.scrollWidth`: 403. Active fallback Home fits. Offender rectangles include deliberately scrolling tabs, so the causal CSS element is not conclusively isolated. Evidence: `overflow-reproduction.json`, `screens/mobile-overflow.png`.
4. **P2 — structured content publish dialog ignores Escape.** Open `/content`, click Save & Publish, press Escape. Confirmation remains visible; Cancel dismisses it. Visual editor confirmation passes the same Escape/focus test. Evidence: `admin-error-results.json`.
5. **P2 — new CMS images fail local production optimization.** Upload real image privately, publish in clone, request raw media (200) and generated `/_next/image` URL (400). Local production Next rejects the loopback/private IP upstream with `dangerouslyAllowLocalIP` false. This does not establish that a deployed public hostname fails. Fix the intended origin/configuration with scoped protection and retest; do not broadly disable private-network protection. Evidence: `upload-production-results.json`.
6. **P2 — full public lint does not pass.** Run current unscoped lint after a production build. `.next-editor-build`, `.temp`, `.tmp` are included; total 21003 problems. Source-only lint passes. Correct ignore scope and rerun the repository's normal command. Evidence: `lint-public.log`.
7. **P2 — active Home lacks a meta description / current draft is not the active publication.** Inspect current active Home `<head>` and publication snapshot: Home lacks description, publication lacks integration version 2. This is a current state issue, not a failed authorized publication. Decide intended content and validate metadata before an expressly authorized active publication.

## Exact remaining checks before a whole-system readiness claim

1. Fix/reconcile the exposed missing bindings, crop/description defects, CMS Home overflow, structured dialog behavior, local image delivery configuration and normal lint command; rerun their recorded reproductions and affected regression checks.
2. Complete field-level classification in `field-verification.tsv`. The bulk audit saved 619 text probes and observed 504. The other 115 include inactive states, obsolete/overlapping fields and missing consumers; targeted probes already establish some failures. The other 385 snapshot values include IDs, references, constrained/default controls and media, not automatically editable fields. Mark an individual field PASS only with its own relevant evidence, or explicitly document/remove unsupported exposure. Bulk save success is not binding success.
3. Exercise remaining collection/nested collection **UI** add/edit/remove/reorder combinations, not just API round trips. Include order-builder option collections, support prompts, footer slots, fabric empty/deleted categories, invalid bounds and cancellations. Confirm every enabled inventory action either works or is documented as unsupported.
4. Verify untested media states: VTT captions, upload progress/cancel/retry under throttling, actual near/over-limit size cases, all image crop variants, missing-file handling, physical audio and fullscreen. Existing invalid-format, byte-range and actual-upload checks already passed.
5. Verify actual intended account workflow without violating the user's prohibition on password changes. Owner credentials were not used. Successful password change is unverified; wrong-current-password rejection passed. Define expectations for reset, notifications, quote submission and support backend; they currently lack those implementations.
6. Test physical mobile touch/swipe and supported browsers, exhaustive keyboard/accessibility behavior, screen readers, reduced-motion variants, external Maps navigation, complete SEO/canonical/robots/social metadata and crawler behavior. Current widths are simulated Edge viewports, not physical devices.
7. Exercise DB outage/recovery and failed revalidation/cache retry, disk/upload errors, deployment media persistence and backup/restore. The simulated UI 503, real stale conflicts, restart persistence and successful cache refresh do not prove every outage case.
8. Add a maintained public automated suite and run the final normal lint/type/build/test commands on the corrected source.
9. Supply and verify deployed admin/public origins: HTTPS/session cookies/proxy, intended content source, database grants/migrations, persistent media mount, Next optimizer, cache/CDN, private drafts, production role enforcement and backups. No deployed-host result is established by this report.
10. After fixes and an approved final-content review, obtain explicit authorization for the real active publication, then verify latest intended content/media/metadata and refresh/cache on the deployed site. The audit intentionally leaves active draft 42/publication 35 untouched.

## Evidence interpretation and reproduction cautions

- Early generic dialog/carousel/radio checks used unsuitable automation assumptions. Corrected targeted scripts used wheel scrolling, visible radio labels, native-dialog focus behavior and actual control labels. Their final passes supersede those harness failures. Native dialogs may move Tab focus to browser chrome, temporarily leaving document activeElement as BODY; that alone is not page focus leakage.
- Earlier team checks selected a hidden option, collection probes used invalid sample fields, and publish probes sought the wrong label. `admin-retest-results.json`, `collections-results.json`, `admin-extra-results.json` and targeted tests contain the corrected actual results. Missing legacy `fabricCategories` generic templates are not a failure of the category UI, which was exercised with real persistence.
- The first isolated iframe used a production CSP compiled for another origin. Rebuilding public with the isolated preview origin resolved it. An overlapping build and a sandbox filesystem error were also superseded by independent successful builds; they are not product defects.
- Synthetic field strings temporarily change labels in isolated inventory snapshots. The complete machine inventories retain those actual observations. They are not active content changes.
- Test scripts require the isolated configuration and database. Do not replay publishing scripts against active origins or upload private artifact configuration/content snapshots. The two generated TypeScript harnesses are retained with `.ts.txt` extensions to avoid entering the app's TypeScript source scope.

## Detailed inventory artifacts

- `admin-inventory.json`: all recorded settings/content fields, action labels, repeated add/remove/reorder buttons and groups. The expanded Content fields page recorded 1018 controls and 548 buttons, including repeats; this is not 1018 distinct editable schema fields.
- `editor-inventory.json`: all 47 panels, each field/action label. Home 14, Products 8, Customize 11, Our Work 6, Production 8.
- `active-public-results.json` and `isolated-public-results.json`: route/viewport headings, sections, links, buttons, input controls, image checks and SEO observations.
- `field-verification.tsv` and `normalized-fields-results.json`: per-snapshot-path status, persistence/public evidence and explicit UNVERIFIED values. Targeted dynamic additions (for example newly created focalPoint) are additional rows.
- `verification-matrix.json`: machine-readable copy of the matrix above, with evidence filenames.

Admin page inventory: `/`, `/login`, `/dashboard`, `/content`, `/editor`, `/settings/general`, `/settings/branding`, `/settings/contact`, `/settings/account`, `/settings/users`; invalid settings produce 404. Branding directs editing into the existing visual editor. Public page inventory: `/`, `/products`, `/customize`, `/our-work`, `/production`; `/editor-preview` is a protected preview transport, not a normal public page.

Admin API/transport inventory: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/account`, `/api/content`, `/api/content/revalidate`, `/api/editor-preview`, `/api/media`, `/api/public-content`, `/api/settings/roles`, `/api/settings/users`, `/api/setup/bootstrap`, `/media/content/[filename]`. Public API: `/api/revalidate`. Authorization/privacy tests cover these workflow groups; exhaustive every-method/every-parameter security testing and the auxiliary design-import database workflow remain unverified.

## Visual editor panel checklist

Every panel below opened successfully. Fields/actions are recorded in the JSON inventory; individual persistence and binding coverage follows the matrix and TSV, not the panel-open result.

| Page | Panels inspected |
|---|---|
| home | Header and navigation; Support chat · preview copy; Footer and contact details; Search appearance (SEO); Hero / introduction; About Ganesh; Featured products · video & gallery; Product showcase; Fabrics; Production; Our Work; Order form; Values; Size guide and questions |
| products | Header and navigation; Support chat · preview copy; Footer and contact details; Search appearance (SEO); Main section; Products and product details; Fabrics; Explore our work |
| customize | Header and navigation; Support chat · preview copy; Footer and contact details; Search appearance (SEO); Main section; Before you order; Order form; Product options; Fabric options; Customization and sizes; Size guide and questions |
| ourWork | Header and navigation; Support chat · preview copy; Footer and contact details; Search appearance (SEO); Main section; Stories and images |
| production | Header and navigation; Support chat · preview copy; Footer and contact details; Search appearance (SEO); Main section; Production steps; Before production; Questions and answers |
# Current repair follow-up

The original audit below is retained as historical evidence. Current repairs, passing retests, remaining limits and the local/deployed distinction are documented in [SYSTEM_REPAIR_2026-10-09.md](SYSTEM_REPAIR_2026-10-09.md). Field classifications and remaining scalar coverage: [FIELD_VERIFICATION_REPAIR_2026-10-09.tsv](FIELD_VERIFICATION_REPAIR_2026-10-09.tsv). Whole-system acceptance remains UNVERIFIED; manual checkboxes are unchanged.
