# Logic prototype

A single, self-contained HTML file that lets anyone drive a state model by
clicking buttons. Use this when the question is about **business logic, state
transitions, or data shape**: the kind of thing that looks reasonable on paper
and only feels wrong once you push it through real cases.

Because it is one file with nothing to install, you can hand it to a
non-developer (a designer, a PM, a domain expert) and let them feel the model for
themselves. So it speaks their language, not the code's.

If the question is "what should this look like", this is the wrong branch. Use
[UI.md](UI.md).

## Process

### 1. State the question

Before writing code, write down what state model you are prototyping and what
question you are asking of it. One paragraph, at the top of the demo, in a
visible intro rather than a comment. A prototype that answers the wrong question
is pure waste.

### 2. Isolate the logic in a portable module

Put the logic that answers the question in a single `<script>` block, written as
a small pure module that could be lifted out and dropped into the real codebase.
The page around it is throwaway. This module is not.

Pick the shape that fits the question:

- **A pure reducer**, `(state, action) => state`. Good when actions are discrete
  events and state is a single value.
- **A state machine** with explicit states and transitions. Good when "which
  actions are even legal right now" is part of the question.
- **A small set of pure functions** over a plain data type. Good when there is no
  implicit current state, just transformations.
- **A module with a clear method surface**, when the logic genuinely owns ongoing
  internal state.

Keep it pure: no DOM, no `document`, no button handlers reaching inside it. The
page calls into it, nothing flows the other way. That is what makes the answer
liftable: once the question is settled, the validated reducer or machine moves
into an action, a job or a model on its own.

### 3. Build the shareable HTML file

One file, plain HTML, CSS and JS. No framework, no bundler, no server,
everything inline so it opens by double-click and survives being emailed around.
This is the one place in a Stacks project where hand-written vanilla JS is
correct, because the artifact has to run with nothing installed. It is not stx
and it never ships.

Write it for a non-developer. Every label is in **domain language**, not code.
Use the terms from `CONTEXT.md` if the project has one.

Lay it out top to bottom:

1. **Title and one-line explanation** of what the demo lets you explore, which is
   the question from step 1.
2. **Current state**, rendered as a readable labelled panel rather than a raw
   JSON dump, re-rendered after every click so the change is visible.
3. **Free-play buttons**, one per action, always available, so anyone can poke at
   the model in any order.
4. **Guided walkthroughs**: a set of scenarios, one per tab. Each tab holds a
   short plain-language description of the situation and what to watch for, and
   under it the ordered buttons to press. Each step is a real button: clicking it
   performs that action and moves to the next. Starting a walkthrough resets to a
   known initial state so the scenario runs the same way every time.

Choose scenarios that demonstrate the awkward cases: the happy path, a tricky
edge, and an attempt at something that should be illegal.

Keep it clean but restrained. Clean typography, generous spacing, one accent
colour, no animation. Nothing that competes with the state and the buttons.

### 4. Hand it over

Send the file or open it. The interesting moments are "wait, that should not be
possible" and "huh, I assumed X would be different". Those are bugs in the
*idea*, which is the whole point. If they want new actions or another scenario,
add them. Prototypes evolve.

### 5. Capture the answer and the prototype

Once the question is answered, capture the answer, then capture the prototype the
way [SKILL.md](SKILL.md) describes. The validated reducer, machine or function
set lifts into the real module. The HTML shell rides along to the
`prototype/<name>` branch, where being one self-contained file keeps it trivially
re-runnable.

## Anti-patterns

- **Adding tests.** A prototype that needs tests is no longer a prototype.
- **Wiring it to the real database.** In-memory state, unless the question is
  specifically about persistence.
- **Generalising.** No "what if we wanted to support X later". One question.
- **Blurring the logic and the page together.** If the pure module touches the
  DOM, it is no longer liftable.
- **Reaching for a framework, bundler or server.** One file the recipient
  double-clicks. A dev server defeats "shareable".
- **Shipping the HTML shell.** The page is optimised for being clicked through by
  hand. The module behind it is the part worth keeping.
