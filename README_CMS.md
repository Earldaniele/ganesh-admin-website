# Ganesh CMS — MariaDB / XAMPP / phpMyAdmin

The local CMS is connected to `ganesh_cms` on MariaDB 10.4.32. phpMyAdmin manages the database; it does not run Next.js. No Supabase, PostgreSQL, browser database credentials or image binaries in SQL are required.

## Current workstation database connection (2026-10-08)

This workstation runs two separate MariaDB installations. XAMPP MariaDB 10.4.32 now uses `127.0.0.1:3307`; the standalone MariaDB 12.2 service retains port 3306. The admin `.env.local`, phpMyAdmin server port and XAMPP Control Panel MySQL port are configured for 3307.

The existing `ganesh_cms` database is stored under `C:\xampp\mysql\data\ganesh_cms`. Its InnoDB files also depend on shared files in `C:\xampp\mysql\data`; use a SQL export for backup rather than copying only the database folder. The migration source files are in `database/migrations`.

The port fix preserved the existing data. Verified: app database credentials connect to XAMPP, all three migrations are applied, an admin account and draft/publication exist, phpMyAdmin displays the database, and `/api/public-content` returns HTTP 200. The old temporary credentials and screenshot credentials return HTTP 401; no account passwords were reset.

Configuration backups and the elevated repair script/result are in `.local-setup/database-port-fix-20261008-232157` (git-ignored).

## Open the running apps

- Public website: http://localhost:3000
- Admin: http://localhost:3001/login
- Content fields: http://localhost:3001/content
- phpMyAdmin: http://localhost/phpmyadmin (Apache must be running)

Both Next development servers were started locally. For future sessions, start MariaDB in XAMPP, then run `pnpm dev --port 3001` in the admin repository and `pnpm dev --port 3000` in the public repository. Use localhost consistently because cookie writes enforce the configured admin origin.

The generated first-login credentials are in `.local-setup/admin-access.txt` (git-ignored). Change the temporary password in Settings → Account, sign in again, then delete that access file. Existing account passwords are never reset by normal setup/seed commands.

## What was repaired

- Broken pnpm dependency links and missing mysql2/Zod/type packages. Both repositories use their existing pnpm 11.3.0 workflow; no fake type declarations.
- Public homepage HTTP 500: dynamic hero source lost its blur placeholder data. The existing image's blur data is now supplied without changing layout, CSS or motion hooks.
- Development CSS errors caused by scanning generated build artifacts: `.next-build` is excluded from Git/Tailwind source discovery.
- Save & Publish now saves the current canvas before publishing, rather than publishing an old draft and discarding unsaved edits.
- Visual Editor saves merge with the database draft; they preserve full product details, inactive items, settings, media IDs and focal points.
- Settings load actual saved values; network/validation/conflict states remain visible. The dashboard reads real publication/audit state.
- Structured Content fields provide repeatable collections, ordering, activation, removal confirmation, references, full details and uploaded media.
- Shared schema validation, same-origin writes, bounded requests, persistent login throttling, opaque HTTP-only sessions and server-side authorization.
- Draft images require authentication. Published media remain available for revisions. Runtime files are served through a route, not assumed to appear in a build's public folder.

No public design tokens, fonts, layouts, animation configuration or decorative features were changed.

## Migration and seed

Files:

- `database/migrations/001_ganesh_content_mysql.sql`: seven InnoDB CMS tables.
- `database/migrations/002_security_and_media.sql`: login throttling and published-media visibility.
- `scripts/migrate.ts`: migration lock and checksum tracking in `schema_migrations`.
- `lib/content/initial-content.json`: validated public fixture (8 products, 5 fabrics, 8 production steps, 5 work categories / 25 work images).
- `scripts/import-public-fixture.ts`: imports actual public products/catalog/fabrics/production/work/work-stories. Embedded copy remains a reviewed fixture.
- `scripts/seed-content.ts`: atomic first publication, draft, revision and audit entry; refuses partial snapshots and never overwrites existing content.

For an already-configured installation:

```powershell
pnpm db:migrate
pnpm seed:content
pnpm validate:content
```

Re-running the applied migrations and seed was verified to preserve data. New DDL migrations require an administrative migration identity, not the restricted app user. Set MYSQL_USER/MYSQL_PASSWORD only for that administrative command and clear the temporary environment overrides afterward.

For a fresh local installation with neither repository containing .env.local:

```powershell
pnpm install
pnpm setup:local
```

The local setup tool connects to XAMPP root by default (or MARIADB_SETUP_USER/MARIADB_SETUP_PASSWORD), creates the database/schema/seed, a restricted ganesh_app database user, local environment files and a generated admin password. It refuses existing configuration. PUBLIC_REPO_PATH can select the sibling public repository.

