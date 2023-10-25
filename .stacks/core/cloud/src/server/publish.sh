REPO_URI=$(aws ecr create-repository --repository-name stacks-bun-hitcounter --query 'repository.repositoryUri' --output text --profile stacks)
docker build -t $REPO_URI .
docker push $REPO_URI
