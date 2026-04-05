#!/bin/bash
echo "Trusting RPX certificate for domains: stacks.localhost, api.stacks.localhost, docs.stacks.localhost, dashboard.stacks.localhost"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "undefined/.stacks/ssl/stacks.localhost.ca.crt"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "undefined/.stacks/ssl/stacks.localhost.crt"
echo "Certificates trusted! Please restart your browser."
echo "If you still see certificate warnings, type 'thisisunsafe' on the warning page in Chrome/Arc browsers."
