#!/bin/bash

REQUIRED_NODE_VERSION="18.15.0"

if command -v nvm &> /dev/null
then
    . "$(nvm which bash)"

    if ! nvm ls "$REQUIRED_NODE_VERSION" &> /dev/null
    then
        echo "Node.js version $REQUIRED_NODE_VERSION not found. Installing..."
        nvm install "$REQUIRED_NODE_VERSION"
    fi

    if ! pnpm &> /dev/null
    then
        echo "pnpm not found. Enabling pnpm..."
        corepack install pnpm
    fi
elif command -v fnm &> /dev/null
then
    echo "fnm found. Installing Node.js version $REQUIRED_NODE_VERSION..."
    fnm install "$REQUIRED_NODE_VERSION"
else
    echo "nvm or fnm not found. Please install nvm or fnm to continue."
    exit 1
fi

echo "Node.js version $REQUIRED_NODE_VERSION is installed and pnpm is enabled."
