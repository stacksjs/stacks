# Phase boundaries

A **phase** is a chunk of work inside a session: the grilling, the
implementation, the QA. The definition is fuzzy on purpose, because a phase ends
when you think "ok, we are done with that".

The **phase boundary** is the gap between two phases, and it is the only place
this decision belongs. Mid-phase there is no decision to make: continue, or split
what is left into subagents. Compacting mid-phase makes the agent lose the
thread.

Credit: adapted from Matt Pocock's `ask-matt` skill (MIT),
<https://github.com/mattpocock/skills>.

## The five options

| Option | What it does |
|---|---|
| **Continue** | Stay in the session. No context switch at all. |
| **Clear** | Empty the context window and start from nothing. |
| **Handoff** | Write a portable markdown file and seed a session anywhere with it. |
| **Subagent** | Send the task to its own context window and get a report back. |
| **Compact** | Compress this context and seed a fresh session with the summary. |

## The tree

Work top to bottom at the boundary. The first yes wins.

**1. Can you continue in this session?** Two things make the answer yes: the next
phase needs this one as a **primary source**, or you have enough window left for
the next phase to fit. Design to implementation is the standard yes, because the
implementation wants the reasoning verbatim, not a summary of it. Continue costs
nothing and loses nothing, so rule it out before anything else.

**2. Is the context irrelevant to what comes next?** If everything here (the
exploration, the decisions, the dead ends) is disposable, **clear**. It is the
cheapest move on the board: no time, and the whole window handed back. The cost
of getting it wrong is one-way, though. Clear a *relevant* context and you lose
the why behind what you built, and no amount of reading the diff back returns it.

**3. Do you need to hand off?** `/stacks-handoff` is narrow. You need it only
when you are swapping to a different harness, moving to a different directory or
repo, sending the work to a colleague, or forking a side task you found
mid-phase. That list is the whole clause. What a handoff buys is **portability**.
If nothing is travelling, you do not need it.

**4. Can the task be done with you away from the keyboard?** Scoped tightly
enough to run with no steering? Send it to a **subagent** and leave this session
untouched. Automated review is the standard case: the agent reads the diff and
reports, and you are not needed while it does.

**5. Otherwise, compact.** Relevant context, same harness, same directory, and
you need to stay in the loop. This is where the tree lands, and it lands here
often. Pass an instruction with it so the summary keeps what the next phase
needs.

Compact is the **default, not the first reach**. It sits at the bottom because
the four questions above it are all cheaper or more precise. The failure mode
when people start here is a fresh session that is confidently wrong about a
decision the summary flattened.

## Primary and secondary sources

Every move except Continue turns a **primary source** into a **secondary**
source: the session as it happened, replaced by a summary of it. The trade is
always the same shape.

| Source | Information | Noise | Room to move |
|---|---|---|---|
| Primary (continue) | Full | Lots | Little |
| Secondary (compact, handoff) | Lossy | Less | Lots |

This is why question 1 comes first. You only pay the lossiness when staying costs
more than it saves.

## In a Stacks session specifically

Two boundaries recur, and both usually answer the same way:

- **Migration generation to review.** `buddy generate:migrations` writes SQL you
  then have to read. Continue: the model change you just made is the primary
  source for judging the SQL.
- **Implementation to review.** `/stacks-review` reads a diff and needs no
  exploration, so it is the textbook subagent. Sending it out keeps the
  implementation context intact for the fixes that follow.

## These are judgement calls

The questions are not objective. Each has taste in it, and the same boundary can
go two ways on two days. The value is in asking them in order, at the boundary
rather than in the middle of the work.
