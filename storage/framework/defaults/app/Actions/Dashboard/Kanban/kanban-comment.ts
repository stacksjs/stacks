import { modelNullableNumber, modelNullableString, modelNumber, modelString } from './kanban-model'

export function cardCommentResponse(record: object, author?: object | null) {
  return {
    id: modelNumber(record, 'id'),
    uuid: modelNullableString(record, 'uuid'),
    userId: modelNullableNumber(record, 'userId', 'user_id'),
    body: modelString(record, 'body'),
    authorName: author ? modelNullableString(author, 'name') : null,
    authorEmail: author ? modelNullableString(author, 'email') : null,
    createdAt: modelNullableString(record, 'createdAt', 'created_at'),
    updatedAt: modelNullableString(record, 'updatedAt', 'updated_at'),
  }
}
