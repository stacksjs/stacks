#!/bin/bash
set -e

# Stacks installer script - installs Stacks via Homebrew

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Check if Homebrew is installed, install if not
if ! command -v brew &> /dev/null; then
  echo -e "${BLUE}${BOLD}Installing Homebrew...${NC}"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add Homebrew to PATH if needed (on macOS)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == 'arm64' ]]; then
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
      eval "$(/opt/homebrew/bin/brew shellenv)"
    else
      echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi
fi

# Add Stacks tap and install Stacks
echo -e "${BLUE}${BOLD}Adding Stacks Homebrew tap...${NC}"
brew tap stacksjs/tap

echo -e "${BLUE}${BOLD}Installing Stacks...${NC}"
brew install stacks

# Final messages
echo -e "\n${GREEN}${BOLD}✅ Stacks has been successfully installed!${NC}"
echo -e "${GRAY}You can now use the following commands:${NC}"
echo -e "   ${BOLD}stacks${NC} - The main CLI tool"
echo -e "   ${BOLD}stx${NC} - Shorthand alias for stacks"
echo -e "   ${BOLD}buddy${NC} or ${BOLD}bud${NC} - Additional aliases\n"

echo -e "${BLUE}${BOLD}To get started:${NC}"
echo -e "   stacks --help\n"

# Check if in interactive shell and suggest trying the command
if [[ $- == *i* ]]; then
  echo -e "${GRAY}Would you like to run 'stacks --help' now? (y/n)${NC}"
  read -r response
  if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    stacks --help
  fi
fi