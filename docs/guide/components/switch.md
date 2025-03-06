# Switch

A modern, accessible toggle switch component for Vue applications.

<SwitchDemo />

## Features

- 🎯 Fully accessible (WAI-ARIA compliant)
- 🌐 Keyboard navigation support
- 🎨 Customizable styling
- 📱 Mobile-friendly
- 🎯 TypeScript support

<br>

## Install

::: code-group

```sh [npm]
npm install @stacksjs/switch
```

```sh [bun]
bun install @stacksjs/switch
# bun add @stacksjs/switch
# bun i @stacksjs/switch
```

```sh [pnpm]
pnpm add @stacksjs/switch
# pnpm i @stacksjs/switch
```

```sh [yarn]
yarn add @stacksjs/switch
# yarn i -d @stacksjs/switch
```

:::
<br>

## Usage

The switch component is simple to use and highly customizable:

```vue
<script setup>
import { ref } from 'vue'
import { Switch, SwitchLabel, SwitchGroup } from '@stacksjs/switch'

const enabled = ref(false)
</script>

<template>
  <SwitchGroup>
    <SwitchLabel>Enable notifications</SwitchLabel>
    <Switch
      v-model="enabled"
      :class="[
        enabled ? 'bg-blue-600' : 'bg-gray-200',
        'relative inline-flex h-6 w-11 items-center rounded-full'
      ]"
    >
      <span
        :class="[
          enabled ? 'translate-x-6' : 'translate-x-1',
          'inline-block h-4 w-4 transform rounded-full bg-white transition'
        ]"
      />
    </Switch>
  </SwitchGroup>
</template>
```

## API Reference

### Switch

The main switch component.

#### Props

- `v-model` - (boolean) The switch state
- `disabled` - (boolean) Whether the switch is disabled
- `as` - (string) The element to render as (default: 'button')

### SwitchGroup

A wrapper component for grouping the switch with its label.

#### Props

- `as` - (string) The element to render as (default: 'div')

### SwitchLabel

The label component for the switch.

#### Props

- `as` - (string) The element to render as (default: 'label')
- `passive` - (boolean) If true, clicking the label won't toggle the switch

## Styling

The switch component can be styled using standard CSS classes. Each component accepts standard HTML attributes including `class` and `style`.

For dynamic styling based on state, use the v-model value:

```vue
<Switch
  v-model="enabled"
  :class="[
    enabled ? 'bg-blue-600' : 'bg-gray-200',
    'relative inline-flex h-6 w-11 items-center rounded-full'
  ]"
>
  <span
    :class="[
      enabled ? 'translate-x-6' : 'translate-x-1',
      'inline-block h-4 w-4 transform rounded-full bg-white transition'
    ]"
  />
</Switch>
```

## Accessibility

The switch component follows WAI-ARIA guidelines and includes the following features:

- Role="switch" automatically applied
- Proper ARIA attributes (aria-checked, aria-labelledby)
- Keyboard navigation support (Space to toggle)
- Focus management

## TypeScript Support

The switch component includes full TypeScript support:

```ts
import { ref } from 'vue'

const enabled = ref<boolean>(false)
```

Still have questions relating this component's usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Popover />`](./popover.md) component read more on the next page.
