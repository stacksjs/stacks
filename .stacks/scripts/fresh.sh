#!/bin/sh

# delete ../../../yarn.lock and ../../../bun.lockb
rm ../../yarn.lock
rm ../../bun.lock

# delete all node_modules and dist folders
rimraf ../../**/dist
rimraf ../../**/node_modules # ensure this runs last or else rimraf will delete itself

# install dependencies via Bun
bun install -y

# link all core packages
./link.sh
