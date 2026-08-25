-- T-003 (seguimiento) — Dos funciones sin `set search_path`.
--
-- El linter de Supabase marcó day_label_es() y estados_que_consumen_stock() sin ese
-- ajuste. day_label_es() lo arrastraba desde 0006: al copiar el patrón para
-- estados_que_consumen_stock() se copió también el descuido.
--
-- Sin search_path fijo, una sesión que manipule su propio search_path podría hacer que
-- una referencia sin calificar resuelva a una tabla o función de otro esquema en vez de
-- la de public. Ninguna de las dos consulta tablas —day_label_es arma texto a partir de
-- arreglos literales, estados_que_consumen_stock devuelve un arreglo fijo— así que el
-- riesgo práctico era bajo. Se corrige de todas formas: es gratis y es la regla que ya
-- se aplica en el resto de las funciones del proyecto.

create or replace function public.day_label_es(fecha date)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(left(dia, 1)) || substr(dia, 2) || ', ' ||
         extract(day from fecha)::int::text || ' de ' || mes
  from (
    select
      (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])
        [extract(isodow from fecha)::int] as dia,
      (array['enero','febrero','marzo','abril','mayo','junio',
             'julio','agosto','septiembre','octubre','noviembre','diciembre'])
        [extract(month from fecha)::int] as mes
  ) partes;
$$;

create or replace function public.estados_que_consumen_stock()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['pending', 'transfer_uploaded', 'confirmed', 'paid'];
$$;
