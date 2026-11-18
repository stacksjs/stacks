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

Each project keeps the same address every time (`http://localhost:3900`, `3901`, and so on), so your browser remembers each project's session and settings separately.

| Option | What it does |
|--------|--------------|
| `--no-open` | Start it and print the address without opening a browser |
| `--stop` | Stop the project's background dashboard |

`buddy dev:dashboard` is still there when you want the dashboard in the foreground, in its own native window, for as long as the terminal is open.

### Switch projects in the dashboard

The top of the dashboard sidebar shows the project you are looking at. Click it to see every project on the machine, type to filter, and pick one. If that project's dashboard is not running yet, it is started for you and the page moves there when it is ready.

"Add a project" at the bottom of the menu takes the path of a project that is not on the list yet.

## Buddy in the background

Opening a dashboard from the switcher or with `buddy dashboard` uses a small background process that starts dashboards on request. You never have to start it: whatever needs it starts it, and it stops by itself when it has no dashboards left to look after.

```bash
buddy daemon            # is it running, and what is it running
buddy daemon:stop       # stop it and the dashboards it started
buddy daemon:logs       # what it has been doing
```

It is built to cost nothing when idle: it loads no project code, polls nothing, and holds about 25 MB while it runs. It listens on a socket file in `~/.stacks/buddy/` that only your user can open, not on a network port.

## Related

- [Dev command](/guide/buddy/dev) - development servers
- [Buddy command reference](/guide/buddy/commands) - every command and option
