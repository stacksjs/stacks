#!/bin/sh

DBMS=$(grep "dbms:" ../../config/database.ts | awk '{print $2}' | tr -d "',")
SEARCH_DRIVER=$(grep "driver:" ../../config/search-engine.ts | awk '{print $2}' | tr -d "',")

if [ "$DBMS" = "mysql" ]; then
  echo "  mysql: ^8.0.3" >>../../tea.yaml
elif [ "$DBMS" = "postgresq;" ]; then
  echo "  postgresql: ^15.2.0" >>../../tea.yaml
else
  echo "Unexpected DBMS value: $DBMS"
fi

if [ "$SEARCH_DRIVER" = "meilisearch" ]; then
  echo "  meilisearch: ^0.1.1" >>../../tea.yaml
else
  echo "Unexpected SEARCH DRIVER value: $SEARCH_DRIVER"
fi
