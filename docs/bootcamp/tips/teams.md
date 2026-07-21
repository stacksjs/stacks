---
title: How to manage teams
description: Configure team membership, invitations, roles, and access control in a Stacks application.
---
# How to manage teams

The built-in `Team` model and API routes support membership, invitations, and role changes. Protect team-scoped actions with authentication middleware and gates, then verify that the current user belongs to the requested team before reading or changing its data.

Use personal teams when each account needs a default workspace, and require explicit invitations for shared workspaces. Record role changes and member removal in the activity log.

See [Team management](/bootcamp/saas/team-management) for the model, endpoints, and client examples.
