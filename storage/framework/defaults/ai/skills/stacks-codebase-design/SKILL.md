---
name: stacks-codebase-design
description: Use when designing or restructuring code in a Stacks project - shaping an action or package interface, deciding where a seam goes, choosing between a trait and a helper, making code testable or navigable, or when another skill needs the deep-module vocabulary (module, interface, depth, seam, adapter, leverage, locality).
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Codebase design

Design **deep modules**: a lot of behaviour behind a small interface, placed at a
clean seam, testable through that interface. Use this language and these
principles wherever Stacks code is being designed or restructured. The aim is
leverage for callers, locality for maintainers, and testability for everyone.

Stacks is already built this way, which is why the vocabulary is worth sharing:
`defineModel()` puts a schema, validation, factories, relationships and a REST
surface behind one call. The driver packages (`cache`, `queue`, `storage`,
`email`, `ai`, `chat`, `search-engine`, `dns`) are ports with two or more
adapters each. Use the words below rather than inventing new ones per package.

Credit: the deep-module model here is adapted from Matt Pocock's
`codebase-design` skill (MIT), <https://github.com/mattpocock/skills>, itself
building on Ousterhout and Feathers.

## Glossary

Use these terms exactly. Do not substitute "component", "service", "API" or
"boundary". Consistent language is the whole point.

**Module**: anything with an interface and an implementation. Deliberately
scale-agnostic: a function, an action, a model, a `@stacksjs/*` package, a
tier-spanning slice. *Avoid*: unit, component, service.

**Interface**: everything a caller must know to use the module correctly. The
type signature, but also invariants, ordering constraints, error modes, required
config, and performance characteristics. For a Stacks action the interface
includes its route, its middleware and its request shape, not just its `handle`
signature. *Avoid*: API, signature (too narrow, they name only the type surface).

**Implementation**: what is inside a module. Distinct from **adapter**: a thing
can be a small adapter over a large implementation (the S3 storage driver) or a
large adapter over a small one (an in-memory fake). Reach for "adapter" when the
seam is the topic, "implementation" otherwise.

**Depth**: leverage at the interface. How much behaviour a caller or a test can
exercise per unit of interface they have to learn. A module is **deep** when a
lot of behaviour sits behind a small interface, **shallow** when the interface is
nearly as complex as the implementation.

**Seam** (Michael Feathers): a place where you can alter behaviour without
editing in that place. The *location* at which a module's interface lives. Where
to put the seam is its own design decision, distinct from what goes behind it. In
Stacks the `app/` override model is a seam the framework hands you for free:
`app/Actions/Cms/PostIndexAction.ts` replaces the default without editing it.
*Avoid*: boundary (overloaded with DDD's bounded context).

**Adapter**: a concrete thing that satisfies an interface at a seam. Describes
*role* (which slot it fills), not substance (what is inside). `config/cache.ts`
picking `memory` or `redis` is adapter selection.

**Leverage**: what callers get from depth. More capability per unit of interface
learned. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge and
verification concentrate in one place rather than spreading across callers. Fix
once, fixed everywhere.

## Deep versus shallow

**Deep** = small interface, lots of implementation:

```
┌─────────────────────┐
│   Small interface   │  ← few entry points, simple params
├─────────────────────┤
│                     │
│  Deep implementation│  ← complexity hidden
│                     │
└─────────────────────┘
```

**Shallow** = large interface, little implementation. Avoid:

```
┌─────────────────────────────────┐
│       Large interface           │  ← many methods, complex params
├─────────────────────────────────┤
│  Thin implementation            │  ← mostly passes through
└─────────────────────────────────┘
```

When designing an interface, ask: can I reduce the number of entry points? Can I
simplify the params? Can I hide more complexity inside?

The `useApi` trait is the canonical deep interface in this framework: one config
object, and the model gains five actions, five routes, an OpenAPI entry and a
dashboard view. `useSearch`, `useAuth` and `useSoftDeletes` are the same trade.
When you find yourself writing the fifth near-identical action, the question is
whether a trait wants to be born.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module
  can be internally composed of small, swappable parts. They just are not part of
  the interface. A module can have **internal seams** (private, used by its own
  tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it
  was a pass-through. If complexity reappears across N callers, it was earning
  its keep.
- **The interface is the test surface.** Callers and tests cross the same seam.
  If you want to test *past* the interface, the module is probably the wrong
  shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Do
  not introduce a seam unless something actually varies across it. Production
  plus test counts as two.

## Designing for testability

1. **Accept dependencies, do not create them.**

   ```typescript
   // testable
   export async function processOrder(order: Order, gateway: PaymentGateway) {}

   // hard to test
   export async function processOrder(order: Order) {
     const gateway = new StripeGateway()
   }
   ```

2. **Return results, do not produce side effects.**

   ```typescript
   // testable
   function calculateDiscount(cart: Cart): Discount {}

   // hard to test
   function applyDiscount(cart: Cart): void { cart.total -= discount }
   ```

3. **Small surface area.** Fewer entry points means fewer tests. Fewer params
   means simpler setup.

In a Stacks app the third dependency is almost always the database, and it does
not need injecting: `refreshDatabase()` plus model factories give you a real one
per suite. See `stacks-tdd` for where that line sits.

## Relationships

- A **module** has exactly one **interface**, the surface it presents to callers
  and tests.
- **Depth** is a property of a **module**, measured against its **interface**.
- A **seam** is where a **module**'s **interface** lives.
- An **adapter** sits at a **seam** and satisfies the **interface**.
- **Depth** produces **leverage** for callers and **locality** for maintainers.

## Rejected framings

- **Depth as a ratio of implementation lines to interface lines** (Ousterhout):
  rewards padding the implementation. Use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public
  methods**: too narrow. Interface here includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or
  **interface**.

## Going deeper

- **Deepening a cluster given its dependencies**: [DEEPENING.md](DEEPENING.md)
  covers the dependency categories, seam discipline, and replace-do-not-layer
  testing.
- **Exploring alternative interfaces**: [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md)
  runs parallel sub-agents to design one interface several radically different
  ways, then compares on depth, locality and seam placement.

## Downstream

> Reach for `stacks-tdd` to write the tests at the seam you chose, and
> `stacks-domain-modeling` when the module needs a name the project does not
> have yet.
