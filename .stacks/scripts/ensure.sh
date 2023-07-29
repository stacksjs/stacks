#!/bin/sh

## This script ensures that Bun is installed.

REQUIRED_BUN_VERSION=$(awk '/bun.sh/{print substr($2, 2)}' ../../tea.yaml | tr -d "'")

# Remove the '>=v' prefix from the version string
REQUIRED_BUN_VERSION=${REQUIRED_BUN_VERSION#>=v}

REQUIRED_BUN_MAJOR=$(echo "$REQUIRED_BUN_VERSION" | cut -d. -f1)
REQUIRED_BUN_MINOR=$(echo "$REQUIRED_BUN_VERSION" | cut -d. -f2)
REQUIRED_BUN_PATCH=$(echo "$REQUIRED_BUN_VERSION" | cut -d. -f3)

INSTALLED_BUN_VERSION=$(node -v 2>/dev/null || echo "")
INSTALLED_BUN_VERSION=${INSTALLED_BUN_VERSION#v} # removes the 'v' prefix
INSTALLED_BUN_MAJOR=$(echo "$INSTALLED_BUN_VERSION" | cut -d. -f1)
INSTALLED_BUN_MINOR=$(echo "$INSTALLED_BUN_VERSION" | cut -d. -f2)
INSTALLED_BUN_PATCH=$(echo "$INSTALLED_BUN_VERSION" | cut -d. -f3)

if [[ "$INSTALLED_BUN_MAJOR" -lt "$REQUIRED_BUN_MAJOR" ||
  ("$INSTALLED_BUN_MAJOR" -eq "$REQUIRED_BUN_MAJOR" && "$INSTALLED_BUN_MINOR" -lt "$REQUIRED_BUN_MINOR") ||
  ("$INSTALLED_BUN_MAJOR" -eq "$REQUIRED_BUN_MAJOR" && "$INSTALLED_BUN_MINOR" -eq "$REQUIRED_BUN_MINOR" && "$INSTALLED_BUN_PATCH" -lt "$REQUIRED_BUN_PATCH") ]]; then
    sh ./setup.sh
    bun_version=$(exec $SHELL -l -c "source ~/.zshrc; tea +bun.sh'=$REQUIRED_BUN_VERSION' >/dev/null 2>&1; tea +bun.sh'=$REQUIRED_BUN_VERSION' bun -v")
    exec $SHELL -c "source ~/.zshrc; tea -SE >/dev/null 2>&1 && cd ."
    echo "  # managed by stacks"
    echo "  • bun $bun_version"
    echo "\n  Please reopen your shell for updates to take effect." | awk '{print "\033[3m" $0 "\033[0m"}'

    exit
fi

echo "Bun v$REQUIRED_BUN_VERSION or greater is installed!"
