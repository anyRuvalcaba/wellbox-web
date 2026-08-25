-- WellBox sample week (Lunes–Viernes) with the option-group examples from the spec.
-- Adjust week_start_date below to an actual upcoming Monday before running.

with new_menu as (
  insert into menus (week_start_date, is_published)
  values ('2026-07-06', true)
  returning id
),
days as (
  insert into menu_days (menu_id, day_date, day_label, position)
  select id, day_date, day_label, position
  from new_menu, (values
    ('2026-07-06'::date, 'Lunes 6 de julio', 0),
    ('2026-07-07'::date, 'Martes 7 de julio', 1),
    ('2026-07-08'::date, 'Miércoles 8 de julio', 2),
    ('2026-07-09'::date, 'Jueves 9 de julio', 3),
    ('2026-07-10'::date, 'Viernes 10 de julio', 4)
  ) as d(day_date, day_label, position)
  returning id, day_date
),
dish_rows as (
  insert into dishes (menu_day_id, name, description, price, position)
  select d.id, v.name, v.description, v.price, 0
  from days d
  join (values
    ('2026-07-06'::date, 'Sandwich de Panela', 'Pan de caja con queso panela, jamón de pavo, hojas verdes, jitomate y pesto de jitomate.', 155),
    ('2026-07-07'::date, 'Waffles de Avena y Queso', 'Waffles de avena con queso cottage, plátano, fresas y un toque de monk fruit.', 135),
    ('2026-07-08'::date, 'Crepas de Espinaca', 'Crepas de espinaca rellenas de pechuga de pollo, queso panela y aguacate.', 160),
    ('2026-07-09'::date, 'Avena Café/Plátano', 'Avena en hojuelas con leche de coco, café, plátano y cacao nibs.', 130),
    ('2026-07-10'::date, 'Omelette Poblano', 'Omelette de huevo y claras con espinaca, jitomate y tocino.', 140)
  ) as v(day_date, name, description, price) on v.day_date = d.day_date
  returning id, name
),
avena_groups as (
  insert into option_groups (dish_id, label, type, is_required, position)
  select id, g.label, g.type, g.is_required, g.position
  from dish_rows, (values
    ('¿Qué frutos secos prefieres?', 'single', true, 0),
    ('¿Incluir sobre de stevia?', 'multiple', false, 1),
    ('¿Cubiertos desechables?', 'multiple', false, 2)
  ) as g(label, type, is_required, position)
  where dish_rows.name = 'Avena Café/Plátano'
  returning id, label
),
omelette_groups as (
  insert into option_groups (dish_id, label, type, is_required, position)
  select id, '¿Qué queso prefieres?', 'single', true, 0
  from dish_rows
  where dish_rows.name = 'Omelette Poblano'
  returning id, label
)
insert into option_choices (option_group_id, label, extra_cost, position)
select id, c.label, 0, c.position
from avena_groups
join (values
  ('¿Qué frutos secos prefieres?', 'Nueces', 0),
  ('¿Qué frutos secos prefieres?', 'Almendras', 1),
  ('¿Qué frutos secos prefieres?', 'Crema de almendras', 2),
  ('¿Qué frutos secos prefieres?', 'Crema de cacahuate', 3),
  ('¿Incluir sobre de stevia?', 'Sí', 0),
  ('¿Cubiertos desechables?', 'Sí', 0)
) as c(group_label, label, position) on c.group_label = avena_groups.label
union all
select id, c.label, 0, c.position
from omelette_groups
join (values
  ('Queso panela en cubitos', 0),
  ('Queso oaxaca', 1)
) as c(label, position) on true;

insert into settings (key, value) values
  ('bank_clabe', '012180015705728739'),
  ('bank_name', 'BBVA'),
  ('bank_holder', 'Ana L Ruvalcaba Llamas'),
  ('bank_reference_note', 'No olvides enviar tu comprobante aquí mismo e incluir tu nombre como referencia.'),
  ('whatsapp_number', '524498556899')
on conflict (key) do update set value = excluded.value;
