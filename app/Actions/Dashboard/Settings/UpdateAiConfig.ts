import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'UpdateAiConfig',
  description: 'Updates the AI config.',
  path: '/api/dashboard/settings/ai',
  method: 'POST',

  validations: {
    'default': {
      rule: schema.enum(['meta.llama2-70b-chat-v1', 'meta.llama2-70b-chat-v2']),
      message: '`default` must refer to a valid AI model. Choose from `meta.llama2-70b-chat-v1` or `meta.llama2-70b-chat-v2`.',
    },

    models: {
      rule: schema.enum(['meta.llama2-70b-chat-v1', 'meta.llama2-70b-chat-v2']),
      message: '`models` must refer to a valid AI model. Choose from `meta.llama2-70b-chat-v1` or `meta.llama2-70b-chat-v2`.',
    },
  },

  async handle() {
    // generate the file update here/write to disk
  },
})
