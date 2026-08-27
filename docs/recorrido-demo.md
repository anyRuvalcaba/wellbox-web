# Recorrido de la demo

> Documento operativo: qué abrir, en qué orden, qué decir. ~13 minutos.
>
> El guion de la explicación técnica está aparte, en [guion-defensa.md](guion-defensa.md).
> Este documento es solo el manejo de la demo en vivo.

---

## Antes de empezar (10 minutos antes, no durante)

**1. Comprobar que la app responde.** Abre `https://wellbox-web.vercel.app`. Si tarda o
da error, Supabase pudo haberse pausado por inactividad: entra a su dashboard y
restáuralo. Tarda unos minutos, por eso se revisa antes y no en vivo.

**2. Dar contraseña a la cuenta de clienta.** Vas a necesitar entrar como
`prueba.clienta@wellbox-test.mx`, que es la que tiene 7 pedidos con todos los estados.
En Supabase → Authentication → Users → `Add user` → `Create new user` si no recuerdas su
contraseña, o crea una clienta nueva. **Anótala.**

**3. Dejar dos ventanas abiertas y con sesión:**

| Ventana | Sesión | Pestañas listas |
|---|---|---|
| **Normal** | la clienta | `/pedido` y `/pedido/mis-pedidos` |
| **Incógnito** | el admin | `/admin/pedidos` y `/admin/menu` |

Usar incógnito para el admin evita cerrar y abrir sesión en vivo, que es donde se pierde
tiempo y se ve mal.

**4. Tener a la mano la tarjeta de prueba de Stripe:**

```
4242 4242 4242 4242    ·    cualquier fecha futura (12/34)    ·    CVC 123
```

**5. Abrir una terminal** en la carpeta del proyecto, lista para correr `npm test`.

---

## Acto 1 · La landing, sin cuenta *(1 min)*

**Abre una ventana de incógnito nueva** (sin sesión) en `wellbox-web.vercel.app`.

> "Esto es lo que ve alguien que llega por primera vez. El menú de la semana es público a
> propósito: es el escaparate del negocio, y pedir cuenta solo para mirar espantaría
> clientas."

Baja despacio: menú de la semana con precios reales, quiénes somos, cómo funciona, los
puntos de entrega.

> "Todo lo que se ve aquí sale de la base de datos, no está escrito en el código. Si
> mañana cambio el menú desde el panel, esta página cambia sola."

**Un solo apunte técnico aquí:**

> "Esta página la arma el servidor. Consulta la base y manda la página ya con los
> platillos escritos adentro — por eso no hay ninguna llamada de red desde el navegador
> para pedirlos."

---

## Acto 2 · Hacer un pedido como clienta *(4 min)*

**Ventana normal**, sesión de la clienta, en `/pedido`.

1. **Elige un platillo.** Toca "Agregar" en alguno que tenga opciones (dressing,
   cubiertos, stevia).

   > "Cada platillo puede tener grupos de opciones. Algunos son obligatorios, como elegir
   > el aderezo, y otros no, como pedir cubiertos."

2. **Señala el ícono del carrito** arriba a la izquierda, con su contador.

   > "Y algo importante: hasta este momento **nada se ha guardado en el servidor**. El
   > carrito vive solo en el navegador de mi clienta. Si cierra la pestaña, no me deja
   > basura en la base de datos."

3. **Agrega dos o tres días más.** Muestra el contador subiendo.

4. **Continuar → Resumen.** Enseña el total y los datos de entrega.

5. **Continuar a pago.** Muestra las tres formas: efectivo, transferencia, tarjeta.

   Toca **Transferencia** un momento para que se vean los datos bancarios.

   > "Estos datos salen de la base, no del código. Y solo los puede ver alguien con
   > sesión iniciada — la política de la base los tiene cerrados para el público."

6. **Vuelve a Tarjeta → Continuar al pago.** Paga con `4242 4242 4242 4242`.

   > "El número de la tarjeta se captura dentro de un recuadro que sirve Stripe. Nunca
   > llega a mi servidor, así que no lo puedo perder."

