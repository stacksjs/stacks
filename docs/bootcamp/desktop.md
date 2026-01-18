# Build a Desktop App

This tutorial will guide you through building desktop applications with Stacks. Using Tauri integration, you can package your web application as a native desktop app for Windows, macOS, and Linux.

## Overview

Stacks desktop apps are powered by Tauri, which provides:

- **Small Bundle Size** - Native binaries, not Electron
- **Cross-Platform** - Windows, macOS, and Linux from a single codebase
- **Native Features** - System tray, file dialogs, notifications, and more
- **Security** - Rust-powered backend with strict sandboxing
- **Web Frontend** - Use your existing Stacks frontend

## Prerequisites

Before building desktop apps, install the Tauri CLI:

```bash
# Install Tauri CLI
bun add -D @tauri-apps/cli

# Verify installation
bunx tauri --version
```

You will also need Rust installed for building the native binary:

```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows (download installer from rustup.rs)
```

## Project Setup

### Initialize Tauri

Initialize Tauri in your Stacks project:

```bash
buddy desktop:init
# Or manually:
bunx tauri init
```

This creates the following structure:

```
src-tauri/
├── Cargo.toml          # Rust dependencies
├── build.rs            # Build script
├── icons/              # App icons
├── src/
│   └── main.rs         # Rust entry point
└── tauri.conf.json     # Tauri configuration
```

### Configuration

Configure your desktop app in `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeBuildCommand": "buddy build",
    "beforeDevCommand": "buddy dev",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "My App",
    "version": "1.0.0"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "identifier": "com.example.myapp",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "targets": "all",
      "category": "Productivity",
      "shortDescription": "My awesome desktop app",
      "longDescription": "A longer description of my app and its features."
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "title": "My App",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ],
    "allowlist": {
      "all": false,
      "shell": {
        "open": true
      },
      "dialog": {
        "all": true
      },
      "fs": {
        "all": true,
        "scope": ["$APP/*", "$DOCUMENT/*"]
      },
      "notification": {
        "all": true
      },
      "clipboard": {
        "all": true
      }
    }
  }
}
```

## Window Management

### Opening Windows

Create and manage windows programmatically:

```typescript
// resources/functions/desktop.ts
import { WebviewWindow } from '@tauri-apps/api/window'

// Create a new window
export async function openSettingsWindow() {
  const settingsWindow = new WebviewWindow('settings', {
    url: '/settings',
    title: 'Settings',
    width: 600,
    height: 400,
    center: true,
    resizable: false,
  })

  // Listen for window events
  settingsWindow.once('tauri://created', () => {
    console.log('Settings window created')
  })

  settingsWindow.once('tauri://error', (e) => {
    console.error('Failed to create window:', e)
  })
}
```

### Window Controls

Control the current window:

```typescript
import { appWindow } from '@tauri-apps/api/window'

// Minimize
await appWindow.minimize()

// Maximize
await appWindow.maximize()

// Toggle fullscreen
await appWindow.toggleMaximize()

// Close
await appWindow.close()

// Hide
await appWindow.hide()

// Show
await appWindow.show()

// Set title
await appWindow.setTitle('New Title')

// Center window
await appWindow.center()

// Set size
await appWindow.setSize({ width: 800, height: 600 })

// Set position
await appWindow.setPosition({ x: 100, y: 100 })

// Set always on top
await appWindow.setAlwaysOnTop(true)
```

### Custom Titlebar

Create a custom titlebar for a frameless window:

```typescript
// tauri.conf.json
{
  "tauri": {
    "windows": [{
      "decorations": false,  // Remove native titlebar
      "transparent": true
    }]
  }
}
```

```html
<!-- resources/components/Titlebar.stx -->
<script server>
import { appWindow } from '@tauri-apps/api/window'

async function minimize() {
  await appWindow.minimize()
}

async function toggleMaximize() {
  await appWindow.toggleMaximize()
}

async function close() {
  await appWindow.close()
}
</script>

<div
  data-tauri-drag-region
  class="h-8 bg-gray-100 dark:bg-gray-800 flex items-center justify-between px-4"
>
  <div class="text-sm font-medium">My App</div>

  <div class="flex gap-2">
    <button onclick="minimize()" class="hover:bg-gray-200 p-1 rounded">
      <i class="i-hugeicons-outline-minus h-4 w-4"></i>
    </button>
    <button onclick="toggleMaximize()" class="hover:bg-gray-200 p-1 rounded">
      <i class="i-hugeicons-outline-square h-4 w-4"></i>
    </button>
    <button onclick="close()" class="hover:bg-red-500 hover:text-white p-1 rounded">
      <i class="i-hugeicons-outline-x h-4 w-4"></i>
    </button>
  </div>
</div>
```

