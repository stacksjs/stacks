# Markdown Extension Examples

This page demonstrates the built-in Markdown extensions provided by BunPress.

## Syntax Highlighting

BunPress provides syntax highlighting powered by [Shiki](https://github.com/shikijs/shiki), with additional features such as line highlighting:

**Input**

````md
```js{4}

export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}

```
````

**Output**

```js{4}
<script server>
const message = 'Highlighted!'
</script>

<template>
  <p>{{ message }}</p>
</template>
```

## Custom Containers

**Input**

```md
::: info
This is an info box.
:::

::: tip
This is a tip.
:::

::: warning
This is a warning.
:::

::: danger
This is a dangerous warning.
:::

::: details
This is a details block.
:::
```

**Output**

::: info
This is an info box.
:::

::: tip
This is a tip.
:::

::: warning
This is a warning.
:::

::: danger
This is a dangerous warning.
:::

::: details
This is a details block.
:::

## More

See the [BunPress markdown extensions reference](https://github.com/stacksjs/bunpress/blob/main/docs/markdown-extensions.md) for the complete syntax.
