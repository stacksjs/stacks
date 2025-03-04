<Hero
  title="stacks/dialog"
  description="An simple, minimal, yet powerful, dialog component."
  link="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/dialog"
/>
<br>

# Install

::: code-group

```sh [npm]
npm install @stacksjs/dialog
```

```sh [bun]
bun install @stacksjs/dialog
# bun add @stacksjs/dialog
# bun i @stacksjs/dialog
```

```sh [pnpm]
pnpm add @stacksjs/dialog
# pnpm i @stacksjs/dialog
```

```sh [yarn]
yarn add @stacksjs/dialog
# yarn i -d @stacksjs/dialog
```

:::
<br>

# Usage

```vue
<!-- App.vue -->
<script lang="ts" setup>
import { Dialog, DialogPanel } from '@stacksjs/dialog'

const visible = ref(false)

const handleClose = () => {
  visible.value = false
}
</script>

<template>
  <Transition name="fade" appear>
    <Dialog v-if="visible" @close="handleClose">
      <DialogPanel as="div">
        <h2>Greetings! This is a dialog.</h2>
      </DialogPanel>
    </Dialog>
  </Transition>

  <button @click="visible = true">
    Open Dialog
  </button>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

<br>

# Demo

<DialogDemo />

<br>

Still have questions relating this component’s usage? Contact us and we will help you out. In the meantime, if you are curious about the [`<Dropdown />`](./dropdown.md) component read more on the next page.