## System Tray

Add a system tray icon for background apps:

### Configuration

```json
// tauri.conf.json
{
  "tauri": {
    "systemTray": {
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true
    },
    "allowlist": {
      "systemTray": {
        "all": true
      }
    }
  }
}
```

### Rust Implementation

```rust
// src-tauri/src/main.rs
use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    let show = CustomMenuItem::new("show".to_string(), "Show");

    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(hide)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "hide" => {
                    let window = app.get_window("main").unwrap();
                    window.hide().unwrap();
                }
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                }
                _ => {}
            },
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Native Features

### File System Access

Access the file system securely:

```typescript
import { open, save } from '@tauri-apps/api/dialog'
import { readTextFile, writeTextFile, readDir } from '@tauri-apps/api/fs'

// Open file dialog
export async function openFile() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Text Files',
      extensions: ['txt', 'md', 'json'],
    }],
  })

  if (selected) {
    const content = await readTextFile(selected as string)
    return content
  }
}

// Save file dialog
export async function saveFile(content: string) {
  const filePath = await save({
    filters: [{
      name: 'Text Files',
      extensions: ['txt'],
    }],
  })

  if (filePath) {
    await writeTextFile(filePath, content)
  }
}

// Read directory
export async function listFiles(path: string) {
  const entries = await readDir(path)
  return entries
}
```

### Notifications

Show system notifications:

```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/api/notification'

export async function notify(title: string, body: string) {
  let permissionGranted = await isPermissionGranted()

  if (!permissionGranted) {
    const permission = await requestPermission()
    permissionGranted = permission === 'granted'
  }

  if (permissionGranted) {
    sendNotification({ title, body })
  }
}
```

### Clipboard

Access the system clipboard:

```typescript
import { writeText, readText } from '@tauri-apps/api/clipboard'

// Copy to clipboard
export async function copyToClipboard(text: string) {
  await writeText(text)
}

// Read from clipboard
export async function pasteFromClipboard() {
  const text = await readText()
  return text
}
```

### Shell Commands

Execute shell commands:

```typescript
import { Command } from '@tauri-apps/api/shell'

// Run a command
export async function runCommand(command: string, args: string[]) {
  const cmd = new Command(command, args)

  cmd.on('close', (data) => {
    console.log(`Command finished with code ${data.code}`)
  })

  cmd.on('error', (error) => {
    console.error(`Command error: ${error}`)
  })

  cmd.stdout.on('data', (line) => {
    console.log(`stdout: ${line}`)
  })

  const child = await cmd.spawn()
  return child
}
```

### Global Shortcuts

Register global keyboard shortcuts:

```typescript
import { register, unregister } from '@tauri-apps/api/globalShortcut'

// Register a shortcut
export async function registerShortcuts() {
  await register('CommandOrControl+Shift+C', () => {
    console.log('Shortcut triggered!')
    // Show your app window
  })
}

// Unregister
export async function unregisterShortcuts() {
  await unregister('CommandOrControl+Shift+C')
}
```

## Communication Between Frontend and Backend

### Invoke Rust Commands

Call Rust functions from your frontend:

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// Frontend
import { invoke } from '@tauri-apps/api/tauri'

// Call the Rust function
const greeting = await invoke('greet', { name: 'World' })
console.log(greeting) // "Hello, World!"

// Call async Rust function
try {
  const content = await invoke('read_file', { path: '/path/to/file.txt' })
  console.log(content)
} catch (error) {
  console.error('Failed to read file:', error)
}
```

### Events

Send events between frontend and backend:

```rust
// Emit event from Rust
#[tauri::command]
fn start_processing(window: tauri::Window) {
    std::thread::spawn(move || {
        for i in 0..100 {
            window.emit("progress", i).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        window.emit("complete", "Done!").unwrap();
    });
}
```

