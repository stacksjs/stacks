---
title: Projects
description: "One buddy for every Stacks project on your machine: run it from any directory, target a project by name, and move between projects from the dashboard."
---
# Projects

Buddy is installed once and works with every Stacks project on your machine. It finds the project you are in, keeps a list of the projects it has seen, and can open any of them from anywhere.

## Run buddy from anywhere

Inside a project, `buddy` works from any directory, not only the root:

```bash
cd ~/Code/shop/app/Models
buddy migrate          # runs for ~/Code/shop
```

Buddy walks up from where you are to the project root and runs the command there. If the project has its own `buddy` installed, that one does the work, so the command runs on the framework version the project pins.

A fresh clone has no `buddy` of its own until its dependencies are installed, so the one thing buddy runs there is the install. Anything else tells you to do that first:

```bash
cd ~/Code/shop          # just cloned
buddy install           # then everything else works
```

## Target a project by name

Every built-in command takes `--project`, with a name from the project list or a path, before or after the command:

```bash
buddy migrate --project shop
buddy --project shop migrate
buddy dev --project ~/Code/shop
buddy ports -p shop
```

A name is matched exactly first, then as the start of a name, then anywhere in one. If more than one project matches, buddy names them and stops. It does not guess.

In front of the command, `-p` always means the project. After it, a command that uses `-p` for something else keeps it: `buddy serve -p 3000` is a port, `buddy -p shop serve -p 3000` is both.

## The project list

```bash
buddy projects
```

```
  shop        ~/Code/clients/acme/shop  ● http://localhost:3900
  blog        ~/Code/personal/blog
  docs-site   ~/Code/docs-site
```

Projects are listed most recently used first. A green dot marks a project whose dashboard is running, with its address.

A project joins the list the first time buddy runs inside it. To add the projects already on disk:

```bash
buddy projects:scan            # look through your home directory
buddy projects:scan ~/Code     # or one directory
```

Git worktrees and checkouts in the system's temporary directory are copies of a project rather than projects of their own, so neither running buddy in one nor a scan adds it. `buddy projects:add` adds one when you want it listed.

A project whose directory is gone (deleted, or on a drive that is not mounted) is left out of the list until it is back. `buddy projects:prune` forgets those for good.

### Commands

| Command | What it does |
|---------|--------------|
| `buddy projects` | List the projects on this machine |
| `buddy projects --quiet` | Print only the paths, one per line |
| `buddy projects --json` | Print the list as JSON |
| `buddy projects:add [path]` | Add a project (the current one by default) |
| `buddy projects:remove <name>` | Take a project off the list. The project itself is not touched |
| `buddy projects:scan [dir]` | Find projects under a directory and add them |
| `buddy projects:prune` | Drop listed projects whose directory is gone |

The list lives in `~/.stacks/projects/`, one small file per project.

### Jump to a project

`buddy cd` prints a project's path, so a shell function can take you there:

```bash
# ~/.zshrc
bcd() { eval "$(buddy cd "$1" --eval)"; }
```

```bash
bcd shop
```

### Scripting

```bash
# Open a project picked with fzf
code "$(buddy projects --quiet | fzf)"

# Run a command in every project
for project in $(buddy projects --quiet); do
  buddy outdated --project "$project"
done
```

## Open a dashboard

```bash
buddy dashboard          # the project you are in
buddy dashboard shop     # any project, from anywhere
```

The dashboard starts in the background if it is not already running, opens in your browser, and stops by itself once nobody has used it for a while. There is no terminal to keep open.

Buddy uses `https://dashboard.<APP_URL host>` when the local rpx proxy serves it. Set `DASHBOARD_URL=https://attic.test` in the project's `.env` to choose a different hostname. Run `buddy setup:ssl` to set up local DNS and trust the development CA. When HTTPS is unavailable, Buddy opens the direct address on the project's reserved port, using its `.localhost` dashboard name when available.

| Option | What it does |
|--------|--------------|
| `--no-open` | Start it and print the address without opening a browser |
| `--stop` | Stop the project's background dashboard |

