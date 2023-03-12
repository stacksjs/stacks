#!/bin/bash

REQUIRED_NODE_VERSION=$(cat ./node-version)

INSTALLED_NODE_VERSION=$(node -v 2>/dev/null || echo "")

if [[ "$(node -p "semver.satisfies('$INSTALLED_NODE_VERSION', '$REQUIRED_NODE_VERSION')")" == "false" ]]
then
    if command -v nvm &> /dev/null
    then
        . "$(nvm which bash)"
        if ! nvm ls "$REQUIRED_NODE_VERSION" &> /dev/null
        then
            echo "Node.js version $REQUIRED_NODE_VERSION not found. Installing..."
            nvm install "$REQUIRED_NODE_VERSION"
        fi
    elif command -v fnm &> /dev/null
    then
        echo "fnm found. Installing Node.js version $REQUIRED_NODE_VERSION..."
        fnm install "$REQUIRED_NODE_VERSION"
    else
        echo "Node.js version $REQUIRED_NODE_VERSION or greater not found, and nvm or fnm not found. Please install Node.js or nvm/fnm to continue."
        exit 1
    fi
fi

if ! command -v pnpm &> /dev/null
then
    echo "pnpm not found. Enabling pnpm..."
    corepack install pnpm
fi

echo "Node.js version $REQUIRED_NODE_VERSION or greater is installed and pnpm is enabled."
