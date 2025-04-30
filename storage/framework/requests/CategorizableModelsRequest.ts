import type { schema } from '@stacksjs/validation'
import type { CategorizableModelsRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCategorizableModels {
  id: number
  category_id: number
  categorizable_id: number
  categorizable_type: string
  created_at: string
  updated_at: string | null

}
export class CategorizableModelsRequest extends Request<RequestDataCategorizableModels> implements CategorizableModelsRequestType {
  public id = 0
  public category_id = 0
  public categorizable_id = 0
  public categorizable_type = ''
  public created_at = ''
  public updated_at = null

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('CategorizableModels', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const categorizableModelsRequest = new CategorizableModelsRequest()
