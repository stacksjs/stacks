#!/bin/sh

DBMS=$(grep "dbms:" ../../config/database.ts | awk '{print $2}' | tr -d "',")
SEARCH_DRIVER=$(grep "driver:" ../../config/search-engine.ts | awk '{print $2}' | tr -d "',")

sed -i '/dependencies:/a\mysql: ^8.0.3' ../../tea.yaml
