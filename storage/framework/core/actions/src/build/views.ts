import { runCommand } from '@stacksjs/cli'
import { frameworkPath, projectPath } from '@stacksjs/path'

// If the project ships its own `build.ts` (the canonical static-site
// escape hatch — same shape as `serve.ts` for dev), use it. The
// project's build.ts owns the build pipeline (buildStaticSite, store
// bundling, post-processing) and the framework's role here is just to
// invoke it. Mirrors the dev/views.ts loader so `./buddy build:frontend`
// and `./buddy dev:frontend` follow the same convention.
//
// Falls back to the legacy `framework/views/web` Vue-views build for
// projects that haven't migrated yet.
const projectBuild = projectPath('build.ts')
if (await Bun.file(projectBuild).exists()) {
  await runCommand('bun build.ts', {
    cwd: projectPath(),
  })
}
else {
  await runCommand('bun run build', {
    cwd: frameworkPath('views/web'),
  })
}
