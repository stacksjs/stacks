# Stacks Blog — Content Strategy

The blog lives at `/blog` and is **powered by BunPress** with a custom Stacks
theme. Posts are markdown files in `content/blog/*.md`; the slug is the
filename (`introducing-stacks.md` → `/blog/introducing-stacks`). BunPress
renders the markdown (syntax highlighting, containers, heading anchors, GFM);
the custom theme lives in `content/blog/.theme.css`; the renderer +
integration is `storage/framework/core/actions/src/dev/blog.ts`.

The RSS feed (`/blog/feed.xml`) and sitemap (`/blog/sitemap.xml`) are generated
by BunPress's own `buildRssFeed` / `buildSitemap` from the same markdown.

## Adding a post

1. Create `content/blog/<slug>.md` with frontmatter:
   ```yaml
   ---
   title: My Post
   description: One-line summary (used as excerpt + meta + RSS description).
   date: 2026-07-01
   author: The Stacks Team
   authorBio: Optional — renders an author card at the foot of the post.
   poster: /assets/images/marketing-park-trail.svg   # optional hero image
   featured: false                                   # one featured post at a time
   ---
   ```
2. Write the body in markdown. It appears at `/blog/<slug>` and in the listing,
   feed, and sitemap automatically.

## Positioning

One throughline ties every post together:

> **Stacks owns its entire stack.** Five years of building. The only runtime
> dependencies are TypeScript and Bun. We compete with the whole Laravel
> *ecosystem*, not just the framework — and we're proving it in public by
> taking every package to a stable `1.0`: **The Road to v1.0s**.

Every post should ladder back to that thesis and, where natural, link to the
`The Road to v1.0s` campaign and `/docs`.

## Cadence

Aligned to **The Road to v1.0s**: ship a post each time a notable package
reaches the summit (a stable `1.0`). Target **2 posts/week** — one "deep dive"
(why we built X) and one "shipping" note (what graduated this week, what's next).

---

## The launch post (LIVE)

### 1. Introducing Stacks — `introducing-stacks`
The thesis post. What Stacks is, the 5-year journey, the
own-the-stack philosophy, the catalog of first-party packages, the Laravel
ecosystem comparison, and the Road-to-v1.0s announcement.

**Planned follow-ups (each expands one thread from the launch post):**

- **Why we wrote our own linter and formatter** → deep dive on `pickier`
  (replacing ESLint + Prettier), speed numbers, the single-tool argument.
  - *Follow-up:* "Migrating a real project from ESLint + Prettier to pickier."
- **What it takes to emit `.d.ts` files** → `dtsx`, isolated declarations, why
  bundler-emitted types fall short.
- **Owning the view layer** → `stx` templating: signals, directives, SSR +
  streaming, why not JSX/Blade/Vue SFCs.
  - *Follow-up:* "Building a component with stx, end to end."
- **A CSS engine you control** → `crosswind`: utility-first without the
  upstream churn; custom rules and theming.
- **The query layer** → `bun-query-builder` + the ORM; Eloquent-style DX on
  Bun; how migrations are generated from models.
- **Deploy every surface with one command** → the `buddy deploy` path
  (marketing, docs, blog, API, app server, AWS via `ts-cloud`).
  - *Follow-up:* "From `bun create` to production URL in N minutes."
- **Docs as a first-party concern** → `bunpress` (our VitePress).
- **Local dev that feels like prod** → `rpx`, `tlsx`, `dnsx`, `localtunnels`.

---

## Series: "Own the Stack" (the deep dives)

A numbered series, one per major in-house package. Each post follows the same
beat: *the dependency we replaced → why it wasn't enough → what we built → how
to use it standalone → how it fits Stacks.* This doubles as standalone-package
marketing (people can adopt `pickier` or `dtsx` without Stacks).

Suggested order (highest "they actually built THAT?" factor first):
`pickier` → `dtsx` → `stx` → `crosswind` → `bun-query-builder` → `bunpress` →
`bun-queue` → `ts-validation` → `ts-collect` → `ts-cloud`.

## Series: "The Road to v1.0s" (the shipping log)

Short, regular cadence posts. Each entry: what graduated to `1.0`, the changelog
highlights, what's next on the climb. Cross-link to the relevant deep dive.

- **Campaign index — `the-road-to-v1` — LIVE.** The pinned manifesto the launch
  post links to (and which links back) — `content/blog/the-road-to-v1.md`.
  Future shipping-log entries should link back to it.

## Series: "Coming from Laravel"

Migration-oriented, capture Laravel-ecosystem search intent. One mapping per
post: Eloquent → Stacks ORM, Blade → stx, Artisan → buddy, Horizon → bun-queue,
Sail → the dev server, Forge/Envoyer → buddy deploy + ts-cloud.

---

## Production checklist (per post)

1. Pick the filename → it becomes the slug (`content/blog/<slug>.md`).
2. Fill the frontmatter (title, description, date, author, optional
   authorBio/poster, featured). `description` is the excerpt + meta + RSS body.
3. Write the body in markdown. Use internal links (`/docs`, `/blog/<slug>`, the
   campaign index), code fences, and `:::` containers freely — BunPress renders
   them.
4. Feature at most one post at a time (`featured: true`).
5. The listing, RSS feed, and sitemap pick it up automatically.

## Core SEO/blog features now baked in

- **RSS/sitemap**: live at `/blog/feed.xml` and `/blog/sitemap.xml` (the old
  `/api/blog/feed.xml` links were 404 and have been corrected).
- **Open Graph / Twitter cards**: full SSR meta on the blog index (`/blog`),
  the primary share URL. Detail pages register meta via `useSeoMeta()` in
  `[slug].stx`.
- **Author avatars + bios**: `bio`/`avatar` columns on the `authors` model +
  migration; the post view shows the avatar (falling back to an initial) and an
  author-bio card.

## Known limitation / future work

- **Detail-page OG meta is not yet SSR**: stx builds the `<head>` of
  layout-based pages on the client (`useHead`/`useSeoMeta` runtime), so social
  crawlers that don't run JS see the index meta but not per-post meta. Wiring
  SSR head emission for layout pages is a follow-up in `~/Code/Tools/stx`.
- A real "subscribe" destination for the homepage/blog field-notes form.
- Proper post↔category/tag pivot tables (the current `categorizables`/
  `taggables` schema isn't a usable pivot, so taxonomy queries are best-effort).
