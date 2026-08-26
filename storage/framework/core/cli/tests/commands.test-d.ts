/**
 * Type-level assertions for the options a command handler receives.
 *
 * These never run: `bun run typecheck` failing is the assertion.
 */
import type { CommandOptionKey, InferCommandOptions } from '@stacksjs/types'
import { defineCommand } from '../src/commands'

type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

// Flag -> property name.
export type _Key1 = Expect<Equal<CommandOptionKey<'--dry-run'>, 'dryRun'>>
export type _Key2 = Expect<Equal<CommandOptionKey<'--project <id>'>, 'project'>>
export type _Key3 = Expect<Equal<CommandOptionKey<'--two, -t'>, 'two'>>
export type _Key4 = Expect<Equal<CommandOptionKey<'-t, --two'>, 'two'>>
export type _Key5 = Expect<Equal<CommandOptionKey<'--no-cache'>, 'cache'>>

// Flag -> value type.
type Options = InferCommandOptions<{
  '--dry-run': { description: 'x', default: false }
  '--project <id>': 'Restrict to one project'
  '--times <n>': { description: 'x', default: 1, type: [NumberConstructor] }
  '--tag [name]': 'Optional value'
  '--file <paths...>': 'Variadic'
  '--verbose, -v': { default: false }
}>

export type _Value1 = Expect<Equal<Options['dryRun'], boolean>>
export type _Value2 = Expect<Equal<Options['project'], string | undefined>>
export type _Value3 = Expect<Equal<Options['times'], number>>
export type _Value4 = Expect<Equal<Options['tag'], string | true | undefined>>
export type _Value5 = Expect<Equal<Options['file'], string[] | undefined>>
export type _Value6 = Expect<Equal<Options['verbose'], boolean>>

// The declarative form infers the handler's options from the flags above it.
export const declarative = defineCommand({
  name: 'archive:run <project>',
  description: 'Export aged log partitions',
  options: {
    '--dry-run': { description: 'Change nothing', default: false },
    '--day <YYYY-MM-DD>': 'Restrict the run to one UTC day',
  },
  handle(options, project) {
    const dryRun: boolean = options.dryRun
    const day: string | undefined = options.day
    const name: string = project

    return [dryRun, day, name]
  },
})

// The imperative form types the CLI it hands you.
export const imperative = defineCommand((cli) => {
  cli.command('inspire', 'Inspire yourself').alias('insp').action(() => {})
})
