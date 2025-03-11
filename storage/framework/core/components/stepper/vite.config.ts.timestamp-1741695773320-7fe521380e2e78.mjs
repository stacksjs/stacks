// vite.config.ts
import { resolve } from "node:path";
import { alias } from "file:///Users/michael/Documents/cion/stacks/storage/framework/core/alias/dist/index.js";
import Vue from "file:///Users/michael/Documents/cion/stacks/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import CleanCSS from "file:///Users/michael/Documents/cion/stacks/node_modules/clean-css/index.js";
import UnoCSS from "file:///Users/michael/Documents/cion/stacks/storage/framework/core/components/stepper/node_modules/unocss/dist/vite.mjs";
import IconsResolver from "file:///Users/michael/Documents/cion/stacks/storage/framework/core/components/stepper/node_modules/unplugin-icons/dist/resolver.js";
import Icons from "file:///Users/michael/Documents/cion/stacks/storage/framework/core/components/stepper/node_modules/unplugin-icons/dist/vite.js";
import Components from "file:///Users/michael/Documents/cion/stacks/storage/framework/core/components/stepper/node_modules/unplugin-vue-components/dist/vite.js";
import { defineConfig } from "file:///Users/michael/Documents/cion/stacks/storage/framework/core/components/stepper/node_modules/vite/dist/node/index.js";
var __vite_injected_original_dirname = "/Users/michael/Documents/cion/stacks/storage/framework/core/components/stepper";
function minify(code) {
  const cleanCssInstance = new CleanCSS({});
  return cleanCssInstance.minify(code).styles;
}
var vite_config_default = defineConfig(({ mode }) => {
  let cssCodeStr = "";
  const userConfig = {};
  const commonPlugins = [
    Vue({
      include: /\.(stx|vue|md)($|\?)/
    }),
    UnoCSS({
      mode: "vue-scoped"
    }),
    Components({
      extensions: ["stx", "vue", "md"],
      include: /\.(stx|vue|md)($|\?)/,
      resolvers: [
        IconsResolver({
          prefix: "",
          enabledCollections: ["heroicons"]
        })
      ],
      dts: true
    }),
    Icons({
      autoInstall: true,
      compiler: "vue3"
    })
  ];
  if (mode === "lib") {
    userConfig.build = {
      lib: {
        entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
        name: "StacksStepper",
        fileName: "index"
      },
      outDir: "dist",
      emptyOutDir: true,
      cssCodeSplit: false,
      sourcemap: true,
      rollupOptions: {
        external: ["vue", "@heroicons/vue", "unocss"],
        output: [
          {
            format: "es",
            entryFileNames: "index.js",
            preserveModules: false,
            globals: {
              vue: "Vue",
              "@heroicons/vue": "HeroIcons",
              unocss: "UnoCSS"
            }
          }
        ]
      }
    };
    userConfig.plugins = [
      ...commonPlugins,
      {
        name: "inline-css",
        transform(code, id) {
          const isCSS = (path) => /\.css$/.test(path);
          if (!isCSS(id))
            return;
          const cssCode = minify(code);
          cssCodeStr = cssCode;
          return {
            code: "",
            map: { mappings: "" }
          };
        },
        renderChunk(code, { isEntry }) {
          if (!isEntry)
            return;
          return {
            code: `            function __insertCSSStacksStepper(code) {
              if (!code || typeof document == 'undefined') return
              let head = document.head || document.getElementsByTagName('head')[0]
              let style = document.createElement('style')
              style.type = 'text/css'
              head.appendChild(style)
              ;style.styleSheet ? (style.styleSheet.cssText = code) : style.appendChild(document.createTextNode(code))
            }

            __insertCSSStacksStepper(${JSON.stringify(cssCodeStr)})
            
 ${code}`,
            map: { mappings: "" }
          };
        }
      }
    ];
  }
  return {
    resolve: {
      alias
    },
    plugins: [...commonPlugins],
    ...userConfig
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvbWljaGFlbC9Eb2N1bWVudHMvY2lvbi9zdGFja3Mvc3RvcmFnZS9mcmFtZXdvcmsvY29yZS9jb21wb25lbnRzL3N0ZXBwZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9taWNoYWVsL0RvY3VtZW50cy9jaW9uL3N0YWNrcy9zdG9yYWdlL2ZyYW1ld29yay9jb3JlL2NvbXBvbmVudHMvc3RlcHBlci92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvbWljaGFlbC9Eb2N1bWVudHMvY2lvbi9zdGFja3Mvc3RvcmFnZS9mcmFtZXdvcmsvY29yZS9jb21wb25lbnRzL3N0ZXBwZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgdHlwZSB7IFVzZXJDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCB7IGFsaWFzIH0gZnJvbSAnQHN0YWNrc2pzL2FsaWFzJ1xuaW1wb3J0IFZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgQ2xlYW5DU1MgZnJvbSAnY2xlYW4tY3NzJ1xuaW1wb3J0IFVub0NTUyBmcm9tICd1bm9jc3Mvdml0ZSdcbmltcG9ydCBJY29uc1Jlc29sdmVyIGZyb20gJ3VucGx1Z2luLWljb25zL3Jlc29sdmVyJ1xuaW1wb3J0IEljb25zIGZyb20gJ3VucGx1Z2luLWljb25zL3ZpdGUnXG5pbXBvcnQgQ29tcG9uZW50cyBmcm9tICd1bnBsdWdpbi12dWUtY29tcG9uZW50cy92aXRlJ1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcblxuZnVuY3Rpb24gbWluaWZ5KGNvZGU6IHN0cmluZykge1xuICBjb25zdCBjbGVhbkNzc0luc3RhbmNlID0gbmV3IENsZWFuQ1NTKHt9KVxuICByZXR1cm4gY2xlYW5Dc3NJbnN0YW5jZS5taW5pZnkoY29kZSkuc3R5bGVzXG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgbGV0IGNzc0NvZGVTdHIgPSAnJ1xuICBjb25zdCB1c2VyQ29uZmlnOiBVc2VyQ29uZmlnID0ge31cblxuICBjb25zdCBjb21tb25QbHVnaW5zID0gW1xuICAgIFZ1ZSh7XG4gICAgICBpbmNsdWRlOiAvXFwuKHN0eHx2dWV8bWQpKCR8XFw/KS8sXG4gICAgfSksXG5cbiAgICBVbm9DU1Moe1xuICAgICAgbW9kZTogJ3Z1ZS1zY29wZWQnLFxuICAgIH0pLFxuXG4gICAgQ29tcG9uZW50cyh7XG4gICAgICBleHRlbnNpb25zOiBbJ3N0eCcsICd2dWUnLCAnbWQnXSxcbiAgICAgIGluY2x1ZGU6IC9cXC4oc3R4fHZ1ZXxtZCkoJHxcXD8pLyxcbiAgICAgIHJlc29sdmVyczogW1xuICAgICAgICBJY29uc1Jlc29sdmVyKHtcbiAgICAgICAgICBwcmVmaXg6ICcnLFxuICAgICAgICAgIGVuYWJsZWRDb2xsZWN0aW9uczogWydoZXJvaWNvbnMnXSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgZHRzOiB0cnVlLFxuICAgIH0pLFxuXG4gICAgSWNvbnMoe1xuICAgICAgYXV0b0luc3RhbGw6IHRydWUsXG4gICAgICBjb21waWxlcjogJ3Z1ZTMnLFxuICAgIH0pLFxuICBdXG5cbiAgaWYgKG1vZGUgPT09ICdsaWInKSB7XG4gICAgdXNlckNvbmZpZy5idWlsZCA9IHtcbiAgICAgIGxpYjoge1xuICAgICAgICBlbnRyeTogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvaW5kZXgudHMnKSxcbiAgICAgICAgbmFtZTogJ1N0YWNrc1N0ZXBwZXInLFxuICAgICAgICBmaWxlTmFtZTogJ2luZGV4JyxcbiAgICAgIH0sXG4gICAgICBvdXREaXI6ICdkaXN0JyxcbiAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgICAgY3NzQ29kZVNwbGl0OiBmYWxzZSxcbiAgICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgZXh0ZXJuYWw6IFsndnVlJywgJ0BoZXJvaWNvbnMvdnVlJywgJ3Vub2NzcyddLFxuICAgICAgICBvdXRwdXQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBmb3JtYXQ6ICdlcycsXG4gICAgICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2luZGV4LmpzJyxcbiAgICAgICAgICAgIHByZXNlcnZlTW9kdWxlczogZmFsc2UsXG4gICAgICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgICAgIHZ1ZTogJ1Z1ZScsXG4gICAgICAgICAgICAgICdAaGVyb2ljb25zL3Z1ZSc6ICdIZXJvSWNvbnMnLFxuICAgICAgICAgICAgICB1bm9jc3M6ICdVbm9DU1MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9XG5cbiAgICB1c2VyQ29uZmlnLnBsdWdpbnMgPSBbXG4gICAgICAuLi5jb21tb25QbHVnaW5zLFxuICAgICAge1xuICAgICAgICBuYW1lOiAnaW5saW5lLWNzcycsXG4gICAgICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xuICAgICAgICAgIGNvbnN0IGlzQ1NTID0gKHBhdGg6IHN0cmluZykgPT4gL1xcLmNzcyQvLnRlc3QocGF0aClcbiAgICAgICAgICBpZiAoIWlzQ1NTKGlkKSlcbiAgICAgICAgICAgIHJldHVyblxuXG4gICAgICAgICAgY29uc3QgY3NzQ29kZSA9IG1pbmlmeShjb2RlKVxuICAgICAgICAgIGNzc0NvZGVTdHIgPSBjc3NDb2RlXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvZGU6ICcnLFxuICAgICAgICAgICAgbWFwOiB7IG1hcHBpbmdzOiAnJyB9LFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVuZGVyQ2h1bmsoY29kZSwgeyBpc0VudHJ5IH0pIHtcbiAgICAgICAgICBpZiAoIWlzRW50cnkpXG4gICAgICAgICAgICByZXR1cm5cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlOiBgXFxcbiAgICAgICAgICAgIGZ1bmN0aW9uIF9faW5zZXJ0Q1NTU3RhY2tzU3RlcHBlcihjb2RlKSB7XG4gICAgICAgICAgICAgIGlmICghY29kZSB8fCB0eXBlb2YgZG9jdW1lbnQgPT0gJ3VuZGVmaW5lZCcpIHJldHVyblxuICAgICAgICAgICAgICBsZXQgaGVhZCA9IGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXVxuICAgICAgICAgICAgICBsZXQgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpXG4gICAgICAgICAgICAgIHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnXG4gICAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpXG4gICAgICAgICAgICAgIDtzdHlsZS5zdHlsZVNoZWV0ID8gKHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNvZGUpIDogc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY29kZSkpXG4gICAgICAgICAgICB9XFxuXG4gICAgICAgICAgICBfX2luc2VydENTU1N0YWNrc1N0ZXBwZXIoJHtKU09OLnN0cmluZ2lmeShjc3NDb2RlU3RyKX0pXG4gICAgICAgICAgICBcXG4gJHtjb2RlfWAsXG4gICAgICAgICAgICBtYXA6IHsgbWFwcGluZ3M6ICcnIH0sXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzLFxuICAgIH0sXG4gICAgcGx1Z2luczogWy4uLmNv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
