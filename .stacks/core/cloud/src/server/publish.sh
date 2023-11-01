REPO_URI=$(bunx aws ecr create-repository --repository-name stacks-bun-hitcounter --query 'repository.repositoryUri' --output text --profile stacks)
bunx aws ecr get-login-password --region us-east-1 --profile stacks | docker login --username AWS --password-stdin $REPO_URI
docker build -t $REPO_URI .
docker push $REPO_URI
