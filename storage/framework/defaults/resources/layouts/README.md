# Layouts

STX layouts wrap pages with shared navigation, metadata, and structure.

`default.stx` is used when a page does not select another layout. A page can
choose a named layout with the STX layout directive:

```html
@layout('home')

<main>
  <h1>{{ title }}</h1>
</main>
```

Layouts live in this directory and use the same STX template syntax as pages
and components.
