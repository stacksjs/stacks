// vite.config.ts
import { resolve } from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
const config = {
  resolve: {
    dedupe: ['vue'],
    alias: {
      '~': resolve('/Users/chrisbreuer/Code/vue-component-library-starter', 'src'),
    },
  },
  plugins: [
    Vue({
      reactivityTransform: true,
    }),
    AutoImport({
      imports: ['vue', '@vueuse/core', {
        '~/composables/dark': ['isDark', 'toggleDark'],
      }],
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
      },
    }),
    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      dts: 'src/components.d.ts',
    }),
  ],
  build: {
    lib: {
      entry: resolve('/Users/chrisbreuer/Code/vue-component-library-starter', 'src/index.ts'),
      name: 'my-awesome-vue-component-lib',
      fileName: format => `my-awesome-vue-component-lib.${format}.js`,
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    deps: {
      inline: ['@vue', '@vueuse', 'vue-demi'],
    },
  },
}
const vite_config_default = defineConfig(({ command }) => {
  if (command === 'serve')
    return config
  return config
})
export {
  vite_config_default as default,
}
// # sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCBWdWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xuaW1wb3J0IEF1dG9JbXBvcnQgZnJvbSAndW5wbHVnaW4tYXV0by1pbXBvcnQvdml0ZSdcbmltcG9ydCBDb21wb25lbnRzIGZyb20gJ3VucGx1Z2luLXZ1ZS1jb21wb25lbnRzL3ZpdGUnXG5cbi8qKiBAdHlwZSB7aW1wb3J0KCd2aXRlJykuVXNlckNvbmZpZ30gKi9cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcmVzb2x2ZToge1xuICAgIGRlZHVwZTogWyd2dWUnXSxcbiAgICBhbGlhczoge1xuICAgICAgJ34nOiByZXNvbHZlKFwiL1VzZXJzL2NocmlzYnJldWVyL0NvZGUvdnVlLWNvbXBvbmVudC1saWJyYXJ5LXN0YXJ0ZXJcIiwgJ3NyYycpLFxuICAgIH0sXG4gIH0sXG5cbiAgcGx1Z2luczogW1xuICAgIFZ1ZSh7XG4gICAgICByZWFjdGl2aXR5VHJhbnNmb3JtOiB0cnVlLCAvLyBodHRwczovL3Z1ZWpzLm9yZy9ndWlkZS9leHRyYXMvcmVhY3Rpdml0eS10cmFuc2Zvcm0uaHRtbFxuICAgIH0pLFxuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FudGZ1L3VucGx1Z2luLWF1dG8taW1wb3J0XG4gICAgQXV0b0ltcG9ydCh7XG4gICAgICBpbXBvcnRzOiBbJ3Z1ZScsICdAdnVldXNlL2NvcmUnLCB7XG4gICAgICAgICd+L2NvbXBvc2FibGVzL2RhcmsnOiBbJ2lzRGFyaycsICd0b2dnbGVEYXJrJ10sXG4gICAgICB9XSxcbiAgICAgIGR0czogJ3NyYy9hdXRvLWltcG9ydHMuZC50cycsXG4gICAgICBlc2xpbnRyYzoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KSxcblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbnRmdS91bnBsdWdpbi12dWUtY29tcG9uZW50c1xuICAgIENvbXBvbmVudHMoe1xuICAgICAgZGlyczogWydzcmMvY29tcG9uZW50cyddLFxuICAgICAgZXh0ZW5zaW9uczogWyd2dWUnXSxcbiAgICAgIGR0czogJ3NyYy9jb21wb25lbnRzLmQudHMnLFxuICAgIH0pLFxuICBdLFxuXG4gIGJ1aWxkOiB7XG4gICAgbGliOiB7XG4gICAgICBlbnRyeTogcmVzb2x2ZShcIi9Vc2Vycy9jaHJpc2JyZXVlci9Db2RlL3Z1ZS1jb21wb25lbnQtbGlicmFyeS1zdGFydGVyXCIsICdzcmMvaW5kZXgudHMnKSxcbiAgICAgIG5hbWU6ICdteS1hd2Vzb21lLXZ1ZS1jb21wb25lbnQtbGliJyxcbiAgICAgIGZpbGVOYW1lOiBmb3JtYXQgPT4gYG15LWF3ZXNvbWUtdnVlLWNvbXBvbmVudC1saWIuJHtmb3JtYXR9LmpzYCxcbiAgICB9LFxuXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFsndnVlJ10sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gZXhwb3J0czogJ25hbWVkJyxcbiAgICAgICAgZ2xvYmFsczoge1xuICAgICAgICAgIHZ1ZTogJ1Z1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgbWluaWZ5OiBmYWxzZSxcbiAgfSxcblxuICB0ZXN0OiB7XG4gICAgaW5jbHVkZTogWyd0ZXN0cy8qKi8qLnRlc3QudHMnXSxcbiAgICAvLyBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBkZXBzOiB7XG4gICAgICBpbmxpbmU6IFsnQHZ1ZScsICdAdnVldXNlJywgJ3Z1ZS1kZW1pJ10sXG4gICAgfSxcbiAgfSxcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZ1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IGNvbW1hbmQgfSkgPT4ge1xuICBpZiAoY29tbWFuZCA9PT0gJ3NlcnZlJylcbiAgICByZXR1cm4gY29uZmlnXG5cbiAgLy8gY29tbWFuZCA9PT0gJ2J1aWxkJ1xuICByZXR1cm4gY29uZmlnXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFHQSxJQUFNLFNBQVM7QUFBQSxFQUNiLFNBQVM7QUFBQSxJQUNQLFFBQVEsQ0FBQyxLQUFLO0FBQUEsSUFDZCxPQUFPO0FBQUEsTUFDTCxLQUFLLFFBQVEseURBQXlELEtBQUs7QUFBQSxJQUM3RTtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxNQUNGLHFCQUFxQjtBQUFBLElBQ3ZCLENBQUM7QUFBQSxJQUdELFdBQVc7QUFBQSxNQUNULFNBQVMsQ0FBQyxPQUFPLGdCQUFnQjtBQUFBLFFBQy9CLHNCQUFzQixDQUFDLFVBQVUsWUFBWTtBQUFBLE1BQy9DLENBQUM7QUFBQSxNQUNELEtBQUs7QUFBQSxNQUNMLFVBQVU7QUFBQSxRQUNSLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFHRCxXQUFXO0FBQUEsTUFDVCxNQUFNLENBQUMsZ0JBQWdCO0FBQUEsTUFDdkIsWUFBWSxDQUFDLEtBQUs7QUFBQSxNQUNsQixLQUFLO0FBQUEsSUFDUCxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTyxRQUFRLHlEQUF5RCxjQUFjO0FBQUEsTUFDdEYsTUFBTTtBQUFBLE1BQ04sVUFBVSxZQUFVLGdDQUFnQztBQUFBLElBQ3REO0FBQUEsSUFFQSxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsS0FBSztBQUFBLE1BQ2hCLFFBQVE7QUFBQSxRQUVOLFNBQVM7QUFBQSxVQUNQLEtBQUs7QUFBQSxRQUNQO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUVBLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFFQSxNQUFNO0FBQUEsSUFDSixTQUFTLENBQUMsb0JBQW9CO0FBQUEsSUFFOUIsTUFBTTtBQUFBLE1BQ0osUUFBUSxDQUFDLFFBQVEsV0FBVyxVQUFVO0FBQUEsSUFDeEM7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLGNBQWM7QUFDM0MsTUFBSSxZQUFZO0FBQ2QsV0FBTztBQUdULFNBQU87QUFDVCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
