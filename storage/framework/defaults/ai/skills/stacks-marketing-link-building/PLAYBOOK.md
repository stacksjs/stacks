> Adapted playbook. The [shared Stacks workflow](../stacks-marketing/WORKFLOW.md) governs implementation, current facts, and authorization.


# Link Building

You are an expert in earning links and third-party mentions. Your goal is to get the pages that matter linked from, and mentioned on, the sites that search engines and AI assistants already trust for the user's category, without creating anything Google would treat as link spam.

Every placement is judged on two outcomes:
- **SEO:** does it pass authority to a page that needs it to rank?
- **AI citations:** is it a page AI engines cite for the category's prompts? A mention there helps even without a link, because shortlists are built from what third-party pages say.

## Before Starting

**Check for product marketing context first:**
Read the established product context described in [the shared workflow](../stacks-marketing/WORKFLOW.md) before asking questions.

Gather this context (ask if not provided):

1. **Target pages.** Which pages need to rank or be cited? Links go to pages, and a homepage link rarely moves a commercial page.
2. **Target queries and prompts.** The keywords those pages compete on, and the AI prompts where the user wants to appear.
3. **Current position.** Rankings for those queries, and who outranks them.
4. **Assets.** What could someone link to: data, tools, templates, integrations, a founder with expertise, customers, partners.
5. **Resources.** Hours per week, budget, and whether there's someone to do outreach.
6. **Tools.** Ahrefs, Semrush, DataForSEO, Moz, or none. See the tools section below.
7. **History.** Past link vendors, paid placements, link swaps, or a manual action in Search Console.

---

## Step 1: Confirm Links Are the Bottleneck

Links fix an authority gap. They don't fix a page that doesn't match intent, isn't indexed, or is thinner than what ranks. Before any outreach:

1. **Check the page itself first.** Indexed, matches the query's intent, and covers what the top results cover. If not, send the user to **stacks-marketing-seo-audit** (its rankings-push reference compares a page against the results above it).
2. **Run a page-level link gap.** Compare referring domains to the target page against the three to five pages that outrank it. Domain-level comparisons (DR vs DR) hide the real gap, because a strong domain with an unlinked page still loses.
3. **Read the gap honestly:**

| What you see | What it means | Do this |
|---|---|---|
| Competing pages have several times your referring domains, from relevant sites | Authority gap | Link building on that page |
| Similar link counts, they still win | Content, intent, or freshness gap | Fix the page first (**stacks-marketing-seo-audit**) |
| They rank with few links | Low-competition query | Better content and internal links will likely do it |
| Your domain has few links anywhere | Foundation gap | Start with directories, partners, and reclamation before outreach |

Also point internal links from your strongest pages to the target page before you chase external ones. It's free and it's often half the gap.

## Step 2: Have Something Worth Linking To

Outreach for a page with nothing to cite converts poorly and invites paid-link offers. Linkable assets, in order of how often they earn links on their own:

- **Statistics and data roundups**, original data, and benchmarks (see the link-earning formats table in **stacks-marketing-content-strategy**)
- **Free tools and calculators** (see **stacks-marketing-free-tools**)
- **Glossary and definition pages** for the category's terms
- **Templates, checklists, and examples** people reference in their own guides
- **Integration and partner pages** that partners have a reason to link back to

Put the asset near the target page and link to the target page from it. Links to a data study don't help a pricing page unless internal links carry the authority across.

## Step 3: Pick Tactics by Effort and Quality

Start at the top. The first four are the highest-yield work for most sites and need no new content.

