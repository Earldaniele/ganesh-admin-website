# Admin responsive verification

Verified on 2026-10-23 after inspecting the existing routes and styles and reading the installed Next.js guides for CSS, layouts/pages, client components, and viewport defaults.

## Changes

- Retained the existing colors, logos, typography families, content, authorization, and save/publish behavior.
- Used the existing CSS system with consistent 1200px compact-layout, 900px drawer, and 640px phone breakpoints.
- Made admin navigation and editor sections dismissible drawers with explicit close controls, Escape handling, keyboard focus containment and restoration, and background scroll locking. Navigation remains scrollable in short landscape viewports.
- Moved the mobile menu into the page header so it cannot cover scrolled content.
- Adjusted dashboard grids, settings tabs/forms, account lists, nested content fields, order-option actions, media filters/cards, editor tools and edit panels. Kept long filenames readable and mobile fields at 16px with touch-friendly control heights.
- Bounded dialogs to the viewport with internal vertical scrolling. Device previews retain their intended widths inside the editor's own horizontal scroll container.
- No admin route currently renders a table; team accounts use responsive rows that stack on smaller screens. All row data and actions remain available.

## Route and viewport coverage

All nine pages below passed at **360, 390, 768, 1024, and 1440 CSS pixels**, in both development and the production build:

| Page | Route |
| --- | --- |
| Login | `/login` |
| Dashboard | `/dashboard` |
| Content and Media Library | `/content` |
| General settings | `/settings/general` |
| Branding | `/settings/branding` |
| Contact | `/settings/contact` |
| Account / Password | `/settings/account` |
| Users & Roles | `/settings/users` |
| Visual Editor | `/editor` |

Each run performed 125 layout assertions, captured 119 screenshots, and reported zero browser exceptions or unexpected content writes. Checks included fully expanded nested fields, order options, media details, publication dialogs, all three preview sizes, header editing for all five editor page choices, and the featured-products, fabrics, order-form and size-guide panels. Also verified drawer focus wrapping, Escape/close/backdrop dismissal, landscape navigation at 768×360, and restoration of desktop navigation after resizing an open drawer.

Screenshots and machine-readable reports are retained locally in `.visual-qa/responsive/` and `.visual-qa/responsive-production/` (Git-ignored).

## Validation results

- `pnpm lint` — passed; final changed TypeScript/JavaScript files also passed a targeted ESLint run.
- `pnpm typecheck` — passed after the production build finished.
- `pnpm test` — all 43 tests passed.
- `GANESH_BUILD_DIR=.next-build pnpm build` — passed with webpack.
- `pnpm test:e2e:responsive` — passed against development and production servers.
- `node tests/admin-language.e2e.mjs` with `ADMIN_TEST_DB_SESSION=1` — passed existing media restrictions, picker, settings, permissions, and save/publish regression checks. Six content requests and two deletions were intercepted; no saved content or media files were changed.
- `git diff --check` — passed.

An intermediate typecheck overlapped a build clearing generated types; it was rerun successfully after the build. One sandboxed build encountered a Windows `EPERM` creating an output directory; the final build completed successfully outside that sandbox restriction.

## Repeating the responsive check

Use the seeded local database, an existing administrator, and a populated Media Library. Start the admin server, then run in PowerShell:

```powershell
$env:ADMIN_TEST_DB_SESSION = '1'
$env:ADMIN_TEST_ORIGIN = 'http://localhost:3001'
pnpm test:e2e:responsive
```

The test creates and then deletes a temporary local authentication session. It intercepts media synchronization and blocks content/account/media writes. Alternatively, omit `ADMIN_TEST_DB_SESSION` to use the configured local test login. `PLAYWRIGHT_PACKAGE_PATH` can select a different installed Playwright package, and `RESPONSIVE_QA_OUTPUT` can select a screenshot directory.

## Limits

Browser checks used headless Microsoft Edge/Chromium with resized viewports. Physical iOS/Android devices, Safari, Firefox, mobile virtual keyboards, and screen-reader output were not verified. Real publication, account changes, and media deletion were intentionally not performed during layout validation.
