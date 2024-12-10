import type { IFuseOptions } from 'fuse.js'

export interface ItemInfo {
  key: string
  value: string
}

export type Noop = () => void

export interface CommandRootProps {
  theme?: string
  fuseOptions?: IFuseOptions<any>
}

export interface CommandRootEmits {
  selectItem: [item: ItemInfo]
}

export interface CommandItemProps {
  shortcut?: string[]
  perform?: Noop
}

export interface CommandItemEmits {
  select: [item: ItemInfo]
}

export interface CommandInputProps {
  placeholder?: string
  value?: string
}

export interface CommandInputEmits {
  'input': [ie: InputEvent]
  'update:value': [val: any]
}

export interface CommandGroupProps {
  heading: string
}