```typescript
// Listen for events in frontend
import { listen } from '@tauri-apps/api/event'

const unlistenProgress = await listen('progress', (event) => {
  console.log(`Progress: ${event.payload}%`)
})

const unlistenComplete = await listen('complete', (event) => {
  console.log(`Completed: ${event.payload}`)
  unlistenProgress()
  unlistenComplete()
})
```

## Development and Building

### Development Mode

Run the desktop app in development:

```bash
buddy desktop:dev
# Or:
bunx tauri dev
```

This starts the Stacks dev server and opens the app in a native window.

### Building for Production

Build distributable binaries:

```bash
buddy desktop:build
# Or:
bunx tauri build
```

Build outputs are placed in `src-tauri/target/release/bundle/`:

- **macOS**: `.app` bundle and `.dmg` installer
- **Windows**: `.exe` and `.msi` installer
- **Linux**: `.deb`, `.AppImage`, and `.rpm`

### Platform-Specific Builds

Build for specific platforms:

```bash
# macOS
bunx tauri build --target universal-apple-darwin

# Windows (from macOS/Linux requires cross-compilation setup)
bunx tauri build --target x86_64-pc-windows-msvc

# Linux
bunx tauri build --target x86_64-unknown-linux-gnu
```

## Auto-Updates

Enable automatic updates for your desktop app:

### Configuration

```json
// tauri.conf.json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.example.com/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

### Check for Updates

```typescript
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { relaunch } from '@tauri-apps/api/process'

export async function checkForUpdates() {
  try {
    const { shouldUpdate, manifest } = await checkUpdate()

    if (shouldUpdate) {
      console.log(`Update available: ${manifest?.version}`)

      // Install the update
      await installUpdate()

      // Restart the app
      await relaunch()
    }
  } catch (error) {
    console.error('Update check failed:', error)
  }
}
```

## Complete Example: Note-Taking App

Here is a complete example combining multiple features:

```html
<!-- resources/views/notes.stx -->
<script server>
import { ref } from '@stacksjs/reactivity'
import { open, save } from '@tauri-apps/api/dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { sendNotification } from '@tauri-apps/api/notification'

const content = ref('')
const currentFile = ref('')
const isDirty = ref(false)

async function openNote() {
  const selected = await open({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })

  if (selected) {
    content.value = await readTextFile(selected as string)
    currentFile.value = selected as string
    isDirty.value = false
  }
}

async function saveNote() {
  let path = currentFile.value

  if (!path) {
    path = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    }) as string
  }

  if (path) {
    await writeTextFile(path, content.value)
    currentFile.value = path
    isDirty.value = false
    sendNotification({ title: 'Saved', body: 'Note saved successfully!' })
  }
}

function handleInput(e: Event) {
  content.value = (e.target as HTMLTextAreaElement).value
  isDirty.value = true
}
</script>

<div class="h-screen flex flex-col">
  <!-- Toolbar -->
  <div class="h-12 bg-gray-100 dark:bg-gray-800 flex items-center px-4 gap-4 border-b">
    <button
      onclick="openNote()"
      class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Open
    </button>
    <button
      onclick="saveNote()"
      class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
    >
      Save
    </button>

    @if(currentFile.value)
      <span class="text-sm text-gray-600">
        {{ currentFile.value }}
        @if(isDirty.value)
          <span class="text-orange-500">*</span>
        @endif
      </span>
    @endif
  </div>

  <!-- Editor -->
  <textarea
    value="{{ content.value }}"
    oninput="handleInput(event)"
    class="flex-1 p-4 font-mono text-sm resize-none focus:outline-none dark:bg-gray-900 dark:text-white"
    placeholder="Start writing..."
  ></textarea>
</div>
```

## Next Steps

Now that you know how to build desktop apps, continue to:

- [Authentication How-To](/bootcamp/how-to/authentication) - Add user authentication
- [Testing How-To](/bootcamp/how-to/testing) - Test your desktop app
- [Deployment How-To](/bootcamp/how-to/deploy) - Distribute your app

## Related Documentation

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri API Reference](https://tauri.app/v1/api/js/)
