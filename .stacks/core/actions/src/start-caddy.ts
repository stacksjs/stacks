import { runCommand, log } from '@stacksjs/cli';
import { path as p } from '@stacksjs/path';

log.info('Starting web server/s...');

await runCommand('caddy run', {
  cwd: p.frameworkPath(),
  silent: true,
  // background: true,
});
