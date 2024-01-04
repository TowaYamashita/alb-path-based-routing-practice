import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { InstanceClass, InstanceSize, InstanceType, MachineImage, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export class AlbPassBasedRoutingPracticeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
      'us-east-1': 'ami-081b9f3fb29eed16e'
    };
    const healthCheckPath = '/healthcheck.html';
    const alb = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
    });
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
