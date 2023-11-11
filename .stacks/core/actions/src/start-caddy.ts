import { runCommand } from '@stacksjs/cli';
import { path as p } from '@stacksjs/path';

await runCommand('caddy run', {
  cwd: p.frameworkPath(),
});
