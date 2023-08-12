#!/bin/sh

# Find all directories containing package.json recursively in ../core
for dir in $(find ../core -name 'package.json' -exec dirname {} \;); do
  # Navigate into directory and execute your command in background
  (cd "$dir" && bun --bun run build) &
done

# Wait for all background jobs to finish
wait

# Find all directories containing package.json recursively in ../core
# for dir in $(find ../core -name 'package.json' -exec dirname {} \;); do
#   # Navigate into directory
#   cd "$dir"
#   # Execute your command
#   bun --bun run build
#   # Navigate back to the original directory
#   cd -
# done

# # loop over every directory in .stacks/core/*
# for dir in ../core/*/; do
#   # -d checks if it's a directory
#   if [[ -d "$dir" ]]; then
#     # navigate into directory
#     cd "$dir"
#     # execute your command
#     bun --bun run build
#     # navigate back to the original directory
#     cd -
#   fi
# done
