#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION_NUMBER=${VERSION#v}  # Remove 'v' prefix if present
FORMULA_FILE=".github/homebrew/stacks.rb"

# Download the binaries to calculate their SHA256
mkdir -p .github/temp
cd .github/temp

curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-darwin-arm64" -o buddy-darwin-arm64
curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-darwin-x64" -o buddy-darwin-x64
curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-linux-arm64" -o buddy-linux-arm64
curl -sL "https://github.com/stacksjs/stacks/releases/download/$VERSION/buddy-linux-x64" -o buddy-linux-x64

# Calculate SHA256 checksums
SHA_ARM64=$(shasum -a 256 buddy-darwin-arm64 | cut -d ' ' -f 1)
SHA_X64=$(shasum -a 256 buddy-darwin-x64 | cut -d ' ' -f 1)
SHA_LINUX_ARM64=$(shasum -a 256 buddy-linux-arm64 | cut -d ' ' -f 1)
SHA_LINUX_X64=$(shasum -a 256 buddy-linux-x64 | cut -d ' ' -f 1)

cd ../..

# Update the formula
sed -i '' "s/version \".*\"/version \"$VERSION_NUMBER\"/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_ARM64/$SHA_ARM64/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_X64/$SHA_X64/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_LINUX_ARM64/$SHA_LINUX_ARM64/" $FORMULA_FILE
sed -i '' "s/PLACEHOLDER_SHA_LINUX_X64/$SHA_LINUX_X64/" $FORMULA_FILE

echo "Updated Homebrew formula with version $VERSION_NUMBER and SHA256 checksums"

# Clean up
rm -rf .github/temp