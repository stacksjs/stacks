// noinspection ES6PreferShortImport: IntelliJ IDE hint to avoid warning to use `~/contributors`, will fail on build if changed

/* Texts */
// export const stacksName = 'Stacks'
// export const stacksShortName = 'Stacks'
// export const stacksDescription = 'Rapid application, cloud & library development framework'

/* CDN fonts and styles */
export const googleapis = 'https://fonts.googleapis.com'
export const gstatic = 'https://fonts.gstatic.com'
export const font = `${googleapis}/css2?family=Readex+Pro:wght@200;400;600&display=swap`

/* vitepress head */
export const ogUrl = 'https://stacksjs.org/'
export const ogImage = `${ogUrl}og.png`

/* GitHub and social links */
export const github = 'https://github.com/stacksjs/stacks'
export const releases = 'https://github.com/stacksjs/stacks/releases'
export const contributing = 'https://github.com/stacksjs/stacks/blob/main/CONTRIBUTING.md'
export const discord = 'https://chat.stacksjs.org'
export const twitter = 'https://twitter.com/stacksjs'

/* Avatar/Image/Sponsors servers */
export const preconnectLinks = [googleapis, gstatic]
export const preconnectHomeLinks = [googleapis, gstatic]

/* PWA runtime caching urlPattern regular expressions */
export const pwaFontsRegex = new RegExp(`^${googleapis}/.*`, 'i')
export const pwaFontStylesRegex = new RegExp(`^${gstatic}/.*`, 'i')
export const githubusercontentRegex = /^https:\/\/((i.ibb.co)|((raw|user-images).githubusercontent.com))\/.*/i
