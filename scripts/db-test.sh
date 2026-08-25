#!/usr/bin/env bash
# Levanta una base desechable, le corre todas las migraciones y la deja lista para las
# pruebas. No toca Supabase.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
DB="${WELLBOX_TEST_DB:-wellbox_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ recreando base '$DB'"
psql -q -d postgres -c "drop database if exists $DB;"
psql -q -d postgres -c "create database $DB;"

run() {
  echo "→ $1"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/$1"
}

run supabase/test/bootstrap.sql
for m in "$ROOT"/supabase/migrations/*.sql; do
  run "supabase/migrations/$(basename "$m")"
done
run supabase/test/grants.sql

echo "✓ base '$DB' lista"
