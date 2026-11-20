#!/usr/bin/env bash
# Crea (o resetea) el único usuario de acceso en Cognito con una contraseña aleatoria.
# Uso: npm run aws:user -- <usuario>   (por defecto: evaluador). La contraseña solo se muestra aquí.
set -euo pipefail
source "$(dirname "$0")/common.sh"

USERNAME="${1:-evaluador}"
POOL_ID="$(stack_output UserPoolId)"
PASSWORD="$(node -e 'const c=require("node:crypto");const a="ABCDEFGHJKLMNPQRSTUVWXYZ",b="abcdefghijkmnopqrstuvwxyz",d="23456789";const pick=(s,n)=>Array.from({length:n},()=>s[c.randomInt(s.length)]).join("");process.stdout.write(pick(a,4)+pick(b,6)+pick(d,4)+pick(a+b+d,4))')"

if ! aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$USERNAME" --region "$REGION" >/dev/null 2>&1; then
  aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" --username "$USERNAME" \
    --message-action SUPPRESS --region "$REGION" >/dev/null
fi
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" --username "$USERNAME" \
  --password "$PASSWORD" --permanent --region "$REGION"

echo "Usuario:     $USERNAME"
echo "Contraseña:  $PASSWORD"
echo "(Guárdala ahora: no se almacena en ningún otro lugar. Vuelve a ejecutar el script para cambiarla.)"
