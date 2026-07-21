# Stacks on StackBlitz

This starter runs real stx compilation inside StackBlitz WebContainers. It uses the first-party `@stacksjs/stx` compiler and Node's built-in HTTP server because WebContainers expose a Node.js runtime rather than Bun.

Edit `resources/views/welcome.stx` or `resources/css/app.css`. The preview recompiles and reloads when either file changes.

This environment is intentionally scoped to Stacks frontend development. Full Stacks applications require Bun, SQLite, rpx, and tlsx, so backend, database, cloud, and pretty local domain workflows remain local development features.
