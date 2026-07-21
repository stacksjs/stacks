---
title: Extending the Dashboard
description: Add STX dashboard pages, actions, and navigation without editing framework defaults.
---
# Extending the Dashboard

Application files override framework defaults by path. To customize a dashboard page or action, create the matching file under your application's `resources/` or `app/` directory and keep the framework copy unchanged.

Use STX components from `resources/components/`, Crosswind utilities for styling, and server actions for data access. Register new navigation destinations in the application dashboard configuration.

Run the dashboard during development with:

```bash
./buddy dev dashboard
```

See [Extending the dashboard](/bootcamp/how-to/extend-dashboard) for a complete example.
