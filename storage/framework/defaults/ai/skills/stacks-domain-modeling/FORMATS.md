# CONTEXT.md and ADR formats

## CONTEXT.md

```md
# {Context name}

{One or two sentences on what this context is and why it exists.}

## Language

**Order**:
A customer's committed request for goods, priced and payable.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

Rules:

- **Be opinionated.** When several words exist for one concept, pick the best and
  list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences. Define what it *is*, not what
  it does.
- **Only terms specific to this project.** General programming concepts
  (timeouts, error types, utility patterns) do not belong even if the project
  uses them constantly. Before adding a term, ask whether it is unique to this
  context.
- **Match the code.** A term here should be the name of the model, the event and
  the route that carry it. Where it is not, either rename the code or fix the
  entry, and say which.
- **Group under subheadings** when natural clusters emerge. A flat list is fine
  when every term belongs to one cohesive area.

## Single versus multi-context

**Single context**, which is almost every repo: one `CONTEXT.md` at the root.

**Multiple contexts**: a `CONTEXT-MAP.md` at the root lists them, where they
live, and how they relate:

```md
# Context map

## Contexts

- [Ordering](./app/Ordering/CONTEXT.md): receives and tracks customer orders
- [Billing](./app/Billing/CONTEXT.md): generates invoices and processes payments
- [Fulfillment](./app/Fulfillment/CONTEXT.md): manages picking and shipping

## Relationships

- **Ordering to Fulfillment**: Ordering emits `order:placed`, Fulfillment
  consumes it to start picking
- **Fulfillment to Billing**: Fulfillment emits `shipment:dispatched`, Billing
  consumes it to generate invoices
- **Ordering and Billing**: share the `CustomerId` and `Money` types
```

Infer which structure applies: if `CONTEXT-MAP.md` exists, read it to find the
contexts. If only a root `CONTEXT.md` exists, single context. If neither exists,
create the root file lazily when the first term is resolved.

A Stacks app with 90+ models is not automatically multi-context. Reach for the
map only when the app genuinely has separate languages, for instance a commerce
context and a CMS context that both say "author" and mean different things.

## ADRs

ADRs live in `docs/adr/` with sequential numbering: `0001-slug.md`,
`0002-slug.md`. Scan the directory for the highest existing number and increment.
Create the directory lazily, only when the first ADR is needed.

```md
# {Short title of the decision}

{One to three sentences: the context, what was decided, and why.}
```

That is the whole template. An ADR can be a single paragraph. The value is in
recording *that* a decision was made and *why*, not in filling out sections.

Optional sections, only when they add genuine value:

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by
  ADR-NNNN`), useful when decisions get revisited.
- **Considered options**, only when the rejected alternatives are worth
  remembering.
- **Consequences**, only when non-obvious downstream effects need calling out.

### What qualifies

- **Architectural shape.** "The write model is event sourced, the read model is
  projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate
  via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth
  provider, deployment target. Not every library, just the ones that would take a
  quarter to swap.
- **Boundary and scope decisions.** "Customer data is owned by the Customer
  context, other contexts reference it by ID only." The explicit no is as
  valuable as the yes.
- **Deliberate deviations from the obvious path.** "We hand-write this migration
  instead of generating it because X." Anything where a reasonable reader would
  assume the opposite. These stop the next engineer from fixing something that
  was deliberate.
- **Constraints not visible in the code.** "We cannot use AWS here for compliance
  reasons." "Responses must stay under 200ms because of the partner contract."
- **Rejected alternatives when the rejection is non-obvious.** Otherwise someone
  suggests the same thing again in six months.

### What does not

Anything easy to reverse, unsurprising, or with no real alternative. If a
decision is easy to reverse you will just reverse it. If it is not surprising,
nobody will wonder why. If there was no alternative, there is nothing to record
beyond "we did the obvious thing".
