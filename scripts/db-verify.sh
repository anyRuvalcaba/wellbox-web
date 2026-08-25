#!/usr/bin/env bash
# Recrea la base de pruebas y verifica los criterios de seguridad del spec T-001.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT/scripts/db-test.sh" >/dev/null
echo "→ verificando políticas RLS"
psql -q -v ON_ERROR_STOP=1 -d "${WELLBOX_TEST_DB:-wellbox_test}" \
  -f "$ROOT/supabase/test/verify-rls.sql" 2>&1 | sed 's/^psql:.*NOTICE:  /  ✓ /'
echo "✓ todos los controles de seguridad pasan"
