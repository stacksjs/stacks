import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import fg from 'fast-glob'
import MarkdownIt from 'markdown-it'
import { type ComponentMeta, type MetaCheckerOptions, createComponentMetaChecker } from 'vue-component-meta'
import { frameworkPath, join, parse, projectPath } from '@stacksjs/paths'

const md = new MarkdownIt()

/**
 * ℹ️ Useful links
 *
 * vue-component-meta tests: https://github.com/johnsoncodehk/volar/blob/master/vue-language-tools/vue-component-meta/tests/index.spec.ts
 * Discord thread about improving vue-component-meta: https://discord.com/channels/793943652350427136/1027819645677350912
 * GitHub issue for improving vue-component-meta based on runtime/dynamic props: https://github.com/johnsoncodehk/volar/issues/1854
 * Discord chat: https://discord.com/channels/793943652350427136/1027819645677350912
 * original script: https://raw.githubusercontent.com/jd-solanki/anu/main/scripts/gen-component-meta.ts
 */

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

export async function generateComponentMeta() {
  const checkerOptions: MetaCheckerOptions = {
    forceUseTs: true,
    schema: { ignore: ['MyIgnoredNestedProps'] },
    printer: { newLine: 1 },
  }

  const tsconfigChecker = createComponentMetaChecker(
    projectPath('tsconfig.json'),
    checkerOptions,
  )

  const filterMeta = (meta: ComponentMeta): ComponentApi => {
  // const clonedMeta: ComponentMeta = JSON.parse(JSON.stringify(meta))

    // Exclude global props
    const props: ComponentApiProps[] = []
    meta.props.forEach((prop: any) => {
      if (prop.global)
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

  const components = fg.sync(['components/*.vue', 'components/**/*.vue'], {
    cwd: projectPath(),
    absolute: true,
  })

  components.forEach((componentPath) => {
    // Thanks: https://futurestud.io/tutorials/node-js-get-a-file-name-with-or-without-extension
    const componentExportName = parse(componentPath).name
    const meta = filterMeta(tsconfigChecker.getComponentMeta(componentPath, componentExportName))

    const metaDirPath = frameworkPath('component-meta')

    // if meta dir doesn't exist create
    if (!existsSync(metaDirPath))
      mkdirSync(metaDirPath)

    const metaJsonFilePath = join(metaDirPath, `${componentExportName}.json`)
    writeFileSync(metaJsonFilePath, JSON.stringify(meta, null, 4))
  })
}
