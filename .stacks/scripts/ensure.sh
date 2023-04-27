#!/bin/sh
REQUIRED_NODE_VERSION=$(awk '/nodejs.org/{print substr($2, 2)}' ../../tea.yaml | tr -d "'")

# Remove the '>=v' prefix from the version string
REQUIRED_NODE_VERSION=${REQUIRED_NODE_VERSION#>=v}

REQUIRED_NODE_MAJOR=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f1)
REQUIRED_NODE_MINOR=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f2)
REQUIRED_NODE_PATCH=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f3)

INSTALLED_NODE_VERSION=$(node -v 2>/dev/null || echo "")
INSTALLED_NODE_VERSION=${INSTALLED_NODE_VERSION#v} # removes the 'v' prefix
INSTALLED_NODE_MAJOR=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f1)
INSTALLED_NODE_MINOR=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f2)
INSTALLED_NODE_PATCH=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f3)

if [[ "$INSTALLED_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ||
  ("$INSTALLED_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" && "$INSTALLED_NODE_MINOR" -lt "$REQUIRED_NODE_MINOR") ||
  ("$INSTALLED_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" && "$INSTALLED_NODE_MINOR" -eq "$REQUIRED_NODE_MINOR" && "$INSTALLED_NODE_PATCH" -lt "$REQUIRED_NODE_PATCH") ]]; then
    sh ./setup.sh
    node_version=$(exec $SHELL -l -c "source ~/.zshrc; tea +nodejs.org'=$REQUIRED_NODE_VERSION' >/dev/null 2>&1; tea +nodejs.org'=$REQUIRED_NODE_VERSION' node -v")
    pnpm_version=$(exec $SHELL -c "source ~/.zshrc; tea >/dev/null 2>&1; pnpm -v >/dev/null 2>&1; pnpm -v")
    exec $SHELL -c "source ~/.zshrc; tea -SE >/dev/null 2>&1 && cd ."
    echo "  # managed by stacks"
    echo "  • node.js $node_version"
    echo "  • pnpm v$pnpm_version"
    # sh ./publish.sh
    echo "\n  Please reopen your shell for updates to take effect." | awk '{print "\033[3m" $0 "\033[0m"}'

    exit
fi

echo "Node.js v$REQUIRED_NODE_VERSION or greater is installed!"
