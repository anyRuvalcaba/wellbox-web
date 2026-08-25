#!/usr/bin/env bash
# CA-8 — Dos pedidos simultáneos por la última caja: solo uno debe pasar.
#
# No se puede probar desde un solo archivo SQL: hacen falta DOS conexiones reales
# compitiendo. Con una sola, las operaciones se ejecutan en orden y el candado nunca
# tiene que hacer su trabajo.
set -uo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
DB="${WELLBOX_TEST_DB:-wellbox_test}"
PLATILLO='0a0a0a0a-0000-0000-0000-000000000001'

# Deja el platillo con exactamente 1 caja libre: tope 2, y ya hay 1 pedido pagado.
psql -q -d "$DB" -c "update dishes set stock = 2 where id = '$PLATILLO';" >/dev/null

DISPONIBLE=$(psql -tA -d "$DB" -c "select disponible from dish_availability where dish_id = '$PLATILLO';")
echo "→ disponible antes: $DISPONIBLE"
if [ "$DISPONIBLE" != "1" ]; then
  echo "✗ la prueba necesita exactamente 1 disponible, hay $DISPONIBLE"
  exit 1
fi

# Cada clienta intenta llevarse esa última caja. La primera toma el candado sobre la fila
# del platillo y lo retiene mientras inserta; la segunda espera ahí, y cuando por fin
# entra, ya ve el pedido de la primera.
intentar() {
  local nombre="$1" usuario="$2" pedido="$3" retraso="$4"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" >/tmp/wellbox_conc_$nombre.log 2>&1 <<EOSQL
begin;
  select pg_sleep($retraso);
  select public.verificar_stock('$PLATILLO', 1);
  insert into orders (id, customer_name, customer_phone, total, user_id, payment_status)
    values ('$pedido', '$nombre', '449', 100, '$usuario', 'pending');
  insert into order_items (order_id, dish_id, dish_name, day_label, day_date, unit_price, quantity)
    values ('$pedido', '$PLATILLO', 'Bowl Limitado', 'Lunes', '2026-11-02', 100, 1);
  select pg_sleep(0.6);
commit;
EOSQL
  echo $? > /tmp/wellbox_conc_$nombre.code
}

intentar ana  '11111111-1111-1111-1111-111111111111' '0c0c0c0c-0000-0000-0000-000000000001' 0   &
intentar beto '22222222-2222-2222-2222-222222222222' '0c0c0c0c-0000-0000-0000-000000000002' 0.1 &
wait

CODIGO_ANA=$(cat /tmp/wellbox_conc_ana.code)
CODIGO_BETO=$(cat /tmp/wellbox_conc_beto.code)
echo "→ Ana:  $([ "$CODIGO_ANA" = "0" ] && echo 'pasó' || echo 'rechazada')"
echo "→ Beto: $([ "$CODIGO_BETO" = "0" ] && echo 'pasó' || echo 'rechazada')"

EXITOSOS=$(( (CODIGO_ANA == 0 ? 1 : 0) + (CODIGO_BETO == 0 ? 1 : 0) ))
VENDIDAS=$(psql -tA -d "$DB" -c "select reservado from dish_availability where dish_id = '$PLATILLO';")

echo "→ pedidos que pasaron: $EXITOSOS"
echo "→ cajas comprometidas: $VENDIDAS de 2"

if [ "$EXITOSOS" -ne 1 ]; then
  echo "✗ CA-8 FALLA: pasaron $EXITOSOS pedidos por la última caja, debía pasar exactamente 1"
  grep -h "ERROR" /tmp/wellbox_conc_*.log | head -2
  exit 1
fi
if [ "$VENDIDAS" -gt 2 ]; then
  echo "✗ CA-8 FALLA: se comprometieron $VENDIDAS cajas de un tope de 2 — sobreventa"
  exit 1
fi

echo "  ✓ CA-8 OK — dos pedidos simultáneos por la última caja y solo uno pasó"
grep -h "ERROR" /tmp/wellbox_conc_*.log | head -1 | sed 's/^/    rechazo: /'
