import { resolve } from 'pathe'

const r = (p: string) => resolve(__dirname, p)

/**
 * The following configs determine the names of the packages, how they are distributed & accessed.
 */
export const alias: Record<string, string> = {
  '@ow3/hello-world-vue': r('../vue/src/'),
  '@ow3/hello-world-elements': r('../packages/elements/src/'),
  '@ow3/hello-world-composable': r('../packages/composables/src/'),
  '@ow3/vite-plugin-stacks': r('../packages/stacks/src/'),
}
