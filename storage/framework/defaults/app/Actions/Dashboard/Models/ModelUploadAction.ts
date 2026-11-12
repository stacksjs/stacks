import type { RequestInstance } from '@stacksjs/types'
import type { UploadedFileLike } from '@stacksjs/storage'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { uploadDashboardFiles } from '../Content/file-manager'
import { dashboardFileFailure } from '../Content/file-response'
import { modelFormFields, reachableRelations } from './model-forms'
import { describeAccept, MODEL_UPLOAD_BYTES, uploadAccepts, uploadDirectory } from './model-upload'
import { modelWriteCapabilities, resolveWritableModel } from './model-write'

/** The file's bytes, however the request handed it over. */
async function uploadedBytes(file: UploadedFileLike): Promise<Uint8Array | undefined> {
  if (typeof file.bytes === 'function')
    return await file.bytes()
  if (typeof file.arrayBuffer === 'function')
    return new Uint8Array(await file.arrayBuffer())
  if (file.buffer)
    return file.buffer instanceof ArrayBuffer ? new Uint8Array(file.buffer) : new Uint8Array(file.buffer)
  return undefined
}

/**
 * `POST /api/dashboard/models/{slug}/uploads`.
 *
 * Stores the file chosen for one of a model's fields and answers with its
 * address, which the form then holds as the field's value. Nothing about any
 * record changes here: the address is written when the form is saved, by the
 * endpoint that saves the rest of it.
 *
 * It only takes a file for a field the model asks for as one
 * (`dashboard.fields.<name>.input: 'upload'`), of a kind that field accepts,
 * on a model the dashboard may write. The file goes through the pipeline the
 * Files page uses, so it is listed there, and gets a generated name, so two
 * people uploading `photo.png` do not meet.
 */
export default new Action({
  name: 'Dashboard Model Upload',
  description: 'Stores the file chosen for one of a model\'s upload fields and returns its address.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const resolved = await resolveWritableModel(request.getParam('slug'))
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)
    const { Model, modelName } = resolved
    const capabilities = modelWriteCapabilities(Model)
    if (!capabilities.create && !capabilities.update)
      return response.json({ message: `${modelName} records cannot be written from the dashboard, so there is nothing to upload a file for.` }, 405)

    const name = String(request.get('field', '') ?? '')
    const reachable = new Set((await reachableRelations(Model)).map(relation => relation.model))
    const field = modelFormFields(Model, reachable).find(candidate => candidate.name === name && candidate.type === 'upload')
    if (!field)
      return response.json({ message: name ? `${modelName} does not take an uploaded file for '${name}'.` : 'Say which field the file is for.' }, 422)

    const file = request.file('file') as (UploadedFileLike & { size?: number }) | null | undefined
    if (!file)
      return response.json({ message: 'Choose a file.', fields: { [field.name]: 'Choose a file.' } }, 422)
    if (Number(file.size || 0) > MODEL_UPLOAD_BYTES)
      return response.json({ message: 'The file must be 10 MB or smaller.', fields: { [field.name]: 'The file must be 10 MB or smaller.' } }, 422)
    // By what the file is, not what it was sent as: its first bytes say.
    const bytes = await uploadedBytes(file)
    if (!uploadAccepts(field.accept, { type: file.mimeType ?? file.mimetype, name: file.name ?? file.originalName, bytes })) {
      const message = `${field.label} takes ${describeAccept(field.accept ?? '')}.`
      return response.json({ message, fields: { [field.name]: message } }, 422)
    }

    try {
      const [stored] = await uploadDashboardFiles({
        disk: 'public',
        path: uploadDirectory(String(Model.table || modelName), field.name.replace(/([a-z\d])([A-Z])/g, '$1_$2')),
        files: [file],
        filename: 'uuid',
      })
      if (!stored)
        throw new Error('The upload answered with no file.')
      return response.json({ url: stored.url, path: stored.path, size: stored.size }, 201)
    }
    catch (error) {
      return dashboardFileFailure(error, 'The file could not be stored.', 'ModelUploadAction')
    }
  },
})
