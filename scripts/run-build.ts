/**
 * Thanks: https://github.com/vitebook/vitebook/blob/main/scripts/run-build.js
 */

import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import { prompts } from 'prompts';
import { resolve, dirname } from 'pathe';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(__dirname, '../packages');

const packages = readdirSync(packagesDir).filter(
    (dirName) => !dirName.startsWith('.'),
);

const pkgArg = packages.includes(process.argv[2]) ? process.argv[2] : undefined;
const pkgArgIndex = packages.findIndex((pkg) => pkg === pkgArg);

const pkgIndex =
    pkgArgIndex >= 0
        ? pkgArgIndex
        : await prompts.select({
            message: 'Pick a package',
            choices: packages,
            initial: 0,
        });

const pkg = packages[pkgIndex];
const watch = process.argv.includes('-w') || process.argv.includes('--watch');

spawn('pnpm', ['run', watch ? 'dev' : 'build', `--workspace=@ow3/${pkg}`], {
    stdio: 'inherit',
});