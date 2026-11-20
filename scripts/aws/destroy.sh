#!/usr/bin/env bash
# Elimina el stack (API, Lambdas, colas, tablas, Cognito) y el secreto. Irreversible.
set -euo pipefail
source "$(dirname "$0")/common.sh"

read -r -p "Se eliminará el stack '$STACK' y el secreto '$SECRET_NAME' en $REGION. ¿Continuar? [s/N] " answer
[[ "$answer" == "s" ]] || { echo "Cancelado."; exit 1; }
aws cloudformation delete-stack --stack-name "$STACK" --region "$REGION"
aws cloudformation wait stack-delete-complete --stack-name "$STACK" --region "$REGION"
aws secretsmanager delete-secret --secret-id "$SECRET_NAME" --force-delete-without-recovery --region "$REGION" >/dev/null
echo "Stack y secreto eliminados."
