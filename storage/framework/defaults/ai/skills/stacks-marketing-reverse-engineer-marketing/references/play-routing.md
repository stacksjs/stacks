# Play Routing

Every play in a teardown names the skill that runs it and, for repeat work, the loop that keeps it going. Use this table to route each one. Write the play's prompt so it starts with that skill and passes along the teardown's specifics (the formula, the page family, the evidence link).

## Contents
- Routing table
- Writing the prompt
- Example

---

## Routing Table

| What the teardown found | Skill that runs it | Loop that keeps it going (marketing-loops) |
|---|---|---|
| A page family carrying non-brand traffic (templates, integrations, use cases, locations) | **stacks-marketing-programmatic-seo** | The programmatic-SEO quality loop |
| Comparison or alternative pages ranking | **stacks-marketing-competitors** | The keyword-gap loop |
| Glossary, guides, or a blog driving traffic | **stacks-marketing-content-strategy**, then **stacks-marketing-copywriting** | The content-calendar refill loop |
| Named and cited first in AI answers | **stacks-marketing-ai-seo** | The AI-answer check loop |
| Links from many domains to one asset | **stacks-marketing-link-building** | The backlink-prospecting loop |
| A free tool or calculator earning traffic | **stacks-marketing-free-tools** | (none; one-off build) |
| Long-running ads on a network | **stacks-marketing-ads** for structure, **stacks-marketing-ad-creative** for creative | The daily-creative-drop loop, the ad-fatigue loop |
| Founder posts with numbers driving reach | **stacks-marketing-social** | The content-repurposing loop |
| A content format or formula winning on a channel | **stacks-marketing-social** (short-form scripts and posts), **stacks-marketing-video** for production | The niche-outlier loop |
| Creators teaching the product | **stacks-marketing-influencer-marketing** | The creator-scouting loop |
| A launch, launch week, or Product Hunt spike | **stacks-marketing-launch** | The launch-reaction loop |
| Press or podcast runs | **stacks-marketing-public-relations** | The newsjacking loop |
| Community threads driving signups | **stacks-marketing-community-marketing** | The community-engagement loop |
| A "made with" badge or shared output loop | **stacks-marketing-referrals** (loop design), **stacks-marketing-signup** (the landing step) | The referral-nudge loop |
| An affiliate or referral program | **stacks-marketing-referrals** | The referral-nudge loop |
| Directory and marketplace listings | **stacks-marketing-directory-submissions** | The directory-submission loop |
| Fast first result, light sign-up | **stacks-marketing-signup**, **stacks-marketing-onboarding** | The onboarding drop-off loop |
| A pricing or packaging change that lined up with growth | **stacks-marketing-pricing** | The pricing-page-experiment loop |
| A trial or credit model that converts | **stacks-marketing-paywalls** | The trial-conversion loop |
| Partner or integration listings | **stacks-marketing-co-marketing** | The partner-pipeline loop |
| Lifecycle email or in-app nudges | **stacks-marketing-emails** | The lifecycle-email-refresh loop |
| A lead magnet or gated asset | **stacks-marketing-lead-magnets** | The lead-capture-asset loop |
| Outbound to a defined account list | **stacks-marketing-prospecting**, **stacks-marketing-cold-email** | The signal-sweep loop |
| An onboarding email sequence that converts (stage 3) | **stacks-marketing-emails** | The lifecycle-email-refresh loop |
| Save offers in the cancel flow (stage 3) | **stacks-marketing-churn-prevention** | The churn-signal loop |
| A complaint theme in their reviews that the user solves | **stacks-marketing-competitors** (alternative page), **stacks-marketing-product-marketing** (positioning) | The keyword-gap loop |
| Price pain after their price rise | **stacks-marketing-offers** (switching offer), **stacks-marketing-pricing** | (none; one-off offer) |
| Objections their customers raise in reviews and switching posts | **stacks-marketing-sales-enablement** (battle card), **stacks-marketing-customer-research** | (none; refresh with Watch mode) |
| A fast, well-run sales process (stage 3) | **stacks-marketing-sales-enablement**, **stacks-marketing-revops** | (none; one-off build) |
| A positioning shift that came before growth (stage 5) | **stacks-marketing-product-marketing** for positioning, **stacks-marketing-copywriting** for the homepage | The claim-drift loop |
| Newsletter, podcast, or YouTube sponsorships (stage 5) | **stacks-marketing-influencer-marketing** | The creator-scouting loop |
| Coupon or lifetime-deal distribution (stage 5) | **stacks-marketing-offers** | (none; one-off test) |
| Events, virtual events, or conference sponsorships (stage 5) | **stacks-marketing-events** | (none; per event) |
| A review campaign (stage 5 review spike) | **stacks-marketing-referrals** (review programs) | The review-site-management loop |
| A marketplace or integration listing (stage 5) | **stacks-marketing-co-marketing**, **stacks-marketing-directory-submissions** | The partner-pipeline loop |
| An order bump, upsell, or downsell sequence (Funnel Hack) | **stacks-marketing-offers**, **stacks-marketing-cro** | The pricing-page-experiment loop |
| An abandoned-cart or abandoned-opt-in flow (Funnel Hack) | **stacks-marketing-emails**, **stacks-marketing-sms** | The lifecycle-email-refresh loop |
| A quiz or webinar funnel (Funnel Hack) | **stacks-marketing-lead-magnets**, **stacks-marketing-events** | The lead-capture-asset loop |
| Conquesting ads on competitor names (Funnel Hack) | **stacks-marketing-ads**, **stacks-marketing-competitors** | The paid-search query-mining loop |
| An industry-specific play from an industry pack | The skill the pack names | The loop the pack's play needs, if any |

Every play also needs its metric tracked. If the user can't measure it today, add an **stacks-marketing-analytics** step to the prompt.

Some plays don't transfer. A play that depended on the target's funding, audience, or founder fame goes in plays to skip, with the reason.

## Writing the Prompt

A good prompt gives the skill everything it would otherwise ask for:

1. **The skill:** "Use the programmatic-seo skill."
2. **The evidence:** what the target did and the link.
3. **The user's version:** the specific asset, scaled to the user's stage.
4. **The formula or house style** from stage 6, if it's a content play.
5. **The metric** and when to check it.

## Example

> Use the programmatic-seo skill. Acme's `/templates/*` family (480 pages, observed in their sitemap, 2026-10-30) carried about 41% of their non-brand search traffic, and it existed four months before their growth inflection. We have 12 template pages. Plan a template page family for our invoicing product: the template types our customers search for, the page structure, the data each page needs, and internal links from our pricing and features pages. Start with the 20 highest-volume template keywords. Track impressions for `/templates/` in Search Console weekly, and check at 60 days.
