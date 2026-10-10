# Source and license

- Upstream: [theclaymethod/unslop](https://github.com/theclaymethod/unslop).
- Revision: [`17ed39c9d0b522f44190ff0c6233867eadee192a`](https://github.com/theclaymethod/unslop/tree/17ed39c9d0b522f44190ff0c6233867eadee192a).
- Author in upstream skill metadata: claytonkim.
- Skill version at that revision: 2.3.0.
- Upstream declares `license: MIT` in
  [SKILL.md](https://github.com/theclaymethod/unslop/blob/17ed39c9d0b522f44190ff0c6233867eadee192a/SKILL.md)
  and "Licensed MIT" in the
  [README](https://github.com/theclaymethod/unslop/blob/17ed39c9d0b522f44190ff0c6233867eadee192a/README.md#requirements-and-license).
  That revision supplies no standalone license or copyright-notice file.

Stacks adapts the core preservation contract, contextual pattern categories,
cleanup and rewrite flows, teach and mimic voice-card workflows, and four
presets. The namespaced entrypoint and references are maintained under Stacks'
MIT license with credit to the upstream author.

The adaptation uses qualitative agent review instead of upstream's Python
scanners, machine voice profiles, private-transcript harvesting, model
orchestration, and evaluation harness. It makes no claim of scanner parity,
measured voice fidelity, automated preservation coverage, or benchmark results.
Any future executable helper for this adaptation must use TypeScript and Bun.

This snapshot is bundled locally. Installing or invoking the skill requires
no upstream download, extra dependency, or runtime script.
