# Server

This directory is used to store files to build the Docker image for the server.

## TODO

- [ ] Don't include node_modules in the Docker image, but bundle it using Bun
- [ ] Include bun.lockb file to build the Docker image && the `--frozen-lockfile` flag
- [ ] Ensure to use workspaces in the `package.json` file
- [ ] No need for ./Actions because ./app/Actions