7. **Confirmación.**

   > "El pedido se creó *antes* de cobrar, a propósito. Si cobrara primero y la creación
   > fallara, mi clienta quedaría cobrada sin pedido."

---

## Acto 3 · La parte más fuerte: los permisos *(2 min)*

Este es el momento que hay que dejar respirar. No lo apures.

1. **Ve a `/pedido/mis-pedidos`.** Se ven sus pedidos, con los estados en colores:
   Pagado en verde, Cancelado y Pago fallido en rojo, Pago pendiente en neutro.

2. **Ahora la frase clave:**

   > "Esta pantalla **no filtra por usuario**. El código le pide a Postgres *todos* los
   > pedidos, sin condición. Y aun así cada clienta ve solo los suyos."

3. **Cambia a la ventana del admin → `/admin/pedidos`.** Ahí aparecen todos, de todas las
   cuentas.

   > "Misma consulta, distinto resultado. El filtro no lo hace mi código: lo hace la base
   > de datos, con una política que revisa fila por fila quién eres. Se llama RLS,
   > seguridad a nivel de fila."

4. **Remátalo:**

   > "Lo hice así porque si algún día se me olvida proteger una pantalla, la base sigue
   > rechazando la consulta. En el proyecto de referencia del curso la autorización está
   > repartida en cada endpoint, y ahí sí se escaparon tres lugares."

---

## Acto 4 · El panel de administración *(3 min)*

Sigues en la ventana del admin.

1. **`/admin/pedidos`** — ahí está el pedido que acabas de hacer, con su estado.
2. **`/admin/menu`** — el editor de la semana, el stock por platillo, y el botón de
   duplicar una semana anterior.

   > "Esto es lo que uso yo cada semana. Duplicar la semana pasada me ahorra volver a
   > capturar todo."

3. **`/admin/usuarios`** — rol y punto de entrega, cambiables desde aquí.

   > "El rol no lo puede cambiar el cliente: vive en la base y hay un disparador que
   > revierte cualquier intento de ascenderse solo."

4. **`/admin/ajustes`** — de dónde salen los datos bancarios que se vieron en el checkout.

---

## Acto 5 · El código y las pruebas *(3 min)*

1. **Corre `npm test` en la terminal, en vivo.** 43 pruebas en verde en dos segundos.

2. **Abre dos archivos, uno junto al otro:**

   - `app/pedido/page.tsx` — no dice `"use client"`, y consulta la base directamente.
   - `app/pedido/pago/PagoForm.tsx` — empieza con `"use client"`, y llama a
     `fetch("/api/orders")`.

   > "Esta es la diferencia con lo que vimos en clase. El primero corre en el servidor,
   > por eso puede hablarle a la base directo. El segundo corre en el navegador, y desde
   > ahí tiene que llamar a mi API."

3. **Abre `supabase/migrations/0003_users_roles_rls.sql`** y señala una política.

   > "Y esto es lo que estaba filtrando los pedidos hace un momento."

---

## Si algo falla

| Qué pasa | Qué haces |
|---|---|
| La app no carga o tarda muchísimo | Supabase se pausó. Restáuralo desde su dashboard. Mientras, muestra el código y las pruebas. |
| Stripe rechaza la tarjeta | Verifica que sea `4242 4242 4242 4242` con fecha futura. Si insiste, completa el pedido con **efectivo** — el flujo es el mismo hasta ahí. |
| Se cae el internet | `npm run dev` y sigue en `localhost:3000`. La app es la misma. |
| Te preguntan algo que no sabes | "Eso todavía no lo domino a fondo, lo estoy estudiando." Es una respuesta legítima y mejor que inventar. |

---

## Lo que no hay que hacer

- **No leer este documento en vivo.** Léelo dos veces antes; en la demo solo abre y habla.
- **No abrir código que no hayas visto.** Si no reconoces un archivo, no lo abras.
- **No decir "esto lo hice yo" de algo que no entiendes.** Si preguntan por una parte que
  no dominas, dilo. En un ensayo, eso es exactamente la información que te sirve recibir.
