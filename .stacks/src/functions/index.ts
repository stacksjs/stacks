// export * from './any-other-composable'
// export * from '~/functions/dark'
// export * from '~/functions/hello-world'

const modules = import.meta.glob('../../../functions/*.ts', { as: 'raw' })

// eslint-disable-next-line no-console
console.log('modules', modules)

for (const path in modules) {
  modules[path]().then((mod) => {
    // eslint-disable-next-line no-console
    console.log(path, mod)
  })
}

export default modules
