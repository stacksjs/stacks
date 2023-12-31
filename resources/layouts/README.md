## Layouts

Vue components in this dir are used as layouts.

By default, `default.stx` will be used unless an alternative is specified in the route meta.

With [`vite-plugin-pages`](https://github.com/hannoeru/vite-plugin-pages) and [`@stacksjs/vite-plugin-vue-layouts`](https://github.com/stacksjs/stacks/tree/main/storage/framework/stacks/src/vite-plugin-vue-layouts#readme), you can specify the layout in the page's SFCs like this:

```html
<route lang="yaml">
meta:
  layout: home
</route>
```
