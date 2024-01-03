import { Stack, StackProps } from 'aws-cdk-lib';
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

    const productsInstanceGroup = new AutoScalingGroup(this, 'ProductsInstanceGroup', {
      vpc,
      autoScalingGroupName: 'asg-prodcuts',
      minCapacity: 1,
      maxCapacity: 1,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.genericLinux(amiMap),
    });
    const customersInstanceGroup = new AutoScalingGroup(this, 'CustomersInstanceGroup', {
      vpc,
      autoScalingGroupName: 'asg-customers',
      minCapacity: 1,
      maxCapacity: 1,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.genericLinux(amiMap),
    });
    const othersInstanceGroup = new AutoScalingGroup(this, 'OthersInstanceGroup', {
      vpc,
      autoScalingGroupName: 'asg-others',
      minCapacity: 1,
      maxCapacity: 1,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.genericLinux(amiMap),
    });

    const alb = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
    });
    const listener = alb.addListener('Listener', { port: 80 });
    listener.addTargets('ProductsInstanceTarget', {
      targetGroupName: 'tg-products',
      port: 80,
      targets: [productsInstanceGroup],
      conditions: [
        ListenerCondition.pathPatterns([
          '/products*'
        ])
      ],
      priority: 1,
      healthCheck: {
        path: '/healthcheck.html'
      },
    });
    listener.addTargets('CustomersInstanceTarget', {
      targetGroupName: 'tg-customers',
      port: 80,
      targets: [customersInstanceGroup],
      conditions: [
        ListenerCondition.pathPatterns([
          '/customers*',
        ])
      ],
      priority: 2,
      healthCheck: {
        path: '/healthcheck.html'
      },
    });
    listener.addTargets('OthersInstanceTarget', {
      targetGroupName: 'tg-others',
      port: 80,
      targets: [othersInstanceGroup],
      healthCheck: {
        path: '/healthcheck.html'
      },
    });
  }
}