`buddy dev:dashboard` is still there when you want the dashboard in the foreground, in its own native window, for as long as the terminal is open. It uses the same stx pages as the browser dashboard.

### Switch projects in the dashboard

The top of the dashboard sidebar shows the project you are looking at. Click it to see every project on the machine, type to filter, and pick one. If that project's dashboard is not running yet, it is started for you and the page moves there when it is ready.

"Add a project" at the bottom of the menu takes the path of a project that is not on the list yet.

## Buddy in the macOS menu bar

With Craft installed, run `buddy tray` from any directory. Click the Buddy menu-bar icon to check what the daemon is watching, find a registered project, or open its dashboard. Buddy uses Craft’s native popover and supports the system’s light and dark appearance.

Overview shows CPU utilization and active, wired, and compressed RAM while the popover is open. The Pantry view shows installed packages, searches the local Pantry catalog, and follows install and removal jobs. Run `pantry desktop setup --yes` to enable the bridge, then pair in Buddy using the code from `pantry desktop pair`. Buddy stores its Pantry connection in the macOS Keychain. Pantry manages the packages in your user account and handles removal of the packages it owns.

When generated changes await approval, **Review** opens the project’s review command in Terminal. Read the diff and respond to the confirmation there. The menu includes **Start daemon** when Buddy is offline. **Quit Buddy** closes the menu-bar app while the daemon continues watching projects.

## Buddy in the background

One background Buddy process manages dashboards and generation for registered projects. It starts when you open a dashboard or run `buddy daemon:start`. It stays running while any opted-in project needs watching.

```bash
buddy daemon:start
buddy daemon:status --json
buddy daemon:logs
buddy daemon:stop
```

The daemon watches the project registry and source directories with native filesystem events. It coalesces saves and runs one generator at a time, using the Stacks runtime installed in each project. Its socket under `~/.stacks/buddy/` is accessible to your user.

### Keep generated files current

Add this to `config/buddy.json` in each project you want Buddy to watch.

```json
{
  "generation": {
    "enabled": true,
    "autoCommit": false
  }
}
```

Run `buddy projects:scan ~/Code` to discover existing projects and `buddy daemon:start` to watch them. Additions to the registry and edits to the policy take effect while the daemon is running. Run `buddy generate:project` for a one-off refresh under the same policy.

| Setting | Generated files |
| --- | --- |
| `imports` | Function and model barrels, action and job registries, and auto-import declarations |
| `migrations` | Model-derived SQL and snapshots for the configured dialect and existing sibling corpora |
| `types` | Named routes, redirects, and database type declarations |

Each generator is enabled by default after opt-in. Set its key to `false` to disable it. Background generation writes files for review and leaves potentially destructive migration changes to an explicit `buddy generate:migrations`.

Set `autoCommit` to `true` to commit clean-before generated paths under the project's usual Git identity and hooks. Unrelated staged changes stay staged. Review the generated files with the model or source changes when you leave this setting at its default of `false`.

### Approve generated commits

Set `generation.commitApproval` to `true` with `generation.autoCommit` set to `false` to receive a macOS notification when Buddy has generated changes ready for review. Approval takes precedence if both settings are enabled. Run `buddy generate:review` in the project, or `buddy generate:review --project <name>` from another directory.

Use `buddy daemon:status` to find projects with pending reviews. The daemon retries failed macOS alert submissions independently of generation.

Buddy shows the diff and waits for an explicit yes in an interactive terminal. It commits the reviewed tree locally, using your Git identity and signing settings. This approval path uses Git's commit plumbing, so it does not run the usual `git commit` hooks. It includes newly written migrations with Buddy's generated marker, even if a Git ignore rule covers SQL.

With approval enabled, Buddy protects local edits to the generated files it manages and reports conflicts during generation. Successful generators can leave reviewable changes even when another generator fails. After an unrelated commit on the same branch, run `buddy generate:project` to refresh the pending diff before approving it. Buddy carries forward files it can still verify from its previous run.

## Related

- [Dev command](/guide/buddy/dev) - development servers
- [Buddy command reference](/guide/buddy/commands) - every command and option