Manual phpMyAdmin alternative: create/select ganesh_cms with utf8mb4_unicode_ci, import both migration SQL files in order, provision a dedicated database user, configure both .env.local files from their examples, then run db:migrate (with a migration identity), seed:content and create:admin. The migration tracker adopts the existing repeatable tables.

To create an additional account, supply ADMIN_EMAIL, ADMIN_PASSWORD (10–256 characters) and optionally ADMIN_DISPLAY_NAME to `pnpm create:admin`. This command does not overwrite an existing email/account. Password changes revoke existing sessions. There is no public sign-up or pretend email-reset flow.

## Environment and access

Admin .env.example lists MYSQL_HOST/PORT/DATABASE/USER/PASSWORD, MYSQL_CONNECTION_LIMIT, MYSQL_SSL, ADMIN_SITE_ORIGIN, CMS_MEDIA_DIR, CMS_MEDIA_ORIGIN, CMS_ALLOW_LOCAL_MEDIA, PUBLIC_SITE_ORIGIN, PUBLIC_SITE_REVALIDATE_URL and PUBLIC_SITE_REVALIDATE_SECRET.

Public .env.local needs only CMS_PUBLIC_CONTENT_URL, PUBLIC_SITE_REVALIDATE_SECRET, NEXT_PUBLIC_MEDIA_ORIGIN and CMS_ALLOW_LOCAL_MEDIA. Only the media origin is a browser-visible value; the public application never receives database credentials.

MariaDB does not use Supabase RLS. Authorization is enforced by the server on every protected route and protected page, with a database user restricted to DML on ganesh_cms. Administrator/editor profiles are authorized CMS users. Database connections and passwords stay server-side. The old HTTP bootstrap endpoint is disabled; use CLI setup.

## Draft / publication / media

The public server loads only the read-only published-content endpoint, validates it with the same schema as admin, and caches it for 60 seconds under ganesh-content. Temporary failures use a last-valid in-process publication or the public fixture fallback.

Saving a draft locks its row and compares the expected numeric version. Publishing atomically writes the current publication, immutable revision, published-media visibility and audit entry. After commit, admin calls the secret-protected public revalidation endpoint; it expires only ganesh-content immediately. Failed refresh does not undo a publication: use the retry control, or the short cache interval will refresh on a subsequent request. Existing open browser tabs still need navigation/reload.

Files live in `var/media/content` by default, with generated UUID filenames and DB metadata. PNG/JPEG/WebP/SVG are limited to 5 MB, decoded and validated server-side. Static SVG is rasterized to PNG; scripts, external references and unsafe SVG constructs are rejected. Dimensions and final byte size are recorded. Meaningful alt text is required.

Replacement/removal of content never deletes a stored file. There is intentionally no destructive media purge endpoint. Any future cleanup must check the draft, publication AND revision history. Back up media with the database. Runtime media, local secrets, backups and QA artifacts are excluded from deployment tracing.

## Backup, rollback and deployment

In phpMyAdmin, export ganesh_cms using SQL with table structure and data; include every table. Keep a matching copy of var/media in protected storage. These exports contain account hashes and private drafts: never commit or publish them.

To restore an installation, stop CMS writers, restore the SQL backup into a verified target database using phpMyAdmin, restore its matching media directory, apply any newer migrations, validate the snapshot, configure secrets and restart the apps. Do not import over unrelated databases.

For content-only rollback, select a known validated content revision, save it into the draft with a NEW optimistic-concurrency version, then publish normally. Do not rewrite history or lower version counters. Take a backup first and retain media referenced by the selected revision.

Deployment order: provision MariaDB and a migration identity → apply migrations/seed → provision a restricted app identity and persistent private media mount → deploy admin with HTTPS/runtime secrets → deploy public with its read-only CMS endpoint and matching secret/media origin → verify login/draft/publish/refresh → enable traffic. Set CMS_ALLOW_LOCAL_MEDIA=false outside deliberate loopback development. Do not expose XAMPP root/phpMyAdmin publicly.

## Local MariaDB system-table repair

During setup, CHECK TABLE identified corruption only in mysql.db; the other inspected privilege tables passed. The user explicitly approved backup and repair. The exact db.frm/db.MAD/db.MAI files were copied under a brief read lock and SHA-256 verified before REPAIR NO_WRITE_TO_BINLOG TABLE mysql.db. The repair and subsequent integrity check both returned OK.

