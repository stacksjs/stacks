import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Destroy',
  description: 'Delete an author',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')
    const author = await Author.find(Number(id))

    if (!author) {
      return response.json({ error: 'Author not found' }, 404)
    }

    await author.delete()

    return response.json({ success: true, message: 'Author deleted' })
  },
})
