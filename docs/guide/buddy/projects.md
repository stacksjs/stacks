# Projects Command

The `buddy projects` command helps you discover and manage all Stacks projects on your system, making it easy to work with multiple projects.

## Basic Usage

```bash
# Find all Stacks projects
buddy projects

# List projects
buddy projects:list
```

## Command Syntax

```bash
buddy projects [options]
buddy projects:list [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-q, --quiet` | Use minimal output |
| `-l, --list` | List all local Stacks projects |
| `--verbose` | Enable verbose output |

## Examples

### Find All Projects

```bash
buddy projects
```

Output:
```
buddy projects

   -  /Users/username/Code/my-app
   -  /Users/username/Code/another-project
   -  /Users/username/Projects/stacks-demo
```

### List Projects

```bash
buddy projects:list
```

### Quiet Mode

For scripting and piping:

```bash
buddy projects --quiet
```

Output (no decorations):
```
/Users/username/Code/my-app
/Users/username/Code/another-project
/Users/username/Projects/stacks-demo
```

### Verbose Output

```bash
buddy projects --verbose
```

Shows additional information about each project.

## How It Works

The command scans your home directory for directories containing:

- `package.json` with Stacks dependencies
- Stacks configuration files
- The characteristic Stacks project structure

## Use Cases

### Multi-Project Development

When working on multiple Stacks projects:

```bash
# See all projects
buddy projects

# Navigate to a specific project
cd /Users/username/Code/my-app

# Run commands in that project
buddy dev
```

### Project Discovery

Find forgotten or old projects:

```bash
buddy projects --verbose
```

### Scripting

Use in scripts for batch operations:

```bash
# Run tests in all projects
for project in $(buddy projects --quiet); do
  echo "Testing $project"
  (cd "$project" && buddy test)
done
```

### Project Switching

Create an alias for quick project switching:

```bash
# Add to .zshrc or .bashrc
function sp() {
  local project=$(buddy projects --quiet | fzf)
  if [ -n "$project" ]; then
    cd "$project"
  fi
}
```

Then use `sp` to interactively select a project.

## Search Locations

The command searches in:

- Home directory (`~/`)
- Common development directories:
  - `~/Code`
  - `~/Projects`
  - `~/Development`
  - `~/Sites`
  - `~/work`

## Project Identification

A directory is identified as a Stacks project if it contains:

- `package.json` with `@stacksjs/*` dependencies
- `config/app.ts` or similar Stacks config
- Stacks-specific directory structure

## Performance

For faster scanning:

```bash
# Skip deep directories
buddy projects --max-depth 3

# Search specific directory
buddy projects --path ~/Code
```

## Integration with IDEs

### VS Code

Use the project list to add workspaces:

```bash
# Get project paths
buddy projects --quiet > stacks-projects.txt

# Open in VS Code
code $(buddy projects --quiet | head -1)
```

### JetBrains IDEs

```bash
# Open in WebStorm
webstorm $(buddy projects --quiet | head -1)
```

## Troubleshooting

### No Projects Found

```
No Stacks projects found
```

**Solutions**:
1. Ensure you have Stacks projects installed
2. Check that projects have proper package.json
3. Try with verbose mode to see search paths

### Slow Scanning

If scanning takes too long:

1. Use `--quiet` mode
2. Specify a search path
3. Exclude large directories

### Permission Errors

```
Permission denied: /some/directory
```

**Solution**: The command skips directories without read permission. These can be ignored safely.

## Project Information

For detailed information about a specific project:

```bash
# Navigate to project
cd /path/to/project

# View version
buddy version

# List available commands
buddy list
```

## Working with Multiple Projects

### Running Commands Across Projects

```bash
#!/bin/bash
# upgrade-all.sh

for project in $(buddy projects --quiet); do
  echo "Upgrading $project"
  (cd "$project" && buddy upgrade)
done
```

### Checking Project Status

```bash
#!/bin/bash
# status-all.sh

for project in $(buddy projects --quiet); do
  echo "=== $project ==="
  (cd "$project" && git status --short)
done
```

## Best Practices

### Organize Projects

Keep Stacks projects in a consistent location:

```
~/Code/
├── project-a/
├── project-b/
└── project-c/
```

### Version Control

Ensure all projects are in version control:

```bash
for project in $(buddy projects --quiet); do
  if [ ! -d "$project/.git" ]; then
    echo "Not a git repo: $project"
  fi
done
```

### Regular Updates

Keep all projects up to date:

```bash
for project in $(buddy projects --quiet); do
  echo "Checking $project"
  (cd "$project" && buddy outdated)
done
```

## Related Commands

- [buddy version](/guide/buddy/version) - View version information
- [buddy upgrade](/guide/buddy/upgrade) - Upgrade dependencies
- [buddy list](/guide/buddy/intro) - List available commands
