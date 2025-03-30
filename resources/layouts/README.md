## Layouts

Vue components in this dir are used as layouts.

By default, `default.stx` will be used unless an alternative is specified in the route meta.

With [`unplugin-vue-router`](https://github.com/posva/unplugin-vue-router) and [`vite-plugin-layouts`](https://github.com/stacksjs/vite-plugin-layouts), you can specify the layout in the page's SFCs like this:

```html
<route lang="yaml">
meta:
  layout: home
</route>
```
