import { projectPath } from '@stacksjs/path'
import { runBuildStep } from './run-build-step'

// If the project ships its own `build.ts` (the canonical static-site
// escape hatch — same shape as `serve.ts` for dev), use it. The
// project's build.ts owns the build pipeline (buildStaticSite, store
// bundling, post-processing) and the framework's role here is just to
// invoke it. Mirrors the dev/views.ts loader so `./buddy build:frontend`
// and `./buddy dev:frontend` follow the same convention.
//
// Projects without a custom build use the STX static-site builder directly.
const projectBuild = projectPath('build.ts')

if (await Bun.file(projectBuild).exists()) {
  await runBuildStep('bun build.ts', {
    cwd: projectPath(),
    describe: 'The frontend build',
  })
}
else {
  await runBuildStep('bunx --bun @stacksjs/stx build --pages resources/views --out dist', {
    cwd: projectPath(),
    describe: 'The frontend build',
  })
}
