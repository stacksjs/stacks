// async manageSearchEngine() {
//   const vpc = this.vpc

//   // Security Group
//   const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
//     vpc,
//     allowAllOutbound: true,
//     securityGroupName: `${this.appName}-${appEnv}-bastion-sg`,
//   })

//   const opensearchSecurityGroup = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
//     vpc,
//     securityGroupName: `${this.appName}-${appEnv}-opensearch-sg`,
//   })

//   opensearchSecurityGroup.addIngressRule(bastionSecurityGroup, ec2.Port.tcp(443))

//   // Service-linked role that Amazon OpenSearch Service will use
//   const iamClient = new IAMClient({})
//   const response = await iamClient.send(
//     new ListRolesCommand({
//       PathPrefix: '/aws-service-role/opensearchservice.amazonaws.com/',
//     }),
//   )

//   // Only if the role for OpenSearch Service doesn't exist, it will be created.
//   if (response.Roles && response.Roles?.length === 0) {
//     new iam.CfnServiceLinkedRole(this, 'OpenSearchServiceLinkedRole', {
//       awsServiceName: 'es.amazonaws.com',
//     })
//   }

//   // Bastion host to access Opensearch Dashboards
//   new ec2.BastionHostLinux(this, 'BastionHost', {
//     vpc,
//     securityGroup: bastionSecurityGroup,
//     machineImage: ec2.MachineImage.latestAmazonLinux2023(),
//     blockDevices: [
//       {
//         deviceName: '/dev/xvda',
//         volume: ec2.BlockDeviceVolume.ebs(10, {
//           encrypted: true,
//         }),
//       },
//     ],
//   })

//   // OpenSearch domain
//   const domain = new opensearch.Domain(this, 'OpenSearchDomain', {
//     version: opensearch.EngineVersion.OPENSEARCH_2_9,
//     nodeToNodeEncryption: true,
//     enforceHttps: true,
//     encryptionAtRest: {
//       enabled: true,
//     },
//     vpc,
//     // unsure if there are "better" ways to do this
//     vpcSubnets: [
//       { subnetGroupName: `${this.appName}-${appEnv}-private-subnet-1` },
//       { subnetGroupName: `${this.appName}-${appEnv}-private-subnet-2` },
//     ],

//     capacity: {
//       masterNodes: 2,
//       dataNodes: 2,
//       multiAzWithStandbyEnabled: true,
//     },
//     ebs: {
//       volumeSize: 10,
//       volumeType: ec2.EbsDeviceVolumeType.GP3, // or opensearch.EbsVolumeType.IO1
//     },
//     removalPolicy: RemovalPolicy.DESTROY,
//     zoneAwareness: {
//       enabled: true,
//       availabilityZoneCount: 2,
//     },
//     securityGroups: [opensearchSecurityGroup],
//   })

//   domain.addAccessPolicies(
//     new iam.PolicyStatement({
//       principals: [new iam.AnyPrincipal()],
//       actions: ['es:ESHttp*'],
//       resources: [`${domain.domainArn}/*`],
//     }),
//   )

//   // // Lambda
//   // const dataIndexFunction = PythonFunction(this, 'DataIndex', {
//   //   runtime: lambda.Runtime.PYTHON_3_10,
//   //   entry: 'lambda',
//   //   vpc,
//   //   environment: {
//   //     OPENSEARCH_HOST: domain.domainEndpoint,
//   //   },
//   // })

//   // domain.connections.allowFrom(dataIndexFunction, Port.tcp(443))

//   // Outputs
//   new Output(this, 'OpenSearchDomainHost', {
//     value: domain.domainEndpoint,
//   })

//   // new Output(this, 'IndexingFunctionName', {
//   //   value: dataIndexFunction.functionName,
//   // })
// }
