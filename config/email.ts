export const email = {
  // Email Tailwind config here
  build: {},
  maizzle: {
    build: {
      templates: {
        destination: {
          path: 'build_production',
        },
      },
    },
    inlineCSS: true,
    removeUnusedCSS: true,
  },
}
