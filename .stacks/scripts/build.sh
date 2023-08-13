#!/bin/sh

# Find all directories containing package.json recursively in ../core
for dir in $(find ../core -name 'package.json' -exec dirname {} \;); do
  # Navigate into directory and execute your command in background
  (cd "$dir" && bun --bun run build) &
done

# Wait for all background jobs to finish
wait
