/**
 * The numbers the home page quotes about what ships in the box.
 *
 * Each one is a floor, not a live count: the page says "650+ actions", and
 * tests/unit/marketing-stats.test.ts counts the real tree and fails if any
 * floor is ever higher than what is actually there. A floor survives the next
 * action being added without anyone touching this file; an exact count would
 * be wrong by the following commit. The page used to claim "140-plus skills"
 * when 115 existed, which is exactly the drift the test is for.
 */

export interface Stat {
  /** What the page prints, e.g. `100+`. */
  value: string
  label: string
  /** The floor the test checks the tree against. */
  floor: number
  /** Directory the test counts in, relative to the project root. */
  countIn: string
  /** File name the test counts: a suffix like `.ts`, or an exact name. */
  match: string
}

export const stats: Stat[] = [
  {
    value: '100+',
    label: 'built-in models, from users to orders to campaigns',
    floor: 100,
    countIn: 'storage/framework/defaults/app/Models',
    match: '.ts',
  },
  {
    value: '650+',
    label: 'ready-made actions you can call, override, or route to',
    floor: 650,
    countIn: 'storage/framework/defaults/app/Actions',
    match: '.ts',
  },
  {
    value: '110+',
    label: 'agent skills, one for each subsystem',
    floor: 110,
    countIn: 'storage/framework/defaults/ai/skills',
    match: 'SKILL.md',
  },
  {
    value: '50+',
    label: 'typed config files, every one optional',
    floor: 50,
    countIn: 'config',
    match: '.ts',
  },
]
