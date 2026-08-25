#!/usr/bin/env bash
# Recrea la base de pruebas y verifica los criterios de seguridad del spec T-001.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT/scripts/db-test.sh" >/dev/null
echo "→ verificando políticas RLS y duplicación de menú"
for suite in verify-rls verify-menu verify-perfil verify-stock; do
  psql -q -v ON_ERROR_STOP=1 -d "${WELLBOX_TEST_DB:-wellbox_test}" \
    -f "$ROOT/supabase/test/$suite.sql" 2>&1 | sed 's/^psql:.*NOTICE:  /  ✓ /'
done
# La concurrencia necesita dos conexiones reales compitiendo: con un solo archivo SQL
# las operaciones van en orden y el candado nunca tiene que hacer su trabajo.
"$ROOT/scripts/db-test-concurrencia.sh" | sed 's/^→/  →/'

echo "✓ todas las verificaciones pasan"
