import { runCommand } from '@stacksjs/cli'

// ❯ aws dynamodb create-table --table-name=MyOfflineTable --attribute-definitions AttributeName=Artist,AttributeType=S AttributeName=SongTitle,AttributeType=S  --key-schema AttributeName=Artist,KeyType=HASH AttributeName=SongTitle,KeyType=RANGE --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --endpoint-url http://localhost:8000 --region us-east-1

console.log('Creating table...')
const res = await runCommand('aws dynamodb create-table --table-name=MyOfflineTable --attribute-definitions AttributeName=Artist,AttributeType=S AttributeName=SongTitle,AttributeType=S  --key-schema AttributeName=Artist,KeyType=HASH AttributeName=SongTitle,KeyType=RANGE --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --endpoint-url http://localhost:8000 --region us-east-1')
console.log(res)
console.log('Table created!')
