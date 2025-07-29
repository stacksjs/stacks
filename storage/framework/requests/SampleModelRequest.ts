import type { schema } from '@stacksjs/validation'
import type { SampleModelRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataSampleModel {
  id: number
  created_at?: string
  updated_at?: string
}
export class SampleModelRequest extends Request<RequestDataSampleModel> implements SampleModelRequestType {
  public id = 1
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('SampleModel', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const sampleModelRequest = new SampleModelRequest()
