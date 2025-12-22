CREATE TABLE "deployments" (
  "id" BIGSERIAL PRIMARY KEY,
  "commit_sha" varchar(255),
  "commit_message" varchar(255),
  "branch" varchar(255),
  "status" varchar(255),
  "execution_time" real,
  "deploy_script" varchar(255),
  "terminal_output" varchar(255)
);