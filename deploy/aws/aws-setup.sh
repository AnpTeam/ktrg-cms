#!/usr/bin/env bash
# AWS setup for the ktrg server, steps 1-5 of 設計書 2.4.7 (CI/CD is cicd-setup.sh), with the AWS CLI. Run from the project folder in Git Bash:
#
#   bash deploy/aws/aws-setup.sh        # every step, 1 to 5
#   bash deploy/aws/aws-setup.sh 3      # only step 3
#
# Safe to run again: each step checks what already exists before creating it.
#   1. IAM role for the server       4. EC2 instance + Elastic IP
#   2. Security group                5. S3 backup bucket
#   3. ECR repositories
set -euo pipefail

# ---- Settings ---------------------------------------------------------------------------------------------------------
export AWS_PROFILE="${AWS_PROFILE:-ktrg}"   # the CLI user ktrg-admin
export AWS_REGION=ap-northeast-3            # Osaka
export MSYS_NO_PATHCONV=1                   # Git Bash: keep /ktrg/... and /aws/... as they are
ACCOUNT=712723095627
NAME=ktrg-cms                               # the instance's Name tag
SERVER_ROLE=EC2-ECR-ReadOnly-Role           # made in the console (設計書 step 1)
SG_NAME=ktrg-web                            # security group
REPOS="ktrg-cms ktrg-web ktrg-db"           # ECR: API, website, PostgreSQL
INSTANCE_TYPE=t4g.small                     # ARM64 (Graviton)
DISK_GB=30
BUCKET=ktrg-backups-$ACCOUNT

# Policy files are written to a temporary folder. aws.exe on Windows needs that folder as C:/..., not /tmp/...
TMP="$(mktemp -d)"
command -v cygpath >/dev/null && TMP="$(cygpath -m "$TMP")"
trap 'rm -rf "$TMP"' EXIT

say() { printf '\n== %s\n' "$*"; }

# Stop at once if this is not the right AWS account.
[ "$(aws sts get-caller-identity --query Account --output text)" = "$ACCOUNT" ] || { echo "wrong AWS account"; exit 1; }

