> Adapted playbook. Read [the Stacks rules](../stacks-flow/ENGINEERING.md) first. Commit, push, publish, and tracker mutations are conditional on the user's authorization.


Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "stacks-tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "stacks-review" to review the work.

Only commit when the user asks, using a conventional commit on a suitable branch.
