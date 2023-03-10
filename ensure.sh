#!/bin/bash

REQUIRED_NODE_VERSION="18.15.0"

if ! command -v nvm &> /dev/null
then
    echo "nvm not found. Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    . ~/.nvm/nvm.sh
fi

if ! nvm ls $REQUIRED_NODE_VERSION &> /dev/null
then
    echo "Node.js version $REQUIRED_NODE_VERSION not found. Installing..."
    nvm install $REQUIRED_NODE_VERSION
fi

echo "Node.js version $REQUIRED_NODE_VERSION is installed."
