# CMS rendering contract

Updated 2026-10-09. Saved content is never normalized just because it is loaded or an unrelated field is edited.

| Control | Source and behavior |
|---|---|
| Header quotation text | `designCopy.SiteHeader.buttonText` is canonical; `global.quoteLabel` and `designCopy.SiteHeader.buttonText3` are compatibility controls. A deliberate edit to any of these updates the linked controls together. |
| Footer legal first line | `designCopy.SiteFooter.description3` is canonical; `pages.home.footer.legal` is a compatibility control. Footer second line remains the independent `designCopy.SiteFooter.description4`. |
| Existing differing linked values | Retained unchanged until deliberately edited. The canonical design control renders. Conflicting simultaneous changes return 422, preserving the working copy. No active snapshot was reconciled automatically. |
| Home copy | `pages.home` owns hero, section introductions and contact invitation. Fabrics, Values and Help descriptions now render in their existing section introductions. |
| CTA destinations | `pages.home.hero.primary/secondary.href` and `pages.home.footer.primary/secondary.href` own their anchors. Their `external` switches own new-tab behavior. The global Maps link is independent. |
| Navigation | `global.nav` owns labels, destinations, ordering and external flags. The structured editor manages the collection; the visual editor intentionally offers menu-text controls only. |
| Footer details | Each detail's `source` resolves the matching Global setting, including Facebook; omit the source for custom `value`. Address/location uses Maps, email uses mailto, phone uses tel, Facebook uses its saved URL. Other values remain text. All detail slots render. |
| Other global contact fields | These are conditional contact sources, not automatically new visible rows. Select them in footer details to display them. |
| Builder text | `editorial.labels.builder` owns the four step headings/labels, inputs, note placeholder and summary labels. Product-dialog action text belongs to `editorial.labels.productDialog`. Builder customization is independent of dialog customization. |
| Fabric details | `benefits`, `recommendedUses`, current descriptions and media own the cards. Legacy `qualities` is retained read-only; it is not a second competing benefits editor. |
| Gallery/video | Gallery image `focalPoint` owns thumbnail/enlarged crop. Video `alt` owns its accessible description, with a product-name fallback when blank. Poster alt/crop applies to the fallback image. |
| SEO | Home uses `global.seo`; interior routes use their `metaTitle/metaDescription`. Favicon and sharing image use Global media; sharing alt renders as `og:image:alt`. `PUBLIC_SITE_ORIGIN` sets metadataBase. Signed private preview reflects these draft values in its head and remains private/noindex. There are no editable canonical/robots/Twitter controls. |
| Version gate | Only publications explicitly containing `editorIntegrationVersion: 2` opt into current rendering. An older publication uses source fallback. This gate is intentional; do not add the version to active data without reviewing the preserving candidate and obtaining publication authorization. |

`lib/content/copy-aliases.ts` reconciles only deliberately changed linked copy. Both editors reconcile the working snapshot for accurate preview; the server repeats the check under the version lock. Save responses return the exact reconciled snapshot. API callers must retain that returned content when continuing to edit.

Read-only retained controls have an explanation in both editors. These include the three absent legacy Products controls (`heroCaption`, `buildOrder`, `specialRequest`), removed header support-menu labels, the old fabric disclaimer, imported `designMedia` backups, old fabric qualities, portfolio tile descriptions and complete legacy portfolio action labels superseded by current Design copy fragments. Their saved values and uploaded files are retained. Internal IDs, schema/integration versions, media asset IDs and order scalars are not public text fields; order is managed through collection actions.

No change to saved copy is performed by deployment/build. `scripts/prepare-publication-upgrade.ts` reads the publication, fills only absent integration fields, verifies every existing value is retained, and writes an original/candidate pair under ignored `.local-setup/publication-upgrade`. It performs no database writes. Review the candidate in isolation, including any differing legacy/design copy, before requesting active publication.

## Local production images

Keep Next's `dangerouslyAllowLocalIP` false and redirects disabled. With `CMS_ALLOW_LOCAL_MEDIA=true` and an exact loopback `CMS_MEDIA_ORIGIN`, published CMS image references are adapted in memory to `/cms-media/<UUID>.<image extension>`. This bounded route sends no credentials or caller headers, accepts no upstream URL/query override, follows no redirects, allows only image MIME types and at most 5 MB, and relies on the CMS publication-visibility check. Stored snapshots remain unchanged. Draft anonymous requests remain 404.

Remote HTTPS CMS origins continue through Next's scoped remotePatterns and private-IP protection; the loopback transport is not a general private-network exception. Deployed hostname, TLS, proxy and storage behavior require deployed verification.

## Accepted workflow scope

The user confirmed planner/demo scope for the intended release. Quote selections are local planning only and are not sent or placed as orders. Support is a demo without a live agent/order lookup. Self-service password recovery and Notifications are not implemented. UI notices disclose these limits; Notifications is disabled. No email, messaging, payment or other external service is connected.
