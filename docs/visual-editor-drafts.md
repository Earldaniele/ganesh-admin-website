# Visual editor changes and named drafts

The editor keeps typing, media selections, and collection edits in a working
snapshot. Switching panels or website pages and closing a panel with **Done**
retain that snapshot. Validation runs when saving or publishing, so partially
typed fields do not block navigation. Incomplete image links retain the previous
image in the iframe while the original input remains editable.

**Changes (N)** compares the working snapshot with the content originally opened
in this editing session (or the baseline stored with a loaded draft). Reverted
values disappear. Linked text aliases and image source/asset selections count as
one editable field. Collection additions, removals, and ordering are explicit;
derived numeric order metadata does not inflate the count. Individual changes
can be undone, and Discard all restores the baseline after confirmation.

**Save Draft** inserts a new named snapshot into `saved_editor_drafts`. Each row
has its own UUID, content, baseline, server-computed change details, affected
sections, author, and UTC save time. Duplicate names are allowed and never replace
another row. Saved drafts are shared with authenticated administrators for this
site, following the existing shared CMS draft convention. They persist across
refresh and sign-in. Unsaved working edits remain in memory; use Save Draft before
refreshing or leaving the editor.

Saving does not clear Changes (N). The saved indicator separately compares the
working snapshot to the most recent saved/loaded snapshot. Further edits display
Unsaved changes. Viewing saved draft details is read-only. Loading an alternative
while unsaved edits exist requires either saving a new named draft first or
explicitly discarding those edits.

Named saves do not update `site_drafts`, `site_publications`, revision history, or
public media permissions. Publishing continues through the existing versioned
shared-draft save and role-protected publication endpoints, after confirmation.
A version conflict or publication failure retains the working content and change
review. Only successful publication clears the pending changes. Named drafts
remain available after publication. Media usage checks protect images from both
the saved snapshot and its before values against deletion.

## Deployment and verification

Apply `database/migrations/006_saved_editor_drafts.sql` through `npm run db:migrate`
using a database migration account with CREATE permission. The restricted runtime
app account needs only its existing SELECT/INSERT/UPDATE/DELETE access. No seed or
existing-content replacement is required.

- `npm test`: changes, reverts, stable record identity, additions/deletions,
  ordering, linked aliases, image selections, provisional image links, and media
  retention, alongside existing validation/security tests.
- `npm run typecheck` and `npm run lint`.
- `npm run build` (set `GANESH_BUILD_DIR=.next-build` to keep build output separate
  from a running development server).
- `npm run test:e2e:editor`: with the local admin server and migrated MariaDB
  running, verifies real named saves, refresh/new-session persistence, read-only
  inspection, safe loading, undo/discard, mobile review, and keyboard focus.
  Temporary drafts/audit records/sessions are cleaned up. Publication transport
  is intercepted to test confirmation, failure, and success without changing the
  live website or the shared draft.

The UI follows the specified burgundy toolbar, cream panels, red actions, and
existing Ganesh branding. No mockup attachment was available in this chat context.
