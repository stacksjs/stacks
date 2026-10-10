# Core rewrite contract

Adapted from the upstream Unslop contract. This reference governs every mode.

## Findings

Repair concrete AI-writing or clarity defects. Prefer an unchanged source to an
uncertain edit. Quote the smallest defective span and explain its contextual
problem: empty framing, inflated abstraction, unsupported rhetorical certainty,
an opaque or mixed metaphor, a misleading heading, needless repetition, or an
internal contradiction. Read every sentence, including headings and endings.
Recognize paraphrased scaffolding by its function, not just a catalog match.

Classify each candidate as a confirmed finding or protected source, with a
reason. Punctuation, vocabulary, cadence, and paragraph shape alone establish
neither a defect nor authorship. Keep literal terms, attributed claims,
quotations, accurate caveats, and conventions natural to the genre. "Bandwidth"
may describe a network; "actionable" may refer to defined actions.

Missing proof alone does not make a plan, future date, promotion, technical
term, or attribution defective. Editing prose does not silently turn into
fact-checking. If fact-checking is requested, separate its findings from style
findings and cite the evidence used.

Compare claims inside the source. A statement contradicted by nearby evidence
needs clarification, not stronger rhetoric. Keep the evidence and quantities.
State a conflict separately when rewriting would alter an attributed claim.
Leave it alone when the source already explains the conflict and uncertainty.

Inspect slogans and calls to action too. A concrete offer, capped promotion,
future plan, or genuine aphorism can be valid. Flag empty transformation claims,
false equivalence, contradicted certainty, and incompatible metaphors. A
replacement should name an actor, action, mechanism, result, or decision that
the source supplies, rather than rename the same abstraction.

## Preservation

Record the source's constraints before rewriting:

- Numbers, precision, units, ranges, counts, percentages, dates, and times.
- Names, roles, relationships, technical terms, API names, and versions.
- Quotations and their attribution, citations, URLs, and link destinations.
- Code, commands, paths, identifiers, frontmatter, and structured data.
- Negation, conditions, exceptions, scope, causal claims, and comparisons.
- Uncertainty and force-bearing words such as "may", "must", "never", and
  "all", especially in technical, scientific, legal, or safety rules.

Preserve the exact form of factual spans and executable content. Preserve the
meaning of causal, conditional, and scoped claims. "About 50%" stays
approximate; "may" does not become "will"; a range retains both bounds; a list
retains every item. A quote retains both its text and its named speaker.

Add no claims, advice, anecdotes, personality, authority, certainty, or
conclusions to a rewrite. A voice preset cannot supply missing evidence. A new
draft uses the user's supplied facts and brief; unsupported specifics remain
questions or clearly marked placeholders when the user wants a template.

## Minimal edits

Edit only sentences containing confirmed findings. Use the smallest repair
that works. Copy every other sentence byte-for-byte, in its original order and
paragraph. With no findings, return the source exactly. An audit still reports
protections when requested; it does not need to produce a rewrite.

Deleting empty framing must not drop a fact or replace it with new filler.
Avoid turning flowing prose into clipped fragments. Natural transitions,
paragraphing, uncertainty, and domain language survive when they serve meaning.
Macro cleanup, when requested, may remove empty connective scaffolding and a
recap that adds no new claim. A unique claim in an ending remains protected.

## Validation

Compare the original and result side by side, using the diff for files. Account
for every changed span and every preservation constraint. Re-read negations,
conditions, scope, certainty, relationships, and attribution separately from
the style pass. Restore any accidental loss or unsupported addition.

Inspect the whole result for introduced filler, repeated sentence shapes,
staccato runs, and an empty closing lesson. A preexisting cadence preference is
advisory unless it creates a concrete defect. Protected code and quotes stay
intact; newly generated prose follows Stacks' punctuation rules.

For requested strict analysis, assess directness, clarity, specificity, rhythm,
voice appropriate to the genre, absence of confirmed formulaic framing,
preservation, and brevity. Explain each weakness in words. Preservation is a
completion requirement independently of the other criteria. A high overall
assessment cannot excuse a lost fact. These are qualitative judgments, not
automated grades or authorship probabilities.
