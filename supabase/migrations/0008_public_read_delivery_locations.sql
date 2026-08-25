-- T-002 (seguimiento) — La pantalla de registro necesita listar los puntos de entrega,
-- y ahí todavía no hay sesión.
--
-- Se abre solo la lectura de los puntos ACTIVOS. No es información sensible: es dónde
-- entrega WellBox, que cualquier clienta potencial necesita saber antes de registrarse.
-- Los inactivos siguen ocultos, y escribirlos sigue exigiendo rol admin.

drop policy "authenticated read delivery locations" on delivery_locations;

create policy "anyone can read active delivery locations" on delivery_locations
  for select using (is_active);
