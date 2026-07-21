# Components

Create reusable STX components in this directory. Components are discovered by
the STX build pipeline and can be used directly from pages and other templates.

```html
<script server lang="ts">
const props = defineProps<{ name: string }>()
</script>

<template>
  <p>Hello, {{ props.name }}.</p>
</template>
```

Run `buddy dev:components` while developing the component library and
`buddy build:components` to produce its distributable output.
