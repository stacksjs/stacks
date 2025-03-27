#!/bin/bash
# This script helps create a GitHub App for homebrew automation

echo "================================================================"
echo "GitHub App Creation Helper for Stacks Homebrew Automation"
echo "================================================================"
echo

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Please set the GITHUB_TOKEN environment variable with a personal access token that has"
  echo "admin:org and repo permissions."
  echo
  echo "Example: GITHUB_TOKEN=your_token_here .github/scripts/create-github-app.sh"
  exit 1
fi

echo "1. Going to create a GitHub App via GitHub CLI..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "GitHub CLI is not installed. Please install it:"
  echo "  - macOS: brew install gh"
  echo "  - Linux: https://github.com/cli/cli#installation"
  exit 1
fi

# Authenticate with GitHub CLI if needed
gh auth status || (echo "Authenticating with GitHub CLI..." && echo "$GITHUB_TOKEN" | gh auth login --with-token)

# Create manifest file for GitHub App
cat > app-manifest.json << EOL
{
  "name": "Stacks Homebrew Automation",
  "url": "https://github.com/stacksjs/stacks",
  "hook_attributes": {
    "active": false
  },
  "redirect_url": "https://github.com/stacksjs/stacks",
  "public": false,
  "default_permissions": {
    "administration": "write",
    "contents": "write",
    "metadata": "read"
  },
  "default_events": []
}
EOL

echo "2. Please complete the GitHub App creation process in your browser:"
echo "   - You'll need to follow the link that appears below"
echo "   - Click 'Create GitHub App' on the page that opens"
echo "   - On the next page, note your App ID for the next step"
echo "   - Generate a private key and download the .pem file"
echo

echo "3. Opening GitHub App manifest creation flow..."
gh api --method POST /organizations/stacksjs/github-apps/manifests \
  --field manifest="$(cat app-manifest.json)" \
  --jq '.html_url' | xargs open

echo
echo "4. After completing the steps above, please enter the App ID: "
read APP_ID

echo
echo "5. Please paste the path to the downloaded .pem private key file: "
read PEM_PATH

if [ ! -f "$PEM_PATH" ]; then
  echo "Error: Private key file not found at $PEM_PATH"
  exit 1
fi

PRIVATE_KEY=$(cat "$PEM_PATH")

# Create GitHub repository secrets
echo
echo "6. Creating GitHub repository secrets..."

# Create secrets in the repository
echo "Creating GH_APP_ID secret..."
gh secret set GH_APP_ID -b"$APP_ID" -R stacksjs/stacks

echo "Creating GH_APP_PRIVATE_KEY secret..."
gh secret set GH_APP_PRIVATE_KEY -b"$PRIVATE_KEY" -R stacksjs/stacks

echo
echo "7. Installation:"
echo "   - If you haven't already, install the app to your organization"
echo "   - Navigate to the GitHub App page and click 'Install App'"
echo "   - Choose 'Only select repositories' and select 'stacksjs/stacks'"
echo

echo "Setup completed successfully!"
echo
echo "You can now run your GitHub Actions workflow, which will automatically"
echo "create and manage the homebrew tap repository."
echo "================================================================"

# Clean up
rm -f app-manifest.json