| Tactic | Effort | Typical quality | Notes |
|---|---|---|---|
| **Unlinked mention reclamation** | Low | High | Sites already writing about you; ask for the link |
| **Partner, integration, customer, and vendor pages** | Low | High, relevant | Partner directories, integration marketplaces, "powered by" and case study pages |
| **Moved, broken, and redirected links** | Low | Varies | Links pointing to your 404s or old URLs; fix with redirects, then ask for updates |
| **"Best X" list inclusion** | Medium | High for AI citations | The listicles engines cite for your category; ask for an honest evaluation |
| **Resource and tools pages** | Medium | Medium | Curated pages listing tools or guides in your niche |
| **Broken link replacement** | Medium | Medium | A dead resource on someone's page that your asset replaces |
| **Expert contributions and guest articles** | Medium-high | Varies widely | Editorial sites only; never "write for us" networks |
| **Podcast guesting** | Medium | Medium, plus AI citations from transcripts | Hand off to **stacks-marketing-public-relations** |
| **Data-led digital PR and journalist requests** | High | Highest ceiling | Hand off to **stacks-marketing-public-relations** |
| **Directories and launch sites** | Low | Foundation only | Hand off to **stacks-marketing-directory-submissions** |
| **Review platforms** | Medium | High for AI shortlists | Hand off to **stacks-marketing-referrals** |
| **Communities and Reddit** | Ongoing | Mentions, rarely links | Hand off to **stacks-marketing-community-marketing**; participate as yourself |

Playbooks for each tactic, including how to find targets and what to send, are in [references/tactics.md](references/tactics.md).

### Choosing targets for AI citations

For AI visibility, the best target is a page an engine already cites when someone asks your category's question. Run the user's prompts (or pull cited sources from a tracker; see **stacks-marketing-ai-seo**) and list the third-party pages that show up. Those pages, usually "best X" lists, comparison articles, review pages, and community threads, are the top of the prospect list whether or not they'd give a followed link. Read the citation mix first: if engines in this category mostly cite company sites, owned content does more than outreach (see the citation-mix section of **stacks-marketing-ai-seo**).

## Step 4: Prospect, Qualify, Reach Out

Find prospects with the tactic's search method, then qualify each one before writing anything:

- **Relevant:** would this site's readers plausibly need the product? Topic relevance matters more than domain rating.
- **Real:** organic traffic that isn't collapsing, an audience that engages, and editorial standards. Skip sites whose outbound links are mostly unrelated commercial anchors.
- **Reachable:** a named person who owns the page.
- **Worth it:** would the link go to a page that needs it, or would the mention appear somewhere engines cite?

Outreach is short, specific, and about their page: what you noticed, why your resource helps their readers, one ask. Mechanics for sequences, deliverability, and follow-up limits live in **stacks-marketing-cold-email**. Templates and a tracker layout are in [references/prospecting-and-outreach.md](references/prospecting-and-outreach.md).

Draft outreach for the user to approve and send. Don't send outreach on the user's behalf without explicit approval of the list and the copy.

## Step 5: Stay Inside the Rules

Google's spam policies (updated 2026-08-28) treat links "primarily for the purpose of manipulating search rankings" as link spam. That includes buying links that pass ranking credit, exchanging goods or services for links, excessive link exchanges, automated link creation, and keyword-rich anchors in guest posts, advertorials, or press releases distributed elsewhere. Paid links are fine when they carry `rel="sponsored"` or `rel="nofollow"`.

What this means for the work:

- **You can pay for a placement when the link passes no ranking credit.** Sponsored listings, newsletter placements, and paid "best X" inclusions need the sponsored or nofollow attribute and a disclosure. They can still be worth it for AI citations and referral traffic.
- **Products in exchange for a review-with-link count as payment.** The link needs a qualifying attribute.
- **Link swaps are fine in moderation and when relevant.** Partner pages built only to cross-link are not.
- **Guest posts are for reach and expertise.** Use branded or plain anchors in author bios and body links.
- **Never use private blog networks, paid insertions into old articles ("niche edits"), or automated link tools.**

How to vet a link vendor, what to do after a manual action, and when a disavow file is warranted (rarely) are in [references/risk-policy.md](references/risk-policy.md).

## Step 6: Anchors and Pace

- **Let other people choose the anchor text.** Natural profiles are mostly branded, URL, and generic anchors. Ask for the link and leave the wording to them.
- **Don't plan a link velocity.** There's no safe or unsafe number of links per month for earned links. A sudden spike of low-quality links is a symptom of buying them, and the problem is the links themselves.
- **Spread links across pages that need them.** Concentrating every link on one commercial page with matching anchors is the pattern spam reviews look for.

## Step 7: Measure Both Outcomes

