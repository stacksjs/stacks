export interface SkillMetadata {
  name: string
  description: string
  license?: string
  compatibility?: string
  metadata?: Record<string, unknown>
  'allowed-tools'?: string
  'disable-model-invocation'?: boolean
  'user-invocable'?: boolean
  context?: 'fork'
  agent?: 'Explore' | 'Plan' | 'general-purpose'
  'argument-hint'?: string
  model?: string
  effort?: 'low' | 'medium' | 'high' | 'max'
}

export interface Skill {
  metadata: SkillMetadata
  instructions: string
  path: string
  scripts?: string[]
  references?: string[]
  assets?: string[]
}

export interface SkillManifest {
  skills: Skill[]
  version: string
  framework: string
}
