REPO_URI=$(aws ecr create-repository --repository-name stacks-bun-hitcounter --query 'repository.repositoryUri' --output text)
docker build -t $REPO_URI .
docker push $REPO_URI
