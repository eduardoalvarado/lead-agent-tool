#!/usr/bin/env bash
# Empaqueta la app (dist + dependencias de producción) y despliega el stack con CloudFormation.
# Uso: npm run aws:deploy [-- Parametro=Valor ...]   p. ej. LlmProvider=bedrock
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$ROOT"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="lead-agent-artifacts-${ACCOUNT}-${REGION}"

npm run build
rm -rf "$BUILD" && mkdir -p "$BUILD/app"
cp -r dist package.json package-lock.json "$BUILD/app/"
# Solo dependencias de producción, sin peers opcionales (p. ej. TypeScript) ni archivos que
# no se usan en ejecución: el límite de Lambda es 250 MB descomprimido.
(cd "$BUILD/app" && npm ci --omit=dev --omit=peer --ignore-scripts --no-audit --no-fund --loglevel=error)
find "$BUILD/app/node_modules" \( -name "*.map" -o -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.cts" \) -delete
echo "Tamaño del paquete: $(du -sh "$BUILD/app" | cut -f1)"

aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null || aws s3 mb "s3://$BUCKET" --region "$REGION"
aws cloudformation package --template-file infra/template.yaml --s3-bucket "$BUCKET" \
  --output-template-file "$BUILD/packaged.yaml" --region "$REGION" >/dev/null
aws cloudformation deploy --template-file "$BUILD/packaged.yaml" --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region "$REGION" \
  --no-fail-on-empty-changeset ${1:+--parameter-overrides "$@"}

aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query 'Stacks[0].Outputs' --output table
