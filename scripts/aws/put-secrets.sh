#!/usr/bin/env bash
# Crea o actualiza en Secrets Manager el secreto con las API keys (LLM y Tavily) leídas del .env.
# Las keys nunca se imprimen ni quedan en el repositorio.
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$ROOT"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
node -e '
  process.loadEnvFile(".env");
  const keys = ["LLM_API_KEY", "TAVILY_API_KEY"];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) { console.error(`Faltan en .env: ${missing.join(", ")}`); process.exit(1); }
  process.stdout.write(JSON.stringify(Object.fromEntries(keys.map((k) => [k, process.env[k]]))));
' > "$TMP"

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "file://$TMP" --region "$REGION" >/dev/null
  echo "Secreto $SECRET_NAME actualizado."
else
  aws secretsmanager create-secret --name "$SECRET_NAME" --secret-string "file://$TMP" --region "$REGION" \
    --description "API keys del Lead Agent (LLM y Tavily)" >/dev/null
  echo "Secreto $SECRET_NAME creado."
fi
