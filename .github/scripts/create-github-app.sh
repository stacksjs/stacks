#!/bin/bash
# This script helps create a GitHub App for homebrew automation

echo "================================================================"
echo "GitHub App Creation Helper for Stacks Homebrew Automation"
echo "================================================================"
echo

# Try to load from .env file if it exists
if [ -f ".env" ] || [ -f "../../.env" ]; then
  source .env 2>/dev/null || source ../../.env 2>/dev/null
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Error: GITHUB_TOKEN environment variable is not set"
  echo
  echo "To fix this, you need to:"
  echo "1. Create a Personal Access Token (PAT):"
  echo "   - Go to: https://github.com/settings/tokens/new"
  echo "   - Click 'Generate new token (classic)'"
  echo "   - Give it a name like 'Stacks Homebrew Automation'"
  echo "   - Set expiration (recommended: 90 days)"
  echo "   - Select these scopes:"
  echo "     ✓ admin:org (Full control of orgs and teams)"
  echo "     ✓ repo (Full control of private repositories)"
  echo "   - Click 'Generate token' and copy the token"
  echo
  echo "2. Set the token in one of these ways:"
  echo "   a. Export it directly:"
  echo "      export GITHUB_TOKEN=your_token_here"
  echo "   b. Or add it to your .env file:"
  echo "      echo 'GITHUB_TOKEN=your_token_here' >> .env"
  echo
  echo "3. Run this script again:"
  echo "   ./github/scripts/create-github-app.sh"
  echo
  echo "Note: The token will only be shown once. Make sure to copy it!"
  echo "      You can revoke it anytime at: https://github.com/settings/tokens"
  exit 1
fi

echo "1. Going to help you create a GitHub App..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "GitHub CLI is not installed. Please install it:"
  echo "  - macOS: brew install gh"
  echo "  - Linux: https://github.com/cli/cli#installation"
  exit 1
fi

# Authenticate with GitHub CLI if needed
gh auth status || (echo "Authenticating with GitHub CLI..." && echo "$GITHUB_TOKEN" | gh auth login --with-token)

echo
echo "2. Opening GitHub App creation page in your browser..."
echo "   IMPORTANT: You need to create this app in the stacksjs organization!"
echo "   - Go to: https://github.com/organizations/stacksjs/settings/apps/new"
echo "   - If that doesn't work, go to github.com/stacksjs, click Settings → Developer settings → GitHub Apps → New GitHub App"
echo
echo "   Please fill in the following details:"
echo "   - GitHub App name: Stacks Homebrew Automation"
echo "   - Homepage URL: https://github.com/stacksjs/stacks"
echo "   - Callback URL: (leave blank)"
echo "   - Description: App for managing Homebrew tap for Stacks"
echo
echo "   - Webhook section:"
echo "     ✗ Active: UNCHECK this box (this makes the URL and secret optional)"
echo "     (With Active unchecked, you can ignore the Webhook URL and Secret fields)"
echo
echo "   - Under Repository permissions, select:"
echo "     ✓ Contents: Read & write"
echo "     ✓ Metadata: Read-only"
echo
echo "   - Under Organization permissions, select:"
echo "     ✓ Administration: Read & write"
echo "     (Note: GitHub App can't create repositories, we'll use PAT for that)"
echo
echo "   - At the bottom, select 'Only on this account' for installation"
echo

# Open the URL in the browser for the stacksjs organization
open "https://github.com/organizations/stacksjs/settings/apps/new" 2>/dev/null || xdg-open "https://github.com/organizations/stacksjs/settings/apps/new" 2>/dev/null || echo "Please open this URL in your browser: https://github.com/organizations/stacksjs/settings/apps/new"

echo
echo "3. After clicking 'Create GitHub App':"
echo "   a. You'll be redirected to the App settings page"
echo "   b. Note your App ID (shown at the top)"
echo "   c. Generate a private key by clicking 'Generate a private key'"
echo "   d. Save the downloaded .pem file"
echo

echo "4. Please enter the App ID from the settings page: "
read APP_ID

if [ -z "$APP_ID" ]; then
  echo "Error: No App ID provided"
  exit 1
fi

echo
echo "5. Please enter the path to the downloaded .pem private key file: "
read PEM_PATH

if [ ! -f "$PEM_PATH" ]; then
  echo "Error: Private key file not found at $PEM_PATH"
  exit 1
fi

PEM_KEY=$(cat "$PEM_PATH")

echo "6. Successfully registered GitHub App with ID: $APP_ID"

# Create GitHub repository secrets
echo "7. Creating GitHub repository and organization secrets..."

# Create secrets in the repository
echo "Creating GH_APP_ID secret..."
gh secret set GH_APP_ID -b"$APP_ID" -R stacksjs/stacks

echo "Creating GH_APP_PRIVATE_KEY secret..."
gh secret set GH_APP_PRIVATE_KEY -b"$PEM_KEY" -R stacksjs/stacks

echo "Creating GH_PAT as an ORGANIZATION secret (available to all stacksjs repos)..."
gh secret set GH_PAT -b"$GITHUB_TOKEN" -o stacksjs --visibility all

echo
echo "8. Installation:"
echo "   - On the App settings page, click 'Install App' in the sidebar"
echo "   - You should see the stacksjs organization listed"
echo "   - Click 'Install' next to stacksjs"
echo "   - On the next page, choose 'All repositories' or 'Only select repositories'"
echo "   - If 'Only select repositories', make sure to select 'stacks'"
echo "   - Click 'Install'"
echo

echo "Setup completed successfully!"
echo "The GitHub App ID is: $APP_ID"
echo "These values have been set as repository and organization secrets."
echo "================================================================"