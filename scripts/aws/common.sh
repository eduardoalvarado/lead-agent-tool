# Variables compartidas por los scripts de AWS (se cargan con `source`).
REGION="${DEPLOY_REGION:-us-east-2}"
STACK="${STACK_NAME:-lead-agent}"
SECRET_NAME="${SECRET_NAME:-lead-agent/api-keys}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD="$ROOT/.aws-build"

stack_output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