Verified backup: `.local-setup/mysql-db-backup-2026-09-07T15-47-27-646Z`. Its manifest/result files record the checks. Do not delete this backup until local database permissions are confirmed. Restore of system privilege files is a DBA operation requiring a stopped server; do not copy them over a running server. The targeted procedure follows the [MariaDB REPAIR TABLE documentation](https://mariadb.com/docs/server/reference/sql-statements/table-statements/repair-table).

## Verification and scope

Executed: TypeScript, ESLint and production builds for both repositories; 13 schema/security/upload/migration tests; real MariaDB API smoke tests (login, invalid credentials, private drafts/media, invalid references/MIME, concurrency conflicts, added fabric/product/work image, publish, immediate refresh, logout); browser login and Visual Editor Save Draft / Save & Publish with a second unsaved edit, preservation of settings/details, and settings data load. Original site content was restored after the tests; test publications remain in immutable history.

Desktop (1440×1000) and mobile (390×844) captures cover all five public routes. Final captures returned HTTP 200, no browser runtime errors and no horizontal overflow. Screenshots/reports are in .visual-qa/completed. A fresh .visual-qa/pre-coverage baseline was captured before final data wiring. Excluding the Next dev badge, eight captures have zero changed content pixels at a 10-level channel threshold; Our Work differs by 3 desktop / 14 mobile pixels. This is a viewport comparison, not a whole-page pixel-parity claim. Public touch/motion and final copy approval remain user checks.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. To avoid colliding with a running dev server, set GANESH_BUILD_DIR=.next-build for validation builds. This directory must remain ignored. Browser scripts use installed Edge and the configured PLAYWRIGHT_PACKAGE_PATH (or this workstation's bundled runtime).

The remaining interior copy/images/SEO and builder-label wiring is now complete. Interior pages use the published header/footer; inverse/footer logo masks use the CMS logo. Fabric totals and builder fabric options are dynamic, and builder defaults are honored. The validated emergency fixture matches the admin seed. Code-owned validation/status strings, CSS/motion tokens and accessibility action messages stay outside the CMS. No quotation submission, payment or order-management backend was added.

Additional browser verification: scripts/smoke-content-coverage.mjs checks draft privacy, image replacement, added fabric/product/work, interior shared content, SEO, production FAQ and builder defaults. scripts/smoke-motion.mjs checks normal-motion menu/dialog/fabric keyboard/FAQ behavior at 1440px and 390px. Original content was restored; final draft/publication version was 20.

## Content-field extension and configuration

For an existing installation, run `node --experimental-strip-types scripts/extend-content.ts` (or `pnpm migrate:content`) after deploying the updated shared schema and loader. It locks each snapshot, verifies a local backup, adds missing fields only, increments versions, records publication history/audit, and refreshes the public cache. Reruns do nothing. Keep .local-setup/content-before-extension-1788800494481.json for rollback of this workstation's extension.

Set PUBLIC_SITE_ORIGIN in the public deployment to its real HTTPS origin for SEO/social images. Local fallback is http://localhost:3000. Phone/email/hours are optional because the approved design has no extra contact block; assign a Footer detail's Source to a Global field to display it in an existing slot. Maps changes in Contact settings update the directions link.

If the pnpm launcher cannot reach its signature registry, restore registry connectivity; do not disable signature verification. With dependencies already installed, equivalent checks are `node node_modules/next/dist/bin/next typegen`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`, `node --experimental-strip-types --test tests/*.test.ts` (admin), and `node node_modules/next/dist/bin/next build`. Use the configured ports with `node node_modules/next/dist/bin/next dev --port 3001` (admin) / `--port 3000` (public). Generated build/backup/media outputs are excluded from linting.

## Team accounts and roles

As an Administrator, open Settings > Users & Roles. Create an account with a name, email, password (at least 10 characters) and role. Change another account’s role in Team accounts and click Save role; they must sign in again. Your own role is protected.

Editor can edit content, upload images and save private drafts. Administrator can also publish and manage accounts/roles. Add custom roles with an optional Can publish the website permission; custom roles never manage accounts. Built-in roles cannot be changed. Role updates take effect immediately and do not need content publication.

Apply database/migrations/003_users_roles.sql with a schema-management database user when upgrading an existing installation. Runtime ganesh_app needs only its existing data privileges. Run node --experimental-strip-types scripts/verify-team-roles.ts for real MariaDB tests contained in a rolled-back transaction. No test accounts become visible or remain stored.

## Featured Products video & gallery

In Visual Editor → Home → Featured products · video & gallery → Edit, choose Full Sublimation Jersey (or another featured product). Edit its name, copy and detail text; upload/replace MP4 up to 32 MB. The player retains original audio with native playback, volume and fullscreen controls. Add multiple PNG/JPEG/WebP/static SVG files up to 5 MB each (up to 30 gallery images), edit captions and alt text, replace/remove/reorder them. Keep one image for the public fallback. Uploads have progress and error feedback. Save Changes validates and persists the open panel directly in MariaDB; uploads reside in the existing runtime media directory. Save & Publish then updates the public website through the existing publication/revalidation flow. Editors require an authorized publisher for that step.
