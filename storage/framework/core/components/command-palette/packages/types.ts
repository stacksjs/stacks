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

export type CommandRootEmits = {
  selectItem: [item: ItemInfo]
}

export interface CommandItemProps {
  shortcut?: string[]
  perform?: Noop
}

export type CommandItemEmits = {
  select: [item: ItemInfo]
}

export interface CommandInputProps {
  placeholder?: string
  value?: string
}

export type CommandInputEmits = {
  input: [ie: InputEvent]
  'update:value': [val: any]
}

export interface CommandGroupProps {
  heading: string
}
