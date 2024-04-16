import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { AutoScalingGroup, GroupMetrics } from 'aws-cdk-lib/aws-autoscaling';
import { Alarm, ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { InstanceClass, InstanceSize, InstanceType, MachineImage, SubnetType, UserData, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';

interface StagingProps {
  /**
   * ロードバランサからEC2インスタンスへヘルスチェックを行うときのアクセス先のパス
   */
  healthCheckPath: string;
}

export class AlbPathBasedRoutingPracticeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const stage : "dev" | "prod" = this.node.tryGetContext('stage');
    const context : StagingProps = this.node.tryGetContext(stage);

    const vpc = new Vpc(this, 'Vpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'load-balancer',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'application',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const healthCheckPath = context.healthCheckPath;
    const alb = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
    });

    // TODO: 以下のURLを参考に、ALBの前段にCloudFrontを噛まして、ALBへ直接アクセスすると403を返すように設定する
    // https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html

    const listener = alb.addListener('Listener', { port: 80 });
    const services = [
      {
        category: 'Products',
        path: '/products*',
      },
      {
        category: 'Customers',
        path: '/customers*',
      },
      {
        category: 'Others',
        path: null,
      },
    ];

    const userData = UserData.forLinux({
      // assets/install.shでシェバンを書いているため、2重にならないようこちらを無効化する
      shebang: '',
    });
    const userDataScript = readFileSync('assets/install.sh', 'utf-8').toString();
    userData.addCommands(userDataScript);

    for (let index = 0; index < services.length; index++) {
      const service = services[index];
      const target = new AutoScalingGroup(this, `${service.category}InstanceGroup`, {
        vpc,
        autoScalingGroupName: `asg-${service.category.toLowerCase()}`,
        minCapacity: 1,
        maxCapacity: 4,
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
        machineImage: MachineImage.latestAmazonLinux2(),
        userData: userData,
        ssmSessionPermissions: true,
        groupMetrics: [
          GroupMetrics.all(),
        ]
      });

      if (service.path != null) {
        const tg = listener.addTargets(`${service.category}InstanceTarget`, {
          targetGroupName: `tg-${service.category.toLowerCase()}`,
          port: 80,
          targets: [target],
          conditions: [
            ListenerCondition.pathPatterns([
              service.path,
            ])
          ],
          priority: index + 1,
          healthCheck: {
            path: healthCheckPath,
          },
        });
        const alarm = new Alarm(this, `${service.category}RequestCountAlarm`, {
          alarmName: `${service.category.toLowerCase()}-request-count-alarm`,
          metric: new Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: {
              'TargetGroup': tg.targetGroupFullName,
              'LoadBalancer': alb.loadBalancerFullName,
            },
            statistic: 'Sum',
            period: Duration.minutes(1),
          }),
          threshold: 10,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
      } else {
        const tg = listener.addTargets(`${service.category}InstanceTarget`, {
          targetGroupName: `tg-${service.category.toLowerCase()}`,
          port: 80,
          targets: [target],
          healthCheck: {
            path: healthCheckPath,
          },
        });
        const alarm = new Alarm(this, `${service.category}RequestCountAlarm`, {
          alarmName: `${service.category.toLowerCase()}-request-count-alarm`,
          metric: new Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: {
              'TargetGroup': tg.targetGroupFullName,
              'LoadBalancer': alb.loadBalancerFullName,
            },
            statistic: 'Sum',
            period: Duration.minutes(1),
          }),
          threshold: 10,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
      }
    }

    new CfnOutput(this, 'LoadBalancerDnsName', {
      value: alb.loadBalancerDnsName,
    });
  }
}
