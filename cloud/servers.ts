export const servers = {
  type: 'aws',
  useLoadBalancer: true,

  app: {
    name: 'app-server-1',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'app',
    size: 't3.micro',
    diskSize: 20, // in GB
    privateNetwork: 'vpc-123456789', // or create new
    subnet: 'subnet-123456789',
    serverOS: 'ubuntu-20-lts-x86_64',
    bunVersion: '1.1.26',
    database: 'sqlite',
    databaseName: 'stacks',
    // This is the "post provision recipe" that is executed on the server after the server is provisioned
    userData: `#!/bin/bash
      echo "Hello World from App Server 1!" > /tmp/test.txt
      chown ubuntu:ubuntu /tmp/test.txt
    `,
  },

  app2: {
    name: 'app-server-2',
    domain: 'stacksjs.org',
    instanceType: 't3.micro',
    userData: `#!/bin/bash
      echo "Hello World from App Server 2!" > /tmp/test.txt
      chown ubuntu:ubuntu /tmp/test.txt
    `,
  },

  web: {
    name: 'web-server',
    domain: 'ow3.org',
    region: 'us-east-1',
    type: 'web',
    size: 't3.micro',
    diskSize: 20, // in GB
    privateNetwork: 'vpc-123456789', // or create new
    subnet: 'subnet-123456789',
    serverOS: 'ubuntu-20-lts-x86_64',
    bunVersion: '1.1.26',
  },

  // worker: {
  //   name: 'worker-server',
  //   domain: 'stacksjs.org',
  //   region: 'us-east-1',
  //   type: 'worker',
  //   size: 't3.micro',
  //   diskSize: 20, // in GB
  //   privateNetwork: 'vpc-123456789', // or create new
  //   subnet: 'subnet-123456789',
  //   serverOS: 'ubuntu-20-lts-x86_64',
  //   bunVersion: '1.1.26',
  // },

  cache: {
    // redis or memcached
    name: 'cache-server',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'cache',
    size: 't3.micro',
    diskSize: 20, // in GB
    privateNetwork: 'vpc-123456789', // or create new
    subnet: 'subnet-123456789',
    serverOS: 'ubuntu-20-lts-x86_64',
    bunVersion: '1.1.26',
  },

  // search: {
  //   name: 'search-server',
  //   domain: 'stacksjs.org',
  //   region: 'us-east-1',
  //   type: 'meilisearch',
  //   size: 't3.micro',
  //   diskSize: 20, // in GB
  //   privateNetwork: 'vpc-123456789', // or create new
  //   subnet: 'subnet-123456789',
  //   serverOS: 'ubuntu-20-lts-x86_64',
  // },
}
