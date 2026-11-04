#!/usr/bin/env bash
# CloudWatch alarms for the ktrg server (設計書 2.1: CPU / memory / disk above 80% → alert). Run from the project
# folder in Git Bash, after aws-setup.sh, and after server-setup.sh has started the CloudWatch agent on the server:
#
#   bash deploy/aws/alarms-setup.sh you@example.com     # the address that gets the alerts
#   bash deploy/aws/alarms-setup.sh                     # update the alarms only (e.g. after replacing the server)
#
# AWS emails a confirmation link to a new address: the alerts only start once it is clicked. Safe to run again.
#
#   alarm                 when                                   then
#   ktrg-cpu-80           CPU above 80% for 10 minutes           email
#   ktrg-memory-80        memory above 80% for 10 minutes        email
#   ktrg-disk-80          disk above 80% for 5 minutes           email
#   ktrg-status-recover   AWS's hardware check fails 2 minutes   AWS moves the server to healthy hardware + email
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-ktrg}"
export AWS_REGION=ap-northeast-3
export MSYS_NO_PATHCONV=1
ACCOUNT=712723095627
NAME=ktrg-cms                                        # the server's Name tag
TOPIC=arn:aws:sns:$AWS_REGION:$ACCOUNT:ktrg-alerts   # SNS: where alarms send their message

[ "$(aws sts get-caller-identity --query Account --output text)" = "$ACCOUNT" ] || { echo "wrong AWS account"; exit 1; }

echo "== 1. SNS topic + email"
# The topic is the "mailing list"; a subscription is one address on it.
aws sns create-topic --name ktrg-alerts >/dev/null   # does nothing when it exists
if [ -n "${1:-}" ]; then
  aws sns subscribe --topic-arn $TOPIC --protocol email --notification-endpoint "$1" >/dev/null
  echo "confirmation email sent to $1: click the link in it"
fi
aws sns list-subscriptions-by-topic --topic-arn $TOPIC --query 'Subscriptions[].[Endpoint,SubscriptionArn]' --output text

echo "== 2. the server"
INSTANCE="$(aws ec2 describe-instances --filters Name=tag:Name,Values=$NAME Name=instance-state-name,Values=running \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
[ "$INSTANCE" != None ] || { echo "no running server named $NAME"; exit 1; }
echo "$INSTANCE"

echo "== 3. alarms"
# alarm <name> <namespace> <metric> <statistic> <period s> <periods> <threshold> <dimensions> <actions...>
# An alarm fires when <periods> periods in a row are above <threshold>; OK is sent too when it is back to normal.
alarm() {
  local name=$1 ns=$2 metric=$3 stat=$4 period=$5 periods=$6 threshold=$7 dims=$8; shift 8
  aws cloudwatch put-metric-alarm --alarm-name "$name" --namespace "$ns" --metric-name "$metric" \
    --statistic "$stat" --period "$period" --evaluation-periods "$periods" --threshold "$threshold" \
    --comparison-operator GreaterThanThreshold --dimensions $dims \
    --alarm-actions "$@" --ok-actions $TOPIC
}
alarm ktrg-cpu-80    AWS/EC2 CPUUtilization   Average 300 2 80 "Name=InstanceId,Value=$INSTANCE" $TOPIC
alarm ktrg-memory-80 ktrg    mem_used_percent Average 300 2 80 "Name=InstanceId,Value=$INSTANCE" $TOPIC
# The agent reports disk use with the path and file system as well: the alarm must name all three.
alarm ktrg-disk-80   ktrg    disk_used_percent Average 300 1 80 \
  "Name=InstanceId,Value=$INSTANCE Name=path,Value=/ Name=fstype,Value=xfs" $TOPIC
# StatusCheckFailed_System = a problem with AWS's hardware under the server, not with the server itself.
# "recover" moves the same server (same ID, IP, disk) to other hardware.
alarm ktrg-status-recover AWS/EC2 StatusCheckFailed_System Maximum 60 2 0 "Name=InstanceId,Value=$INSTANCE" \
  arn:aws:automate:$AWS_REGION:ec2:recover $TOPIC

aws cloudwatch describe-alarms --alarm-name-prefix ktrg- \
  --query 'MetricAlarms[].[AlarmName,StateValue,Dimensions[0].Value]' --output text
