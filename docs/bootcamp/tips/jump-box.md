---
title: Cloud Jump Box
description: Add a temporary bastion host for controlled access to private cloud resources.
---
# Jump Box

A jump box provides a controlled entry point to resources that are not publicly reachable. Add one only while private-network access is required:

```bash
./buddy cloud:add --jump-box
```

Remove it after the maintenance session to reduce cost and attack surface:

```bash
./buddy cloud:remove --jump-box
```

Restrict inbound access, use short-lived credentials, and review the generated cloud diff before applying the change.
