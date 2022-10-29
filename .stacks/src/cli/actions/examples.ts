import { prompts as Prompts, consola } from '@stacksjs/cli'
import { hasComponents } from '@stacksjs/storage'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, NpmScript } from '@stacksjs/types'

const { prompts } = Prompts

export async function invoke(options: any) {
  if (options.components || options === 'components' || options === 'vue') {
    await componentExample()
  }

  else if (options.webComponents || options.elements || options === 'web-components' || options === 'elements') {
    await webComponentExample()
  }

  else {
    const answer = await prompts.select({
      type: 'select',
      name: 'example',
      message: 'Which example are you trying to view?',
      choices: [
        { title: 'Components', value: 'components' },
        { title: 'Web Components', value: 'web-components' },
      ],
      initial: 0,
    })

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'components')
      await componentExample()

    // @ts-expect-error the answer object type expects to return a void type but it returns a string
    if (answer === 'web-components')
      await webComponentExample()

    else process.exit(ExitCode.InvalidArgument)
  }
}

export async function componentExample() {
  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.ExampleVue)
      consola.success('Your component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}

export async function webComponentExample() {
  consola.info('Building your Web Component library...')

  if (hasComponents()) {
    try {
      await runNpmScript(NpmScript.BuildWebComponents)
      consola.success('Your Web Component library was built successfully.')
    }
    catch (error) {
      consola.error('There was an error building your Web Component library.')
      consola.error(error)
    }
  }
  else {
    consola.info('No components found.')
  }
}
