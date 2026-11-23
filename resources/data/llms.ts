/**
 * `/llms.txt`: the site as one plain page, for the readers that are not
 * browsers.
 *
 * An answer engine or a coding agent asked "what is Stacks" does not render
 * the home page and read the bento; it wants a short description and a list
 * of where the detail is, in a form it can take in one request. This is the
 * convention for that (llmstxt.org): a title, a one-paragraph summary, then
 * sections of links, each with a line saying what it leads to.
 *
 * It is built from the same three lists the pages and the nav are built
 * from, so it cannot offer a page that does not exist or describe one in
 * words the page does not use. The file itself is public/llms.txt, which is
 * what the server serves; tests/unit/marketing-home.test.ts fails when that
 * file is not exactly what this function returns, and says how to write it.
 */

import { comparisons } from './comparisons'
import { features } from './features'
import { faqs } from './home'
import { useCases } from './use-cases'

const site = 'https://stacksjs.com'

function section(title: string, links: { label: string, url: string, text: string }[]): string {
  return [`## ${title}`, '', ...links.map(link => `- [${link.label}](${link.url}): ${link.text}`)].join('\n')
}

export function llmsTxt(): string {
  // The first answer is the site's own definition of itself. Using it here
  // keeps the summary an engine quotes and the one a visitor reads the same.
  const summary = faqs[0]!.answer

  return `${[
    '# Stacks',
    '',
    `> ${summary}`,
    '',
    'Stacks is installed with Pantry and driven by the `buddy` CLI: `panx buddy new my-app` creates a project, `buddy dev` serves the frontend, API, docs, and dashboard, and `buddy deploy` ships them. Schema, validation, relationships, and the REST API of a model are declared once in `defineModel()`, and migrations are generated from it. Every page below is server-rendered HTML.',
    '',
    section('Start here', [
      { label: 'Documentation', url: `${site}/docs`, text: 'Guides and the API reference for every package.' },
      { label: 'AGENTS.md', url: 'https://github.com/stacksjs/stacks/blob/main/AGENTS.md', text: 'The conventions a coding agent follows in a Stacks app, and the skill to read for each subsystem.' },
      { label: 'Source', url: 'https://github.com/stacksjs/stacks', text: 'The framework repository, MIT licensed.' },
    ]),
    '',
    section('Features', features.map(feature => ({
      label: feature.title,
      url: `${site}/features/${feature.slug}`,
      text: feature.blurb,
    }))),
    '',
    section('Use cases', useCases.map(useCase => ({
      label: useCase.title,
      url: `${site}/use-cases/${useCase.slug}`,
      text: useCase.blurb,
    }))),
    '',
    section('Comparisons', comparisons.map(comparison => ({
      label: `Stacks vs ${comparison.name}`,
      url: `${site}/compare/${comparison.slug}`,
      text: `${comparison.blurb} Checked against ${comparison.checked.version}.`,
    }))),
    '',
    section('Common questions', faqs.slice(1).map(faq => ({
      label: faq.question,
      url: `${site}/#faq`,
      text: faq.answer,
    }))),
    '',
    section('Optional', [
      { label: 'Blog', url: `${site}/blog`, text: 'Release notes and longer writing about the framework.' },
      { label: 'Sitemap', url: `${site}/sitemap.xml`, text: 'Every indexable page.' },
    ]),
  ].join('\n')}\n`
}
