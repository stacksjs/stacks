# IDE Setup

This guide covers setting up your IDE for optimal Stacks development, including recommended extensions, configurations, and productivity tips.

## Recommended IDEs

Stacks works well with any modern IDE, but we recommend:

- **VS Code** - Primary recommendation
- **Cursor** - AI-powered fork of VS Code
- **WebStorm** - JetBrains IDE
- **Zed** - High-performance editor

## VS Code Setup

### Essential Extensions

Install these extensions for the best experience:

```bash
# Install via command line
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension vue.volar
code --install-extension oven.bun-vscode
```

#### Recommended Extensions List

1. **ESLint** (`dbaeumer.vscode-eslint`) - Linting
2. **Prettier** (`esbenp.prettier-vscode`) - Code formatting
3. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) - CSS autocomplete
4. **Volar** (`vue.volar`) - Vue/TypeScript support
5. **Bun** (`oven.bun-vscode`) - Bun runtime support
6. **TypeScript Vue Plugin (Volar)** (`vue.vscode-typescript-vue-plugin`) - Type support
7. **GitLens** (`eamodio.gitlens`) - Git integration
8. **Error Lens** (`usernamehw.errorlens`) - Inline error display
9. **Auto Rename Tag** (`formulahendry.auto-rename-tag`) - HTML tag editing
10. **Path Intellisense** (`christian-kohler.path-intellisense`) - Path autocomplete

### VS Code Settings

Create or update `.vscode/settings.json`:

```json
{
  // Editor
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false,
  "editor.wordWrap": "on",
  "editor.linkedEditing": true,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": true,

  // Files
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "files.trimFinalNewlines": true,
  "files.associations": {
    "*.stx": "vue"
  },

  // TypeScript
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",

  // ESLint
  "eslint.validate": [
    "javascript",
    "typescript",
    "vue"
  ],
  "eslint.useFlatConfig": true,

  // Tailwind CSS
  "tailwindCSS.includeLanguages": {
    "vue": "html",
    "stx": "html"
  },
  "tailwindCSS.experimental.classRegex": [
    ["class\\s*=\\s*[\"']([^\"']*)[\"']", "([^\"'\\s]*)"]
  ],

  // Vue / Volar
  "[vue]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // JavaScript/TypeScript
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // Search
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/storage/framework": true,
    "**/.git": true,
    "**/bun.lockb": true
  },

  // Explorer
  "explorer.fileNesting.enabled": true,
  "explorer.fileNesting.patterns": {
    "*.ts": "${capture}.test.ts, ${capture}.spec.ts",
    "*.vue": "${capture}.test.ts, ${capture}.spec.ts",
    "package.json": "package-lock.json, bun.lockb, yarn.lock, pnpm-lock.yaml, .npmrc",
    "tsconfig.json": "tsconfig.*.json"
  }
}
```

### Launch Configuration

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Stacks App",
      "program": "${workspaceFolder}/buddy",
      "args": ["dev"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "bun",
      "request": "launch",
      "name": "Run Tests",
      "program": "${workspaceFolder}/buddy",
      "args": ["test"],
      "cwd": "${workspaceFolder}"
    },
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Current File",
      "program": "${file}",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Tasks Configuration

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "shell",
      "command": "bun run dev",
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "build",
      "type": "shell",
      "command": "bun run build",
      "problemMatcher": []
    },
    {
      "label": "test",
      "type": "shell",
      "command": "bun test",
      "problemMatcher": []
    },
    {
      "label": "lint",
      "type": "shell",
      "command": "bun run lint",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "typecheck",
      "type": "shell",
      "command": "bun run typecheck",
      "problemMatcher": ["$tsc"]
    }
  ]
}
```

### Snippets

Create `.vscode/stacks.code-snippets`:

```json
{
  "Stacks Action": {
    "prefix": "action",
    "body": [
      "import type { RequestInstance } from '@stacksjs/types'",
      "import { Action } from '@stacksjs/actions'",
      "import { response } from '@stacksjs/router'",
      "",
      "export default new Action({",
      "  name: '${1:ActionName}',",
      "  description: '${2:Description}',",
      "  method: '${3|GET,POST,PUT,PATCH,DELETE|}',",
      "",
      "  async handle(request: RequestInstance) {",
      "    $0",
      "    return response.json({ success: true })",
      "  },",
      "})"
    ],
    "description": "Create a Stacks action"
  },

  "Stacks Model": {
    "prefix": "model",
    "body": [
      "import { Model } from '@stacksjs/orm'",
      "",
      "export default new Model({",
      "  name: '${1:ModelName}',",
      "  table: '${2:table_name}',",
      "",
      "  fields: {",
      "    $0",
      "  },",
      "})"
    ],
    "description": "Create a Stacks model"
  },

  "Stacks Component": {
    "prefix": "component",
    "body": [
      "<script setup lang=\"ts\">",
      "import { ref } from 'vue'",
      "",
      "const ${1:state} = ref($2)",
      "$0",
      "</script>",
      "",
      "<template>",
      "  <div>",
      "    ",
      "  </div>",
      "</template>",
      "",
      "<style scoped>",
      "</style>"
    ],
    "description": "Create a Vue component"
  },

  "Stacks Test": {
    "prefix": "test",
    "body": [
      "import { describe, it, expect } from 'bun:test'",
      "",
      "describe('${1:TestName}', () => {",
      "  it('${2:should do something}', () => {",
      "    $0",
      "    expect(true).toBe(true)",
      "  })",
      "})"
    ],
    "description": "Create a test file"
  }
}
```

## Cursor Setup

Cursor uses VS Code settings, so apply the same configuration above. Additionally:

### AI Configuration

Create `.cursor/settings.json`:

```json
{
  "cursor.chat.model": "claude-3.5-sonnet",
  "cursor.contextMode": "normal",
  "cursor.cpp.disabledLanguages": [],
  "cursor.chat.systemPrompt": "You are helping develop a Stacks.js application. Stacks uses Bun as the runtime, Vue for components, and provides a full-stack TypeScript framework. Follow Stacks conventions and best practices."
}
```

### Cursor Rules

Create `.cursorrules`:

```
# Stacks Development Rules