# ---- 1. IAM role for the server ---------------------------------------------------------------------------------------
# The server's own permissions (no keys on the server): two AWS-made policies, plus our inline policy ktrg-server.
step1() {
  say "1. IAM role $SERVER_ROLE"
  aws iam get-role --role-name $SERVER_ROLE >/dev/null || { echo "make the role $SERVER_ROLE first (console)"; exit 1; }

  for policy in AmazonEC2ContainerRegistryReadOnly AmazonSSMManagedInstanceCore; do
    aws iam attach-role-policy --role-name $SERVER_ROLE --policy-arn arn:aws:iam::aws:policy/$policy
  done

  # S3: the backup bucket only. SSM: the settings under /ktrg/. CloudWatch: memory and disk numbers for the alarms.
  cat > "$TMP/server.json" <<JSON
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::$BUCKET", "arn:aws:s3:::$BUCKET/*"] },
  { "Effect": "Allow", "Action": "ssm:GetParameter",
    "Resource": "arn:aws:ssm:$AWS_REGION:$ACCOUNT:parameter/ktrg/*" },
  { "Effect": "Allow", "Action": ["cloudwatch:PutMetricData", "ec2:DescribeTags", "ec2:DescribeVolumes"], "Resource": "*" }
] }
JSON
  aws iam put-role-policy --role-name $SERVER_ROLE --policy-name ktrg-server --policy-document "file://$TMP/server.json"

  aws iam list-attached-role-policies --role-name $SERVER_ROLE --query 'AttachedPolicies[].PolicyName' --output text
  aws iam list-role-policies --role-name $SERVER_ROLE --query 'PolicyNames' --output text
}

# ---- 2. Security group ------------------------------------------------------------------------------------------------
# The server's firewall: only 80 (HTTP, for Let's Encrypt and the redirect) and 443 (HTTPS) from anywhere.
# No 22: a shell goes through Session Manager.
step2() {
  say "2. security group $SG_NAME"
  VPC="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
  SG="$(aws ec2 describe-security-groups --filters Name=group-name,Values=$SG_NAME Name=vpc-id,Values=$VPC \
    --query 'SecurityGroups[0].GroupId' --output text)"
  if [ "$SG" = None ]; then
    SG="$(aws ec2 create-security-group --group-name $SG_NAME --description "ktrg web server: HTTP and HTTPS" \
      --vpc-id "$VPC" --query GroupId --output text)"
  fi
  for port in 80 443; do
    aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port $port --cidr 0.0.0.0/0 \
      >/dev/null 2>&1 || true # already there
  done
  # Anything else that is open (for example 22) is closed.
  aws ec2 describe-security-groups --group-ids "$SG" --output json --query 'SecurityGroups[0].IpPermissions' > "$TMP/rules.json"
  python - "$TMP/rules.json" > "$TMP/extra.json" <<'PY' 2>/dev/null || echo "[]" > "$TMP/extra.json"
import json, sys
rules = json.load(open(sys.argv[1]))
keep = lambda r: r.get("IpProtocol") == "tcp" and r.get("FromPort") in (80, 443) and r.get("FromPort") == r.get("ToPort")
print(json.dumps([r for r in rules if not keep(r)]))
PY
  [ "$(cat "$TMP/extra.json")" = "[]" ] ||
    aws ec2 revoke-security-group-ingress --group-id "$SG" --ip-permissions "file://$TMP/extra.json" >/dev/null
  echo "$SG"
  aws ec2 describe-security-groups --group-ids "$SG" \
    --query 'SecurityGroups[0].IpPermissions[].[IpProtocol,FromPort,IpRanges[0].CidrIp]' --output text
}

# ---- 3. ECR repositories ----------------------------------------------------------------------------------------------
# Where the Docker images are kept. Each keeps its newest 20 images; older ones are removed by ECR.
step3() {
  say "3. ECR repositories"
  echo '{ "rules": [ { "rulePriority": 1, "description": "keep the newest 20 images",
    "selection": { "tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 20 },
    "action": { "type": "expire" } } ] }' > "$TMP/ecr-life.json"
  for repo in $REPOS; do
    aws ecr describe-repositories --repository-names $repo >/dev/null 2>&1 ||
      aws ecr create-repository --repository-name $repo --image-scanning-configuration scanOnPush=true >/dev/null
    aws ecr put-lifecycle-policy --repository-name $repo --lifecycle-policy-text "file://$TMP/ecr-life.json" >/dev/null
    echo "$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$repo"
  done
}

# ---- 4. EC2 instance + Elastic IP -------------------------------------------------------------------------------------
# t4g.small, Amazon Linux 2023 (ARM64), 30 GB gp3, the role of step 1, the security group of step 2, no key pair.
# The Elastic IP (a fixed address) is moved onto it; one is allocated when the account has none.
step4() {
  say "4. EC2 instance $NAME"
  INSTANCE="$(aws ec2 describe-instances --filters Name=tag:Name,Values=$NAME \
    Name=instance-state-name,Values=pending,running,stopping,stopped \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)"
  if [ "$INSTANCE" = None ]; then
    # The newest Amazon Linux 2023 image for ARM64, from AWS's public parameter.
    AMI="$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
      --query Parameter.Value --output text)"
    SG="$(aws ec2 describe-security-groups --filters Name=group-name,Values=$SG_NAME \
      --query 'SecurityGroups[0].GroupId' --output text)"
    INSTANCE="$(aws ec2 run-instances --image-id "$AMI" --instance-type $INSTANCE_TYPE \
      --security-group-ids "$SG" --iam-instance-profile Name=$SERVER_ROLE \
      --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":$DISK_GB,\"VolumeType\":\"gp3\",\"Encrypted\":true}}]" \
      --metadata-options HttpEndpoint=enabled,HttpTokens=required,HttpPutResponseHopLimit=2 \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
                           "ResourceType=volume,Tags=[{Key=Name,Value=$NAME}]" \
      --query 'Instances[0].InstanceId' --output text)"
    echo "launched $INSTANCE, waiting until it runs..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE"
  fi

  ALLOC="$(aws ec2 describe-addresses --query 'Addresses[0].AllocationId' --output text)"
  [ "$ALLOC" != None ] || ALLOC="$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)"
  aws ec2 associate-address --allocation-id "$ALLOC" --instance-id "$INSTANCE" --allow-reassociation >/dev/null

  aws ec2 describe-instances --instance-ids "$INSTANCE" \
    --query 'Reservations[0].Instances[0].[InstanceId,InstanceType,State.Name,PublicIpAddress]' --output text
}

# ---- 5. S3 backup bucket ----------------------------------------------------------------------------------------------
# Database dumps (db/, kept 90 days) and the uploaded files (backups/images/). Never public.
step5() {
  say "5. S3 bucket $BUCKET"
  if ! aws s3api head-bucket --bucket $BUCKET >/dev/null 2>&1; then
    aws s3api create-bucket --bucket $BUCKET --create-bucket-configuration LocationConstraint=$AWS_REGION >/dev/null
  fi
  aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo '{ "Rules": [ { "ID": "expire-db-dumps", "Filter": { "Prefix": "db/" }, "Status": "Enabled",
    "Expiration": { "Days": 90 } } ] }' > "$TMP/s3-life.json"
  aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET --lifecycle-configuration "file://$TMP/s3-life.json" >/dev/null
  aws s3 ls "s3://$BUCKET/"
}

# ---- Run --------------------------------------------------------------------------------------------------------------
case "${1:-all}" in
  all) step1; step2; step3; step4; step5; say "done" ;;
  [1-5]) "step$1" ;;
  *) echo "usage: bash deploy/aws/aws-setup.sh [1-5]"; exit 1 ;;
esac
