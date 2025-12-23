CREATE TABLE "personal_access_tokens" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" varchar(255),
  "token" varchar(255),
  "plain_text_token" varchar(255),
  "abilities" varchar(255),
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "ip_address" varchar(255),
  "device_name" varchar(255),
  "is_single_use" boolean
);