## Technology Stack
- Runtime: Bun
- Framework: Stacks.js
- Language: TypeScript
- Frontend: Vue 3 with Composition API
- Styling: Tailwind CSS
- Database: SQLite/MySQL with custom ORM

## Conventions
- Use TypeScript for all code
- Prefer async/await over callbacks
- Use named exports
- Follow single-responsibility principle
- Keep functions small and focused

## File Structure
- Actions go in app/Actions/
- Models go in app/Models/
- Components go in resources/components/
- Tests go alongside source files with .test.ts extension

## Code Style
- 2 spaces for indentation
- Single quotes for strings
- No semicolons (except where required)
- Trailing commas in multiline
```

## WebStorm Setup

### Enable Bun Support

1. Go to **Settings > Languages & Frameworks > Node.js**
2. Set Node interpreter to Bun

### Configure ESLint

1. Go to **Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint**
2. Select "Automatic ESLint configuration"

### Configure Prettier

1. Go to **Settings > Languages & Frameworks > JavaScript > Prettier**
2. Enable "Run on save"

### File Watchers

Set up TypeScript compilation:

1. Go to **Settings > Tools > File Watchers**
2. Add TypeScript watcher with Bun

## Zed Setup

### Settings

Create `~/.config/zed/settings.json`:

```json
{
  "theme": "One Dark",
  "buffer_font_family": "JetBrains Mono",
  "buffer_font_size": 14,
  "format_on_save": "on",
  "languages": {
    "TypeScript": {
      "tab_size": 2,
      "formatter": "prettier"
    },
    "Vue": {
      "tab_size": 2,
      "formatter": "prettier"
    }
  },
  "lsp": {
    "typescript-language-server": {
      "initialization_options": {
        "preferences": {
          "importModuleSpecifierPreference": "relative"
        }
      }
    }
  }
}
```

## Common Configuration

### EditorConfig

Create `.editorconfig` in your project root:

```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
```

### Git Configuration

Create `.gitattributes`:

```
* text=auto eol=lf
*.{cmd,[cC][mM][dD]} text eol=crlf
*.{bat,[bB][aA][tT]} text eol=crlf
bun.lockb binary
```

## Keyboard Shortcuts

### Recommended VS Code Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Go to File | `Ctrl+P` | `Cmd+P` |
| Go to Symbol | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Find in Files | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Quick Fix | `Ctrl+.` | `Cmd+.` |
| Rename Symbol | `F2` | `F2` |
| Toggle Terminal | `` Ctrl+` `` | `` Cmd+` `` |
| Run Task | `Ctrl+Shift+B` | `Cmd+Shift+B` |
| Format Document | `Shift+Alt+F` | `Shift+Option+F` |

### Custom Keybindings

Add to `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+t",
    "command": "workbench.action.tasks.runTask",
    "args": "test"
  },
  {
    "key": "ctrl+shift+d",
    "command": "workbench.action.tasks.runTask",
    "args": "dev"
  }
]
```

## Troubleshooting

### TypeScript Errors Not Showing

1. Restart the TypeScript server: `Cmd/Ctrl+Shift+P` > "TypeScript: Restart TS Server"
2. Check that Volar is enabled and Take Over Mode is configured

### ESLint Not Working

1. Ensure ESLint extension is installed
2. Check that `eslint.config.js` exists in project root
3. Run `bun install` to ensure dependencies are installed

### Slow Performance

1. Exclude `node_modules` and `dist` from search
2. Disable unused extensions
3. Enable "files.watcherExclude" for large directories

This documentation covers setting up your IDE for Stacks development. Each configuration is designed for an optimal development experience.
