---
outline: deep
---
<pre>{{ page }}</pre>

### Page Frontmatter

<pre>{{ frontmatter }}</pre>

```

<script setup>
import { useData } from '@stacksjs/docs' // wip

const { site, theme, page, frontmatter } = useData()
</script>

## Results

### Theme Data

<pre>{{ theme }}</pre>

### Page Data

<pre>{{ page }}</pre>

### Page Frontmatter

<pre>{{ frontmatter }}</pre>

## More

Check out the documentation for the [full list of runtime APIs](https://vitepress.dev/reference/runtime-api#usedata).
