import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { InstanceClass, InstanceSize, InstanceType, MachineImage, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface StagingProps {
  /**
   * EC2インスタンスを立ち上げる際に使用するゴールデンイメージ
   * @see [healthCheckPath] にアクセスしたら200を返すよう設定したAMIを使用してください
   */
  amiId: string;
  /**
   * ロードバランサからEC2インスタンスへヘルスチェックを行うときのアクセス先のパス
   */
  healthCheckPath: string;
}

export class AlbPassBasedRoutingPracticeStack extends Stack {
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
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const amiMap = {
      // /healthcheck.html にアクセスしたら200を返すよう設定したAMIを作成して指定してください。
      'us-east-1': context.amiId
    };
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

    for (let index = 0; index < services.length; index++) {
      const service = services[index];
      const target = new AutoScalingGroup(this, `${service.category}InstanceGroup`, {
        vpc,
        autoScalingGroupName: `asg-${service.category.toLowerCase()}`,
        minCapacity: 1,
        maxCapacity: 1,
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
        machineImage: MachineImage.genericLinux(amiMap),
      });

      if (service.path != null) {
        listener.addTargets(`${service.category}InstanceTarget`, {
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
      } else {
        listener.addTargets(`${service.category}InstanceTarget`, {
          targetGroupName: `tg-${service.category.toLowerCase()}`,
          port: 80,
          targets: [target],
          healthCheck: {
            path: healthCheckPath,
          },
        });
      }
    }

    new CfnOutput(this, 'LoadBalancerDnsName', {
      value: alb.loadBalancerDnsName,
    });
  }
}
