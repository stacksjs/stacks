CREATE TABLE "personal_access_tokens" (
  "name" varchar(255),
  "token" varchar(255),
  "plainTextToken" varchar(255),
  "abilities" varchar(255),
  "lastUsedAt" timestamp,
  "expiresAt" timestamp,
  "revokedAt" timestamp,
  "ipAddress" varchar(255),
  "deviceName" varchar(255),
  "isSingleUse" boolean
);