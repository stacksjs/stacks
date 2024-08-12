export const servers = {
  app: {
    name: 'app-server-1',
    domain: 'stacksjs.org',
    instanceType: 't3.micro',
    // This script is executed on the server after the server is provisioned
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

  useLoadBalancer: true,
}
