export default {
  root: 'resources',
  pagesDir: 'views',
  componentsDir: 'views/components',
  layoutsDir: 'views/layouts',
  partialsDir: 'views/partials',

  app: {
    head: {
      title: 'Stacks',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Build modern web applications, APIs, and cloud infrastructure with an elegant, type-safe framework.' },
      ],
      links: [
        { rel: 'preconnect', href: 'https://fonts.bunny.net' },
        { rel: 'stylesheet', href: 'https://fonts.bunny.net/css?family=figtree:400,500,600,700' },
      ],
      bodyClass: 'min-h-screen font-sans antialiased bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400',
    },
  },

  router: {
    container: 'main',
  },

  strict: false,
}
