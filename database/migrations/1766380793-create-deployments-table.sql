CREATE TABLE "deployments" (
  "commitSha" varchar(255),
  "commitMessage" varchar(255),
  "branch" varchar(255),
  "status" varchar(255),
  "executionTime" real,
  "deployScript" varchar(255),
  "terminalOutput" varchar(255)
);