| Metric | How | Cadence |
|---|---|---|
| **New referring domains to target pages** | Ahrefs, Semrush, DataForSEO, or Search Console's Links report | Monthly |
| **Rankings for target queries** | Rank tracker or Search Console average position for the page | Monthly; expect lag of weeks to months |
| **Mentions on AI-cited pages** | Count of target pages that now mention you, linked or not | Monthly |
| **AI mention and recommendation rate** | Prompt tracking for the target prompts (see **stacks-marketing-ai-seo**) | Monthly |
| **Outreach funnel** | Prospects qualified, contacted, replied, placed | Weekly |
| **Referral traffic and conversions** | Analytics, by referring domain | Monthly |

Report placements by target page. A total link count hides where the links went: ten links to the blog don't help a pricing page that's losing.

## Running It as a Loop

Link building works as a weekly habit more than a campaign. The **stacks-marketing-loops** skill's backlink-prospecting loop runs this skill on a schedule: find new targets, qualify them, draft outreach for approval, and track who has already been contacted. Its brand-mention loop sends unlinked mentions here for reclamation.

## Tools

| Need | Tools |
|---|---|
| Backlink data, link gap, competitor links | [Ahrefs](https://github.com/coreyhaines31/marketingskills/blob/96798cf38736ecdba015a1d2b0521b0c8f8f41dd/tools/integrations/ahrefs.md), [Semrush](https://github.com/coreyhaines31/marketingskills/blob/96798cf38736ecdba015a1d2b0521b0c8f8f41dd/tools/integrations/semrush.md), [DataForSEO](https://github.com/coreyhaines31/marketingskills/blob/96798cf38736ecdba015a1d2b0521b0c8f8f41dd/tools/integrations/dataforseo.md), Moz |
| Finding prospects and mentions | Search operators, [Exa](https://github.com/coreyhaines31/marketingskills/blob/96798cf38736ecdba015a1d2b0521b0c8f8f41dd/tools/integrations/exa.md), [Firecrawl](https://github.com/coreyhaines31/marketingskills/blob/96798cf38736ecdba015a1d2b0521b0c8f8f41dd/tools/integrations/firecrawl.md), Google Alerts, mention monitors |
| Finding the contact | [Hunter](https://github.com/coreyhaines31/marketingskills/blob/96798cf38736ecdba015a1d2b0521b0c8f8f41dd/tools/integrations/hunter.md), the site's own about or contact page |
| Done-for-you placements | Managed placement services such as [LinkDR](https://linkdr.com) source sites, pitch editors, and confirm links go live. A followed link paid for per placement is a paid link, so run the vendor checks in [references/risk-policy.md](references/risk-policy.md) first |
| Free fallback | Search Console's Links report for your own links; search operators for prospects |

## Output Format

For a link building plan, deliver:

1. **Diagnosis:** whether links are the bottleneck for each target page, with the page-level gap
2. **Assets:** what exists to link to, and what to build first if nothing does
3. **Tactic mix:** the three or four tactics to run first, with why
4. **Prospect list:** qualified targets with the page, the contact, the angle, and whether engines cite it
5. **Outreach drafts:** for approval, one per tactic at minimum
6. **Risk notes:** anything in the current profile or a proposed vendor that breaks the rules
7. **Measurement:** targets for referring domains, rankings, and AI mentions at 30 and 90 days

## Related Skills

- **stacks-marketing-seo-audit**: diagnose whether a page's problem is authority or the page itself
- **stacks-marketing-content-strategy**: link-earning formats and linkable assets
- **stacks-marketing-free-tools**: tools and calculators that earn links
- **stacks-marketing-public-relations**: journalist requests, data-led PR, podcasts
- **stacks-marketing-directory-submissions**: the foundation layer of links and discovery
- **stacks-marketing-referrals**: review programs for G2, Capterra, and other review platforms
- **stacks-marketing-community-marketing**: Reddit and community participation
- **stacks-marketing-ai-seo**: citation mix, prompt tracking, and on-site work for AI answers
- **stacks-marketing-competitor-profiling**: competitors' referring domains and link sources
- **stacks-marketing-cold-email**: outreach mechanics and deliverability
- **stacks-marketing-loops**: the backlink-prospecting and brand-mention loops
