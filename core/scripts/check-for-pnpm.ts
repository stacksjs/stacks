/**
 * Thanks: https://github.com/vitebook/vitebook/tree/main/.scripts
 */

if (!/pnpm/.test(process.env.npm_execpath || '')) {
  console.warn(
    '\n⚠️ \u001B[33mThis repository requires using PNPM as the package manager '
    + ' for scripts to work properly.\u001B[39m'
    + '\n\n1. Install Volta to automatically manage it by running: \x1B[1mcurl https://get.volta.sh | bash\x1B[0m',
    '\n2. Install PNPM by running: \x1B[1mvolta install pnpm@7\x1B[0m',
    '\n3. Done! Run `pnpm` commands as usual and it\'ll just work :)',
    '\n\nSee \x1B[1mhttps://volta.sh\x1B[0m for more information.',
    '\n',
  )

  process.exit(1)
}
