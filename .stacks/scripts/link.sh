#!/bin/sh

# loop over every directory in .stacks/core/*
for dir in ../core/*/
do
    # -d checks if it's a directory
    if [[ -d "$dir" ]]; then
        # navigate into directory
        cd "$dir"
        # execute your command
        bun link
        # navigate back to the original directory
        cd -
    fi
done
