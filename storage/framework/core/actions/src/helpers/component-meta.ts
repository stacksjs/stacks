import type { ComponentMeta, MetaCheckerOptions } from 'vue-component-meta'
import { frameworkPath, join, path, projectPath } from '@stacksjs/path'
import { existsSync, globSync, mkdirSync, writeFileSync } from '@stacksjs/storage'
import MarkdownIt from 'markdown-it'
import { createComponentMetaChecker } from 'vue-component-meta'

/**
 * ℹ️ Useful Links
 *
 * vue-component-meta tests: https://github.com/vuejs/language-tools/tree/master/packages/component-meta/tests/index.spec.ts
 * Discord thread about improving vue-component-meta: https://discord.com/channels/793943652350427136/1027819645677350912
 * GitHub issue for improving vue-component-meta based on runtime/dynamic props: https://github.com/johnsoncodehk/volar/issues/1854
 * Discord chat: https://discord.com/channels/793943652350427136/1027819645677350912
 * original script: https://raw.githubusercontent.com/jd-solanki/anu/main/scripts/gen-component-meta.ts
 */

export function generateComponentMeta(): void {
  const md = new MarkdownIt()
  const checkerOptions: MetaCheckerOptions = {
    forceUseTs: true,
    schema: { ignore: ['MyIgnoredNestedProps'] },
    printer: { newLine: 1 },
  }

  const tsconfigChecker = createComponentMetaChecker(projectPath('tsconfig.json'), checkerOptions)

  const filterMeta = (meta: ComponentMeta): ComponentApi => {
    // const clonedMeta: ComponentMeta = JSON.parse(JSON.stringify(meta))

    // Exclude global props
    const props: ComponentApiProps[] = []
    meta.props.forEach((prop) => {
      if (prop?.global)
        return

      const { name, description, required, type, default: defaultValue } = prop

      props.push({
        name: `${name}${required ? '' : '?'}`,
        description: md.render(description),

        // required,

        type,
        default: defaultValue || 'unknown',
      })
    })

    return {
      props,
      events: meta.events,
      slots: meta.slots,
    }
  }

  const components = globSync(['components/*.stx', 'components/**/*.stx', 'components/*.vue', 'components/**/*.vue'], {
    cwd: projectPath(),
    absolute: true,
  })

  components.forEach((componentPath: string) => {
    // Thanks: https://futurestud.io/tutorials/node-js-get-a-file-name-with-or-without-extension
    const componentExportName = path.parse(componentPath).name
    const meta = filterMeta(tsconfigChecker.getComponentMeta(componentPath, componentExportName))

    const metaDirPath = frameworkPath('component-meta')

    // if meta dir doesn't exist create

    if (!existsSync(metaDirPath))
      mkdirSync(metaDirPath)

    const metaJsonFilePath = join(metaDirPath, `${componentExportName}.json`)
    writeFileSync(metaJsonFilePath, JSON.stringify(meta, null, 4))
  })
}

export interface ComponentApiProps {
  name: ComponentMeta['props'][number]['name']
  description: ComponentMeta['props'][number]['description']

  // required: ComponentMeta['props'][number]['required']
  type: ComponentMeta['props'][number]['type']
  default: ComponentMeta['props'][number]['default']
}

export interface ComponentApi {
  props: ComponentApiProps[]
  events: ComponentMeta['events']
  slots: ComponentMeta['slots']
}
