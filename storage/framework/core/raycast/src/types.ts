interface Argument {
  name: string
  description: string
  value_required: boolean
}

interface Option {
  name: string
  description: string
}

export interface BuddyCommand {
  signature: string
  description: string
  synopsis: string
  arguments: Argument[]
  options: Option[]
}
