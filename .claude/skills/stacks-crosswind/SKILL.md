---
name: stacks-crosswind
description: Use when styling components in a Stacks application — utility-first CSS, Tailwind-like classes, responsive design, or CSS configuration. Crosswind is the default CSS framework for Stacks.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Crosswind CSS Framework

Crosswind is the default CSS framework for Stacks applications, providing Tailwind-like utility classes.

## Key Paths
- External tool: ~/Code/Tools/crosswind/
- Default styles: `storage/framework/defaults/styles/`

## Usage
Use standard utility classes in STX templates:
```html
<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 class="text-2xl font-bold text-gray-900">Title</h1>
</div>
```

## Features
- Tailwind-compatible utility classes
- Responsive design utilities
- Dark mode support
- Custom theme configuration
- PurgeCSS for production optimization

## Gotchas
- Crosswind is the DEFAULT — always use it for CSS in Stacks
- Utility classes work the same as Tailwind CSS
- Custom styles go in `storage/framework/defaults/styles/`
- Crosswind is integrated with the build system
