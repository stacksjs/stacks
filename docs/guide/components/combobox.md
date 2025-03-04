<Hero
  title="stacks/combobox"
  description="An opinionated combobox component for Stacks"
  link="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/combobox"
/>
<br>

# Install

::: code-group

```sh [npm]
npm install @stacksjs/combobox
```

```sh [bun]
bun install @stacksjs/combobox
# bun add @stacksjs/combobox
# bun i @stacksjs/combobox
```

```sh [pnpm]
pnpm add @stacksjs/combobox
# pnpm i @stacksjs/combobox
```

```sh [yarn]
yarn add @stacksjs/combobox
# yarn i -d @stacksjs/combobox
```

:::

<br>

# Usage

`Comboboxes` are built using the `Combobox`, `ComboboxInput`, `ComboboxOptions`, `ComboboxOption` and `ComboboxLabel` components.

The `ComboboxInput` will automatically open/close the `ComboboxOptions` when searching.

You are completely in charge of how you filter the results, whether it be with a fuzzy search library client-side or by making server-side requests to an API. In this example we will keep the logic simple for demo purposes.

```vue
<script lang="ts" setup>
 import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@stacksjs/combobox'
</script>

<template>
  <Combobox v-model="selectedPerson">
    <ComboboxInput @change="query = $event.target.value" />
    <ComboboxOptions>
      <ComboboxOption
        v-for="person in filteredPeople"
        :key="person"
        :value="person"
      >
        {{ person }}
      </ComboboxOption>
    </ComboboxOptions>
  </Combobox>
</template>
```

<br>

# Demo

<ComboboxDemo />

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<CommandPalette />`](./command-palette.md) component read more on the next page.
