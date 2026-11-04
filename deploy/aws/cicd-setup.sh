#!/usr/bin/env bash
# CI/CD setup: lets GitHub Actions push images to ECR and deploy the ktrg server. Run from the project folder in Git
# Bash, after aws-setup.sh (the ECR repositories and the server must exist):
#
#   bash deploy/aws/cicd-setup.sh
#
# GitHub signs in with OIDC: AWS gives each workflow run short-lived permissions, so no AWS key is stored in GitHub.
# Only workflows on main may use the role. It can push to the three ECR repositories, upload deploy/aws to S3, and run
# commands on the server
# (tag Name=ktrg-cms) through Session Manager. Safe to run again.
set -euo pipefail

# ---- Settings ---------------------------------------------------------------------------------------------------------
export AWS_PROFILE="${AWS_PROFILE:-ktrg}"   # the CLI user ktrg-admin
export AWS_REGION=ap-northeast-3            # Osaka
export MSYS_NO_PATHCONV=1                   # Git Bash: keep /... paths as they are
ACCOUNT=712723095627
NAME=ktrg-cms                               # the server's Name tag (aws-setup.sh)
REPOS="ktrg-cms ktrg-web ktrg-db"           # ECR: API, website, PostgreSQL
GITHUB_REPO=AnpTeam/ktrg-cms
GITHUB_BRANCH=main                          # the only branch whose workflows may deploy
GITHUB_ROLE=ktrg-github-deploy
BUCKET=ktrg-backups-$ACCOUNT               # the deploy files go to deploy/aws/ in it

# Policy files go to a temporary folder. aws.exe on Windows needs that folder as C:/..., not /tmp/...
TMP="$(mktemp -d)"
command -v cygpath >/dev/null && TMP="$(cygpath -m "$TMP")"
trap 'rm -rf "$TMP"' EXIT

[ "$(aws sts get-caller-identity --query Account --output text)" = "$ACCOUNT" ] || { echo "wrong AWS account"; exit 1; }

# ---- 1. GitHub as a sign-in provider ----------------------------------------------------------------------------------
# Tells AWS to accept the identity tokens GitHub Actions gives each run. One per AWS account.
echo "== GitHub OIDC provider"
OIDC=arn:aws:iam::$ACCOUNT:oidc-provider/token.actions.githubusercontent.com
aws iam get-open-id-connect-provider --open-id-connect-provider-arn $OIDC >/dev/null 2>&1 ||
  aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com >/dev/null
echo "$OIDC"

# ---- 2. The role GitHub uses ------------------------------------------------------------------------------------------
# Who may use it (trust policy): GitHub, for this repository's main branch only.
echo "== role $GITHUB_ROLE"
cat > "$TMP/trust.json" <<JSON
{ "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Principal": { "Federated": "$OIDC" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": { "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:$GITHUB_REPO:ref:refs/heads/$GITHUB_BRANCH" } } } ] }
JSON
if aws iam get-role --role-name $GITHUB_ROLE >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name $GITHUB_ROLE --policy-document "file://$TMP/trust.json"
else
  aws iam create-role --role-name $GITHUB_ROLE --assume-role-policy-document "file://$TMP/trust.json" \
    --description "GitHub Actions: push images to ECR, deploy the ktrg server" >/dev/null
fi

# ---- 3. What the role may do ------------------------------------------------------------------------------------------
# ECR: log in, push to the three repositories. SSM: run a shell command on the server named ktrg-cms, read the result.
REPO_ARNS=""
for repo in $REPOS; do REPO_ARNS="$REPO_ARNS\"arn:aws:ecr:$AWS_REGION:$ACCOUNT:repository/$repo\","; done
cat > "$TMP/github.json" <<JSON
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
  { "Effect": "Allow", "Action": [
      "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:DescribeImages" ],
    "Resource": [ ${REPO_ARNS%,} ] },
  { "Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::$BUCKET/deploy/aws/*" },
  { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::$BUCKET",
    "Condition": { "StringLike": { "s3:prefix": "deploy/aws/*" } } },
  { "Effect": "Allow", "Action": "ssm:SendCommand", "Resource": "arn:aws:ssm:$AWS_REGION::document/AWS-RunShellScript" },
  { "Effect": "Allow", "Action": "ssm:SendCommand", "Resource": "arn:aws:ec2:$AWS_REGION:$ACCOUNT:instance/*",
    "Condition": { "StringEquals": { "ssm:resourceTag/Name": "$NAME" } } },
  { "Effect": "Allow", "Action": ["ssm:ListCommandInvocations", "ssm:GetCommandInvocation"], "Resource": "*" }
] }
JSON
aws iam put-role-policy --role-name $GITHUB_ROLE --policy-name deploy --policy-document "file://$TMP/github.json"

echo "== done. The workflow uses this role:"
aws iam get-role --role-name $GITHUB_ROLE --query Role.Arn --output text
