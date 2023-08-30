#!/bin/sh

# Get the script's directory
script_dir=$(realpath $(dirname "$0"))

# Get all directories in the core path
dirs=$(find "$script_dir/../core" -type d -maxdepth 1)

# Check if no directories found
if [ -z "$dirs" ]; then
  echo "No core packages found"
  exit 1
fi

# Loop through each directory
for dir in $dirs; do
  echo ""
  echo "🏗️  Building..."
  echo "📦 $dir"

  # Change to the directory
  cd $dir

  # Check if the directory is one of the two specified
  ## This is because eslint requires cjs builds which we use unbuild for
  if [ "$dir" = *"/eslint-plugin-stacks" ] || [ "$dir" = *"/eslint-plugin-stacksjs" ]; then
    # Run the bun unbuild command
    bun --bun unbuild
  else
    # Extract the command from build.ts
    cmd=$(sed -nE "s/.*runCommand\('(.*)',.*/\1/p" build.ts)

    # Run the extracted command
    eval $cmd
  fi

  # Check if the build command was successful
  if [ $? -ne 0 ]; then
    echo "Failed to build $dir"
    exit 1
  fi

  echo "✅ Build complete"
  echo ""

  # Change back to the original directory
  cd - >/dev/null
done
