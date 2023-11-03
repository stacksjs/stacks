REPO_NAME="stacks-bun-hitcounter"
PROFILE="stacks"
REGION="us-east-1"

REPO_URI=$(bunx aws ecr describe-repositories --repository-names $REPO_NAME --query 'repositories[0].repositoryUri' --output text --profile $PROFILE --region $REGION)

if [ $? -ne 0 ]; then
    # If the repository does not exist, create it
    REPO_URI=$(bunx aws ecr create-repository --repository-name $REPO_NAME --query 'repository.repositoryUri' --output text --profile $PROFILE --region $REGION)
fi

bunx aws ecr get-login-password --region $REGION --profile $PROFILE | docker login --username AWS --password-stdin $REPO_URI
docker build -t $REPO_URI .
docker push $REPO_URI

echo "✅  Published $REPO_URI"
