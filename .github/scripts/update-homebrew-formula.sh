#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Error: Version parameter is required"
  echo "Usage: $0 <version>"
  exit 1
fi

echo "Starting Homebrew formula update for version: $VERSION"

VERSION_NUMBER=${VERSION#v}  # Remove 'v' prefix if present
FORMULA_FILE=".github/homebrew/stacks.rb"

# Ensure the script is executable
chmod +x "$0"

# Ensure formula file exists
if [ ! -f "$FORMULA_FILE" ]; then
  echo "Error: Formula file not found at $FORMULA_FILE"
  exit 1
fi

# Check if files were already downloaded by the GitHub workflow
if [ -f ".github/temp/buddy-darwin-arm64" ] && [ -f ".github/temp/buddy-darwin-x64" ] && [ -f ".github/temp/buddy-linux-arm64" ] && [ -f ".github/temp/buddy-linux-x64" ]; then
  echo "Using pre-downloaded binaries in .github/temp/"
  cd .github/temp
else
  echo "Creating temporary directory for binary downloads"
  # Download the binaries to calculate their SHA256
  mkdir -p .github/temp
  cd .github/temp

  echo "Downloading binaries from GitHub release"
  curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-darwin-arm64" -o buddy-darwin-arm64
  curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-darwin-x64" -o buddy-darwin-x64
  curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-linux-arm64" -o buddy-linux-arm64
  curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-linux-x64" -o buddy-linux-x64

  # Verify downloads
  for file in buddy-darwin-arm64 buddy-darwin-x64 buddy-linux-arm64 buddy-linux-x64; do
    if [ ! -f "$file" ] || [ ! -s "$file" ]; then
      echo "Error: Failed to download $file"
      exit 1
    fi
  done
fi

echo "Calculating SHA256 checksums"
# Calculate SHA256 checksums
SHA_ARM64=$(shasum -a 256 buddy-darwin-arm64 | cut -d ' ' -f 1)
SHA_X64=$(shasum -a 256 buddy-darwin-x64 | cut -d ' ' -f 1)
SHA_LINUX_ARM64=$(shasum -a 256 buddy-linux-arm64 | cut -d ' ' -f 1)
SHA_LINUX_X64=$(shasum -a 256 buddy-linux-x64 | cut -d ' ' -f 1)

cd ../..

echo "Updating formula with version $VERSION_NUMBER and checksums"
# Update the formula
sed -i '' "s/version \".*\"/version \"$VERSION_NUMBER\"/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_ARM64/$SHA_ARM64/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_X64/$SHA_X64/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_LINUX_ARM64/$SHA_LINUX_ARM64/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_LINUX_X64/$SHA_LINUX_X64/" $FORMULA_FILE

echo "Updated Homebrew formula with version $VERSION_NUMBER and SHA256 checksums"
echo "SHA256 darwin-arm64: $SHA_ARM64"
echo "SHA256 darwin-x64: $SHA_X64"
echo "SHA256 linux-arm64: $SHA_LINUX_ARM64"
echo "SHA256 linux-x64: $SHA_LINUX_X64"

# Clean up
echo "Cleaning up temporary files"
# Do not remove the temp directory as it might be needed by other steps
# rm -rf .github/temp