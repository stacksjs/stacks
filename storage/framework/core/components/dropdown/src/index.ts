import type { Plugin } from 'vue'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Menu, MenuButton, MenuItem, MenuItems }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export {
  Menu as Dropdown,
  MenuButton as DropdownButton,
  MenuItem as DropdownItem,
  MenuItems as DropdownItems,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
}
export default plugin
