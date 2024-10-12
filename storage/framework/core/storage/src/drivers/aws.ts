import { S3Client } from '@aws-sdk/client-s3'
import { AwsS3StorageAdapter } from '@flystorage/aws-s3'
import { FileStorage } from '@flystorage/file-storage'

const client = new S3Client()
const adapter = new AwsS3StorageAdapter(client, {
  bucket: '{your-bucket-name}',
  prefix: '{optional-path-prefix}',
})

export const storage: FileStorage = new FileStorage(adapter)
