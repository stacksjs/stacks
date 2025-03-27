# Installing Stacks with Homebrew

Stacks is available via Homebrew for macOS and Linux users, making installation quick and simple.

## Quick Install

The fastest way to install Stacks is with our one-line installation script:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/stacksjs/stacks/main/.github/scripts/install.sh)"
```

This script:

- Installs Homebrew if it's not already installed
- Adds the Stacks Homebrew tap
- Installs Stacks
- Sets up convenient command aliases

## Manual Installation

If you prefer to install manually:

1. Make sure you have [Homebrew](https://brew.sh/) installed:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Add the Stacks tap:

```bash
brew tap stacksjs/tap
```

3. Install Stacks:

```bash
brew install stacks
```

## Post-Installation

After installation, you'll have access to the following commands:

- `stacks` - The main CLI tool
- `stx` - Shorthand alias for stacks
- `buddy` or `bud` - Additional aliases

Try running `stacks --help` to see available commands.

## Updating

To update to the latest version of Stacks:

```bash
brew update
brew upgrade stacks
```

Alternatively, you can update Stacks using the `stacks` command:

```bash
stacks upgrade
# or
stacks upgrade --canary
```

## Uninstalling

If you need to uninstall Stacks:

```bash
brew uninstall stacks
brew untap stacksjs/tap  # Optional: remove the tap as well
