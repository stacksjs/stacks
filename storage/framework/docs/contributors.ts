import contributors from './contributors.json'

export interface Contributor {
  name: string
  avatar: string
}

export interface CoreTeam {
  avatar: string
  name: string
  github: string
  twitter?: string
  bluesky?: string
  sponsors?: boolean
  description: string
  packages?: string[]
  functions?: string[]
}

const contributorsAvatars: Record<string, string> = {}

function getAvatarUrl(name: string) {
  return `https://avatars.githubusercontent.com/${name}?v=4`
}

const contributorList = (contributors as string[]).reduce((acc, name) => {
  contributorsAvatars[name] = getAvatarUrl(name)
  acc.push({ name, avatar: contributorsAvatars[name] })
  return acc
}, [] as Contributor[])

const coreTeamMembers: CoreTeam[] = [
  {
    avatar: contributorsAvatars.chrisbbreuer || 'default-avatar.png',
    name: 'Chris Breuer',
    github: 'chrisbbreuer',
    twitter: 'chrisbbreuer',
    bluesky: 'chrisbreuer.dev',
    sponsors: true,
    description: 'Open sourceror<br>Core team member of Stacks<br>Working at Stacks.js, Inc.',
    packages: ['core'],
    functions: ['cloud', 'backend', 'frontend', 'ci/cd'],
  },

  {
    avatar: contributorsAvatars.glennmichael123 || 'default-avatar.png',
    name: 'Glenn',
    github: 'glennmichael123',
    twitter: 'glennmichael123',
    sponsors: false,
    packages: ['core'],
    functions: ['backend', 'frontend', 'desktop'],
    description: 'A collaborative being<br>Core team member of Stacks, working at Stacks.js, Inc.',
  },

  {
    avatar: contributorsAvatars['cab-mikee'] || 'default-avatar.png',
    name: 'Mike',
    github: 'cab-mikee',
    twitter: 'cab-mikee',
    sponsors: false,
    description: 'A collaborative being<br>Core team member of Stacks, working at Stacks.js, Inc.',
    packages: ['core'],
    functions: ['backend', 'frontend'],
  },

  {
    avatar: contributorsAvatars.konkonam || 'default-avatar.png',
    name: 'Zoltan',
    github: 'konkonam',
    sponsors: true,
    description: 'Open sourceror<br>Core team member of Stacks.',
    packages: ['core'],
    functions: ['backend', 'frontend', 'desktop'],
  },
]
  .sort((pre, cur) => contributors.findIndex(name => name === pre.github) - contributors.findIndex(name => name === cur.github))

export { contributorList as contributors, coreTeamMembers }
