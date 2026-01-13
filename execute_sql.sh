#!/bin/bash
set -e

# Supabase SQL Execution Script
# Uses Supabase Management API to execute SQL directly
# Works every time without needing psql or migration tools

PROJECT_REF="opgunonejficgxztqegf"
ACCESS_TOKEN="sbp_423934cd164523d2ebca38374ef9f0f977809fae"

SQL_FILE="$1"

if [ -z "$SQL_FILE" ]; then
    echo "Usage: ./execute_sql.sh <path_to_sql_file>"
    exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found: $SQL_FILE"
    exit 1
fi

echo "Executing SQL from: $SQL_FILE"
echo ""

# Read SQL file and execute via Supabase API
SQL_CONTENT=$(cat "$SQL_FILE")

# Execute SQL using Supabase Management API
curl -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" \
  | jq .

echo ""
echo "SQL execution complete!"
