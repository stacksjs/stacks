import { clientPlugin, defineConfig } from '@vitebook/client/node';
import { vueMarkdownPlugin } from '@vitebook/markdown-vue/node';
import { vuePlugin } from '@vitebook/vue/node';
import {
  defaultThemePlugin,
  DefaultThemeConfig
} from '@vitebook/theme-default/node';

export default defineConfig<DefaultThemeConfig>({
  include: ['src/**/*.md', 'src/**/*.story.vue'],
  plugins: [
    vueMarkdownPlugin(),
    vuePlugin({ appFile: 'App.vue' }),
    clientPlugin(),
    defaultThemePlugin()
  ],
  site: {
    title: 'Wallet Integration',
    description: 'Crypto wallet login/integration for Vue 3. Currently supporting the Solana blockchain.',
    theme: {}
  }
});
