import type { HeadwindOptions } from 'headwind'

export default {
  content: [
    './resources/**/*.{html,js,ts,jsx,tsx,stx}',
    './storage/framework/defaults/**/*.{html,js,ts,jsx,tsx,stx}',
    './storage/framework/views/**/*.{html,js,ts,jsx,tsx,stx}',
  ],
  output: './storage/framework/assets/headwind.css',
  minify: false,
} satisfies HeadwindOptions
