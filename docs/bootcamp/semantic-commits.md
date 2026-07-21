---
title: Semantic Commits
description: Use small conventional commits to make releases and changelogs predictable.
---
# Semantic Commits

Stacks repositories use conventional commit prefixes. Choose the prefix that describes the user-facing purpose of the change:

```text
feat: add invoice reminders
fix(router): preserve query parameters
docs: explain queue retries
chore: refresh development tooling
```

Keep each commit focused and write the subject in the imperative mood. Breaking changes belong in the commit body with a `BREAKING CHANGE:` footer.
