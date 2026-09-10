CREATE TABLE IF NOT EXISTS "operator_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"issued_at_ms" bigint NOT NULL
);
