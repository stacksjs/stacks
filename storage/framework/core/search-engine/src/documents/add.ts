import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'

async function importModelDocuments() {
    const userModelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })
    const { addDocument } = useSearchEngine()

    for (const userModel of userModelFiles) {
      const modelInstance = (await import(userModel)).default
    
      const tableName = getTableName(modelInstance, userModel)

      const documents = modelInstance.all()
  
      for (const document of documents) {
        await addDocument(tableName, document)
      }
    } 

   

}