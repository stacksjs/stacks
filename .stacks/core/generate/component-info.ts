import consola from 'consola'

export async function generateComponentInfo() {
  consola.info('Generating your component info...')

  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path,
      data: `packages:
  - ./.stacks/vue-components
  - ./.stacks/web-components
  - ./.stacks/functions
  - ./.stacks
  - './apps/**'
  - ./
`,
    })

    consola.success(`Created the ${type} package.json.`)
  }
  catch (err) {
    consola.error(err)
  }
}
