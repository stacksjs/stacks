<Hero
  title="stacks/dropdown"
  description="An opinionated dropdown component for Stacks"
  link="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/dropdown"
/>
<br>

# Install

::: code-group

```sh [npm]
npm install @stacksjs/dropdown
```

```sh [bun]
bun install @stacksjs/dropdown
# bun add @stacksjs/dropdown
# bun i @stacksjs/dropdown
```

```sh [pnpm]
pnpm add @stacksjs/dropdown
# pnpm i @stacksjs/dropdown
```

```sh [yarn]
yarn add @stacksjs/dropdown
# yarn i -d @stacksjs/dropdown
```

:::

<br>

# Usage

```vue
<!-- App.vue -->
<script lang="ts" setup>
 import { Menu, MenuButton, MenuItems, MenuItem } from '@stacksjs/dropdown'
</script>

<template>
 <!-- ... -->
  <Dropdown>
    <DropdownButton>Dropdown</DropdownButton>
    <DropdownItems>
      <DropdownItem v-slot="{ active }">
        <a :class='{ "bg-blue-500": active }' href="/account-settings">
          Account settings
        </a>
      </DropdownItem>
      <DropdownItem v-slot="{ active }">
        <a :class='{ "bg-blue-500": active }' href="/account-settings">
          Documentation
        </a>
      </DropdownItem>
      <DropdownItem disabled>
        <span class="opacity-75">Invite a friend (coming soon!)</span>
      </DropdownItem>
    </DropdownItems>
  </Dropdown>
</template>
```

<br>

# Demo

<DropdownDemo />

<br>

Still have questions relating this component’s usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Listbox />`](./listbox.md) component read more on the next page.
