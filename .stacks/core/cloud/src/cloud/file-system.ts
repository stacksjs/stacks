// manageFileSystem() {
//   this.storage.fileSystem = new efs.FileSystem(this, 'FileSystem', {
//     fileSystemName: `${this.appName}-${appEnv}-efs`,
//     vpc: this.vpc,
//     removalPolicy: RemovalPolicy.DESTROY,
//     lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
//     performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
//     throughputMode: efs.ThroughputMode.BURSTING,
//     enableAutomaticBackups: true, // TODO: ensure this is documented
//     encrypted: true,
//   })

//   const role = new iam.Role(this, 'JumpBoxInstanceRole', {
//     assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
//     managedPolicies: [
//       iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
//       iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
//     ],
//   })

//   // this instance needs to be created once to mount the EFS & clone the Stacks repo
//   this.ec2Instance = new ec2.Instance(this, 'JumpBox', {
//     vpc: this.vpc,
//     instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
//     machineImage: new ec2.AmazonLinuxImage(),
//     role,
//     userData: ec2.UserData.custom(`
//     #!/bin/bash
//     yum update -y
//     yum install -y amazon-efs-utils
//     yum install -y git
//     yum install -y https://s3.us-east-1.amazonaws.com/amazon-ssm-us-east-1/latest/linux_amd64/amazon-ssm-agent.rpm
//     mkdir /mnt/efs
//     mount -t efs ${this.storage.fileSystem.fileSystemId}:/ /mnt/efs
//     git clone https://github.com/stacksjs/stacks.git /mnt/efs
//   `),
//   })

//   this.storage.accessPoint = new efs.AccessPoint(this, 'FileSystemAccessPoint', {
//     fileSystem: this.storage.fileSystem,
//     path: '/',
//     posixUser: {
//       uid: '1000',
//       gid: '1000',
//     },
//   })
// }

//   if (this.ec2Instance?.instanceId) {
//   new Output(this, 'JumpBoxInstanceId', {
//     value: this.ec2Instance.instanceId,
//     description: 'The ID of the EC2 instance that can be used to SSH into the Stacks Cloud.',
//   })
// }
