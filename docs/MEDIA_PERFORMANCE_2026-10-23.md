# Media Library and Visual Editor performance — 2026-10-23

Implemented locally in the admin repository and the sibling public website's
private `components/cms/PreviewShell.tsx`. No content was published and nothing
was deployed. Both repositories were clean when inspected before implementation.
Applicable AGENTS.md files and each installed Next.js route-handler guide were
read first; the installed image guide's authentication/cache guidance was also
checked. No agents were delegated work.

## Changes

- The library list now reads only media metadata, with server-side search/type
  filtering and 36-item pages (API maximum 100). Search treats `%`, `_` and `=`
  literally. Content snapshots and usage lists are excluded from this request.
- Opening details loads usage for that asset through authenticated
  `GET /api/media/:id`. Published versions, current drafts, both saved-draft
  snapshots, revision history, and the two existing fallback content sources
  retain the original authoritative reference checks.
- Saved files display independently of discovery. Mounted libraries share an
  in-flight discovery promise. The database lock prevents concurrent imports
  across tabs/processes; another caller receives 202 and checks authenticated
  discovery status until completion, then refreshes the current query/page.
  Failed discovery leaves the loaded files usable. Obsolete list searches abort.
- Image cards use lazily loaded WebP derivatives bounded to 384 × 288, generated
  with the existing Sharp dependency and retained under the private runtime
  media directory. Every thumbnail request checks authentication and the active
  asset row and responds `private, no-store`; derivatives never enter public/
  or the public image optimizer. Selection and full-size details use originals.
  Video/external cards avoid original downloads and offer full preview on open.
- Editor snapshots are sent immediately. The signed preview asks for visible
  images, posters and video sources, including newly opened galleries; branding
  and favicon are prioritized separately. A four-request queue deduplicates
  downloads, aborts obsolete page work and ignores outdated completions.
  Authenticated original bytes cross into the preview only as in-memory data
  URLs. Cached bytes are delivered once per frame, with subsequent media deltas;
  text edits carry no unchanged media. A fresh frame handshake rehydrates cached
  media and retains the editor's unsaved snapshot.
- Delete is prominent in details for both the standalone library and image
  picker. Confirmation includes a thumbnail, filename, Cancel and permanent
  Delete, with keyboard focus on Cancel. Usage restrictions and exact saved
  locations explain required changes. Current unsaved content is shared with
  nested pickers and blocks deletion of its selections.
- Deletion still uses the existing transaction, content/asset locks, immediate
  reference recheck, file quarantine/rollback and audit trail. An additional
  ownership check protects shared storage paths. It never removes content,
  history or hosted source files. Successful deletion removes the card and
  selection locally and refreshes mounted libraries without reloading the
  editor. Missing files can have unused catalog entries removed; failures keep
  the selection available for retry. Selecting media checks existence again.

No schema migration or new package is required.

## Local measurements

The reproducible benchmark runs the previous listing algorithm and the new
listing against the same local MariaDB dataset, five times each. A SHA-256
fingerprint of active asset rows and all reference snapshots is checked before
and after. Dataset: **71 assets, 42 snapshots, 1,430,624 snapshot JSON bytes**.

| Measurement | Before | After |
| --- | ---: | ---: |
| Median server-function list time | 1,733.61 ms | 1.01 ms |
| List JSON bytes | 369,985 | 14,566 |
| Files returned initially | 71 | 36 |
| Content/history scans for the initial list | Every asset | None |
| 36-image card sample | 6,422,544 original bytes | 292,090 thumbnail bytes |

The local list median is 99.94% lower; the list response is 96.06% smaller and
the thumbnail sample is 95.45% smaller. First-time serial generation of those
36 thumbnails took 1.25 seconds in a separate local sample; subsequent requests
reuse the private derivative files. Thumbnail delivery remains authenticated.

These are **local server-function and byte-size benchmarks**, not deployed
HTTP latency, Core Web Vitals, or browser paint measurements. Full local dev
navigation includes compilation and hydration; the browser test verifies that
cards render while a deliberately delayed 4-second discovery is still pending.
The preview test verifies that content/text updates arrive before a deliberately
delayed 3.5-second media fetch, off-page images stay deferred, and later text
snapshots contain zero unchanged media entries. There is no measured old-browser
preview timing or deployed-site performance baseline.

Reproduce locally:

```powershell
node --experimental-strip-types scripts/benchmark-media.ts
npm run test:e2e:media-performance
npm run test:e2e:editor
```

The browser suite requires the existing local dataset with more than 36 media
assets, matching admin/public preview configuration and local servers on the
configured origins. `PLAYWRIGHT_PACKAGE_PATH` can override the local browser
automation dependency path. It creates and cleans up its own uploads, session
and temporary reference-test draft; editor content itself is a browser fixture.
The shared draft and publication are compared before/after and remain unchanged.
Normal media deletion audit/soft-deletion records are retained for QA uploads.

Raw local evidence is in `.visual-qa/performance/`: `before.json`, `after.json`,
`comparison.json`, `browser.json`, and desktop/mobile screenshots. The benchmark
source is checked in; raw evidence is intentionally ignored by Git.

## Verification

- Admin: 61 unit tests; full ESLint; Next type generation/TypeScript; webpack
  production build.
- Public website: 3 unit tests; scoped ESLint for PreviewShell; Next type
  generation/TypeScript; production build.
- Headless Edge media/API suite: library opening during delayed discovery,
  server search/pagination, lazy thumbnails, browser multi-upload, image reuse,
  slow-media text updates, off-page deferral, page switching, cached transport,
  frame reconnection, private MP4 source discovery/playback/ranges, and
  unsaved-content preservation. No browser page errors were recorded.
- Deletion: unused image, filename/preview confirmation, cancellation, simulated
  failed deletion and retry, missing file, stale selection, unsaved reference,
  stored reference, reference introduced after details opened, unauthorized
  requests, cross-origin requests, and storage-path uniqueness/ownership.
- Discovery: real database lock contention/status and existing idempotent-import
  unit coverage. No duplicate import ran during lock contention.
- Existing editor draft browser suite: named drafts across refresh/sign-in,
  read-only viewing, save/discard/load, undo, mobile dialogs, focus behavior and
  intercepted publication success/failure. Published content remained unchanged.
- Final cleanup check: active assets and all 42 reference snapshots match the
  benchmark fingerprint exactly (71 active assets); no QA reference draft remains.

## Remaining limits

- No deployed measurements, CDN/proxy checks, physical-device or screen-reader
  review were performed. Existing user manual-verification items remain open.
- Initial thumbnail creation costs CPU; unsupported/missing image previews show
  an unavailable message. External media and video cards use a lightweight label
  rather than a generated thumbnail; full details retain original viewing.
- Detail/delete usage checks still read all reference snapshots for one asset.
  Discovery still scans snapshots and the public media folder in the background.
  Very large histories may warrant a persisted reference index later.
- Visible media, especially MP4s, still transfers original bytes once per editor
  session and occupies memory in the admin and preview frame. Unsubmitted edits
  in other browser sessions are unknown to the server; stale selection/save
  validation remains authoritative for those sessions.
- Admin and public preview protocol changes should be released together during
  a separately authorized deployment. No deployment or publication occurred.
