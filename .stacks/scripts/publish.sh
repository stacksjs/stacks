#!/bin/sh

DBMS=$(grep "dbms:" ../../config/database.ts | awk '{print $2}' | tr -d "',")
SEARCH_DRIVER=$(grep "driver:" ../../config/search-engine.ts | awk '{print $2}' | tr -d "',")

if [ "$DBMS" = "mysql" ]; then
  sed -i '/dependencies:/a\mysql: ^8.0.3' ../../tea.yaml
elif [ "$DBMS" = "postgres" ]; then
  sed -i '/dependencies:/a\postgresql: ^15.2.0' ../../tea.yaml
else
  # handle unexpected DBMS value
  echo "Unexpected DBMS value: $DBMS"
fi
