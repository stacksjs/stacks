#!/bin/bash

REQUIRED_NODE_VERSION=$(cat ./node-version)

INSTALLED_NODE_VERSION=$(node -v 2>/dev/null || echo "")
INSTALLED_NODE_VERSION=${INSTALLED_NODE_VERSION#v} # removes the 'v' prefix
INSTALLED_NODE_MAJOR=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f1)
INSTALLED_NODE_MINOR=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f2)
INSTALLED_NODE_PATCH=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f3)

REQUIRED_NODE_MAJOR=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f1)
REQUIRED_NODE_MINOR=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f2)
REQUIRED_NODE_PATCH=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f3)

if [[ "$INSTALLED_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" || \
      ( "$INSTALLED_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" && "$INSTALLED_NODE_MINOR" -lt "$REQUIRED_NODE_MINOR" ) || \
      ( "$INSTALLED_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" && "$INSTALLED_NODE_MINOR" -eq "$REQUIRED_NODE_MINOR" && "$INSTALLED_NODE_PATCH" -lt "$REQUIRED_NODE_PATCH" ) ]]
then
    if [ -f "$HOME/.nvm/nvm.sh" ]; then
        . "$HOME/.nvm/nvm.sh"
        if ! nvm ls "$REQUIRED_NODE_VERSION" &> /dev/null
        then
            echo "Node.js version $REQUIRED_NODE_VERSION not found. Installing..."
            nvm install "$REQUIRED_NODE_VERSION"
        fi
        nvm use "$REQUIRED_NODE_VERSION"
    elif [ -f "$HOME/.fnm/fnm" ]; then
        echo "fnm found. Installing Node.js version $REQUIRED_NODE_VERSION..."
        fnm install "$REQUIRED_NODE_VERSION"
    else
        echo "Node.js version $REQUIRED_NODE_VERSION or greater not found. Neither nvm or fnm found. Setting up your Stacks Node version manager..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        . "$HOME/.nvm/nvm.sh"
        nvm install "$REQUIRED_NODE_VERSION"
        nvm use "$REQUIRED_NODE_VERSION"
    fi
fi

if ! command -v pnpm &> /dev/null
then
    echo "pnpm not found. Enabling pnpm..."
    corepack enable
    corepack install pnpm
fi

echo "Node.js version $REQUIRED_NODE_VERSION or greater is installed & pnpm is enabled."
