export type Registry = {
  name: string
  url: string
  github: string
  // bitbucket: string
  // gitlab: string
}[]

export const registry: Registry = [
  {
    name: 'stacks',
    url: 'stacksjs.com',
    github: 'stacksjs/stacks',
    // bitbucket: 'stacksjs/stacks',
    // gitlab: 'stacksjs/stacks'
  },
]

export default registry
