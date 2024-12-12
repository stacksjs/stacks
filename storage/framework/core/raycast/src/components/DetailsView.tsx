import type { BuddyCommand } from '../types'
import { List } from '@raycast/api'

export function DetailsView({ command }: { command: BuddyCommand }) {
  return <List.Item.Detail markdown={buildMarkdown(command)} />
}

function buildMarkdown({ description, synopsis, options, arguments: args }: Partial<BuddyCommand>) {
  return `# Stacks Buddy
    \n ---
    \n ## Description
    \n - ${description}
    \n\n### Usage
    \n\`\`\`
    \n${synopsis}
    \n\`\`\`
    \n\n
    \n ${
      options?.length
        ? `## Options
      \n ---

          ${options
            ?.map(({ name, description }, i) => {
              const value = 'optional'
              const valueDescription = 'value optional'
              return `${i === 0 ? '\n' : ''}
      \n -- ${name}
      \n\`\`\`
      \n- ${value}, ${valueDescription}
      \n- ${description}
      \n\`\`\`\n`
            })
            .join('')}`
        : ''
    }

    \n ${
      args?.length
        ? `## Arguments
    \n ---

        ${args
          ?.map(({ name, description, value_required }, i) => {
            const value = value_required ? 'required' : 'optional'
            const valueDescription = 'value optional'
            return `${i === 0 ? '\n' : ''}
    \n <${name}>
    \n\`\`\`
    \n- ${value}, ${valueDescription}
    \n- ${description}
    \n\`\`\`\n`
          })
          .join('')}`
        : ''
    }`
}
