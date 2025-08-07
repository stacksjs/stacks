import type { schema } from '@stacksjs/validation'
import type { TaggableModelsRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataTaggableModels {
  id: number
  tag_id: number
  taggable_id: number
  taggable_type: string
  created_at: string
  updated_at: string | null

}
export class TaggableModelsRequest extends Request<RequestDataTaggableModels> implements TaggableModelsRequestType {
  public id = 0
  public tag_id = 0
  public taggable_id = 0
  public taggable_type = ''
  public created_at = ''
  public updated_at = null

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('TaggableModels', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const taggableModelsRequest = new TaggableModelsRequest()
