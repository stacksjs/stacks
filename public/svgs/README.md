# Error Illustrations

Four desert scenes, one per HTTP status they were drawn for:

| File | Scene |
| --- | --- |
| `403.svg` | A fortress keeping watch over moonlit dunes |
| `404.svg` | A lone camel on an endless ridge at dusk |
| `500.svg` | Footprints trailing off under a midday sun |
| `503.svg` | A domed village at twilight |

## Where they come from

Steve Schoger drew them for Laravel 5.7, which shipped them in `public/svg/` and
rendered them through the `errors::illustrated-layout` view. Laravel 5.8 moved
its error views onto the minimal layout and the artwork was dropped from the
framework. These files are that artwork, vendored under Laravel's MIT licence:
<https://github.com/laravel/laravel/tree/v5.7.0/public/svg>. Three of the four
have been through SVGO since; the drawings themselves are untouched.

## You probably do not need them

Stacks renders illustrated production error pages out of the box. The built-in
page inlines its own copy of these four scenes from `@stacksjs/error-handling`,
so it keeps working whether or not this directory exists.

Reach for the files here when you write your own error page. Anything you drop
at `resources/views/errors/<status>.html` (or `error.html` as a catch-all)
replaces the built-in page entirely, and `{{status}}`, `{{title}}` and
`{{message}}` are substituted into it:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{{status}} {{title}}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      .scene { height: 40vh; background: url("/svgs/404.svg") center / cover; }
      .copy { padding: 2rem; }
    </style>
  </head>
  <body>
    <div class="scene"></div>
    <div class="copy">
      <h1>{{title}}</h1>
      <p>{{message}}</p>
    </div>
  </body>
</html>
```

They are ordinary static assets, so they are equally usable anywhere else in
your app. `public/assets/images/coming-soon-dawn.svg` is `503.svg` recolored to
the Stacks blue palette, if you want a worked example.

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
