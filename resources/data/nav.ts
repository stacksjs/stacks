/**
 * The site chrome: what is in the nav, what is in each mega menu, and what is
 * in the footer.
 *
 * The nav and footer partials read this directly (a partial may carry its own
 * `<script server>`), so a page does not have to declare menu data to include
 * them. That is the whole point of the file: before it, every page restated
 * the nav links and rebuilt the mega groups in its own script block, so a new
 * menu meant editing every view and forgetting one meant a page whose nav
 * quietly disagreed with the rest of the site.
 *
 * The three menus are built from the three lists rather than written out, so
 * the menu cannot offer a page that does not exist:
 *
 *   Features   resources/data/features.ts
 *   Use cases  resources/data/use-cases.ts
 *   Compare    resources/data/comparisons.ts
 */

import { comparisonGroups, comparisonsInGroup } from './comparisons'
import { featureGroups, featuresInGroup } from './features'
import { useCaseGroups, useCasesInGroup } from './use-cases'

export interface MegaLink {
  title: string
  /** Second line under the title. Kept short; the panel is not a page. */
  blurb: string
  icon: string
  url: string
}

export interface MegaColumn {
  id: string
  title: string
  text: string
  links: MegaLink[]
}

export interface MegaAction {
  label: string
  url: string
  primary?: boolean
  /** Skip the client router: the target is served by another app. */
  native?: boolean
}

export interface NavMenu {
  id: string
  label: string
  /** The trigger is a real link, so a tap on a touch device goes somewhere. */
  url: string
  columns: MegaColumn[]
  aside: {
    kicker: string
    copy: string
    actions: MegaAction[]
  }
  /** `compact` drops the per-link blurb, for menus with many short entries. */
  variant?: 'default' | 'compact'
}

export const navMenus: NavMenu[] = [
  {
    id: 'features',
    label: 'Features',
    url: '/features',
    columns: featureGroups.map(group => ({
      id: group.id,
      title: group.title,
      text: group.text,
      links: featuresInGroup(group.id).map(feature => ({
        title: feature.title,
        blurb: feature.blurb,
        icon: feature.icon,
        url: `/features/${feature.slug}`,
      })),
    })),
    aside: {
      kicker: 'Start here',
      copy: 'Every one of these ships in the same install, typed against the others. Nothing above is a plugin you add later.',
      actions: [
        { label: 'Read the docs', url: '/docs', primary: true, native: true },
        { label: 'All features', url: '/features' },
      ],
    },
  },

  {
    id: 'use-cases',
    label: 'Use cases',
    url: '/use-cases',
    columns: useCaseGroups.map(group => ({
      id: group.id,
      title: group.title,
      text: group.text,
      links: useCasesInGroup(group.id).map(useCase => ({
        title: useCase.title,
        blurb: useCase.blurb,
        icon: useCase.icon,
        url: `/use-cases/${useCase.slug}`,
      })),
    })),
    variant: 'compact',
    aside: {
      kicker: 'Same install',
      copy: 'These are not editions or plans. They are the same framework, pointed at a different problem.',
      actions: [
        { label: 'All use cases', url: '/use-cases', primary: true },
        { label: 'Compare frameworks', url: '/compare' },
      ],
    },
  },

  {
    id: 'compare',
    label: 'Compare',
    url: '/compare',
    columns: comparisonGroups.map(group => ({
      id: group.id,
      title: group.title,
      text: group.text,
      links: comparisonsInGroup(group.id).map(comparison => ({
        title: comparison.name,
        blurb: comparison.kind,
        icon: comparison.icon,
        url: `/compare/${comparison.slug}`,
      })),
    })),
    variant: 'compact',
    aside: {
      kicker: 'Honest about it',
      copy: 'Every comparison says where the other framework is the better choice before it says where this one is.',
      actions: [
        { label: 'See the table', url: '/compare', primary: true },
        { label: 'All features', url: '/features' },
      ],
    },
  },
]

/**
 * Flat links, shown after the menus. Absolute rather than bare anchors: the
 * nav is on every page now, and `#start` on /compare scrolls to nothing.
 */
export const navLinks: MegaAction[] = [
  { label: 'Get started', url: '/#start' },
  { label: 'Docs', url: '/docs', native: true },
  { label: 'Blog', url: '/blog', native: true },
]

export interface FooterColumn {
  title: string
  links: MegaAction[]
}

/**
 * The footer used to be a copyright line and one link. It is the only
 * navigation on a page a reader has finished, so it now carries the whole
 * site: the three menus flattened into columns, plus where to get help.
 *
 * The first three columns are generated from the same lists the menus read,
 * so they cannot drift from them. The long ones are capped and end in a link
 * to the full page instead, because a footer that is taller than the section
 * above it is a footer nobody scrolls to the bottom of. The lists are ordered
 * most-asked-for first, so the cap keeps the entries people look for.
 */
const FOOTER_LIMIT = 9

function capped(links: MegaAction[], all: MegaAction): MegaAction[] {
  if (links.length <= FOOTER_LIMIT)
    return links

  return [...links.slice(0, FOOTER_LIMIT), all]
}

const featureLinks: MegaAction[] = featureGroups.flatMap(group =>
  featuresInGroup(group.id).map(feature => ({
    label: feature.title,
    url: `/features/${feature.slug}`,
  })),
)

const useCaseLinks: MegaAction[] = useCaseGroups.flatMap(group =>
  useCasesInGroup(group.id).map(useCase => ({
    label: useCase.title,
    url: `/use-cases/${useCase.slug}`,
  })),
)

const comparisonLinks: MegaAction[] = comparisonGroups.flatMap(group =>
  comparisonsInGroup(group.id).map(comparison => ({
    label: `vs ${comparison.name}`,
    url: `/compare/${comparison.slug}`,
  })),
)

export const footerColumns: FooterColumn[] = [
  {
    title: 'Features',
    links: capped(featureLinks, { label: `All ${featureLinks.length} features`, url: '/features' }),
  },
  {
    title: 'Use cases',
    links: capped(useCaseLinks, { label: `All ${useCaseLinks.length} use cases`, url: '/use-cases' }),
  },
  {
    title: 'Compare',
    links: capped(comparisonLinks, { label: `All ${comparisonLinks.length} comparisons`, url: '/compare' }),
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', url: '/docs', native: true },
      { label: 'Blog', url: '/blog', native: true },
      { label: 'All features', url: '/features' },
      { label: 'All use cases', url: '/use-cases' },
      { label: 'Comparison table', url: '/compare' },
      { label: 'Pantry', url: 'https://pantry.dev', native: true },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub', url: 'https://github.com/stacksjs/stacks', native: true },
      { label: 'Discussions', url: 'https://github.com/stacksjs/stacks/discussions', native: true },
      { label: 'Issues', url: 'https://github.com/stacksjs/stacks/issues', native: true },
      { label: 'Releases', url: 'https://github.com/stacksjs/stacks/releases', native: true },
      { label: 'Discord', url: 'https://stacksjs.com/discord', native: true },
      { label: 'Bluesky', url: 'https://bsky.app/profile/stacksjs.com', native: true },
    ],
  },
]

/** Shown under the columns, beside the copyright. */
export const footerNote = 'Open source under the MIT license, built by the Open Web Foundation.'
