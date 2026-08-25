# Banco de argumentos para la defensa técnica

> Documento vivo. Se va llenando conforme se toman decisiones, **en el momento en que se
> toman** — reconstruirlas de memoria semanas después es cómo se llega a la defensa
> diciendo "no me acuerdo por qué".
>
> No es un guion para memorizar. Son los argumentos con su evidencia, para poder
> explicarlos con tus palabras. La rúbrica evalúa comprensión, no recitación.

---

## 1. Por qué este stack y no el del curso

**La pregunta que van a hacer:** "¿por qué Next.js y Supabase en vez de React + Express +
MongoDB como el resto del grupo?"

WellBox es un negocio real que va a usar esto. Los datos son profundamente relacionales:
un menú tiene días, cada día tiene platillos, cada platillo tiene grupos de opciones, y
cada grupo tiene alternativas con costo extra. Un pedido referencia platillos que pueden
cambiar o desaparecer después.

Postgres da integridad referencial y restricciones que la base hace cumplir sola. En
MongoDB, mantener esa consistencia es trabajo de la aplicación — y lo que la aplicación
tiene que recordar hacer, algún día se le olvida.

**El contraargumento honesto:** para un catálogo plano de productos, MongoDB habría
estado bien. La elección responde a la forma de estos datos, no a que un motor sea mejor
que el otro.

---

## 2. Por qué TypeScript

El checkout calcula dinero contra un esquema de nueve tablas relacionadas. Los tipos
generados del esquema hacen que una consulta que no cuadra con la base sea un error de
compilación, no una sorpresa en producción.

**Evidencia concreta:** al agregar `user_id` a `orders` y la tabla `profiles`, el
compilador marcó cada lugar que había que actualizar. Sin eso, se descubre cuando una
clienta no puede pagar.

---

## 3. La autorización vive en la base, no en cada endpoint

**Este es el argumento más fuerte del proyecto.**

El proyecto del curso pone la autorización en cada controlador. En
`paymentMethodController.js` lo hicieron bien en tres funciones y se les fue en tres:

```js
const deletePaymentMethod = async (req, res, next) => {
  const { id } = req.params;
  const paymentMethod = await PaymentMethod.findByIdAndDelete(id);
```

Busca por id y borra, sin comprobar que ese método de pago sea de quien lo pide.
Cualquier persona con sesión puede borrar la tarjeta de otra. Lo mismo en
`updatePaymentMethod`, que lee la fila y nunca compara contra el usuario del token. Y
`createPaymentMethod` toma el `user` del body, así que se puede crear un método de pago a
nombre de alguien más.

**El punto no es que lo hicieran mal.** Es que con la autorización repartida en seis
funciones, acertarle a todas es cuestión de suerte. Con veinte endpoints, la probabilidad
de que se escape uno tiende a uno.

Y el remate: su plan de pruebas tiene **20 pruebas de PaymentMethods, todas pasando**, y
ninguna lo detectó — porque nadie escribió "la usuaria B no puede borrar la tarjeta de la
usuaria A".

En WellBox la regla no vive en seis funciones, vive en la tabla:

```sql
using (user_id = auth.uid())
```

Un `delete` que no cumpla eso borra cero filas, sin importar qué endpoint lo llame ni si
se me olvidó proteger ese endpoint.

**Demostración en vivo:** entrar como clienta a `/pedido/mis-pedidos` — ve cero pedidos
aunque la base tenga tres. La consulta de esa pantalla **no filtra por usuario**: le pide
a Postgres todos los pedidos. El filtro lo hace la política. Luego cambiar el rol de esa
misma cuenta a admin y ver los tres.

---

## 4. Defensa en profundidad: tres capas

1. **`proxy.ts`** — chequeo optimista, para no renderizar pantallas que la persona no va
   a poder usar. La documentación de Next 16 es explícita en que esto no debe ser la
   única defensa.
2. **`lib/auth.ts` (Data Access Layer)** — valida la sesión en el servidor, junto al
   acceso a datos. Se llama en cada página, **no solo en el layout**: por Partial
   Rendering los layouts no se re-renderizan al navegar entre rutas hijas, así que un
   chequeo ahí no se repite en cada cambio de ruta.
3. **RLS en Postgres** — la que de verdad cuenta. Si las dos primeras fallaran, la base
   sigue rechazando la consulta.

---

## 5. Nunca confiar en el cliente para el dinero

`createOrder` del proyecto del curso lee `totalPrice` de `req.body`. Quien controle el
navegador puede pedir cualquier cosa al precio que quiera.

`app/api/orders/route.ts` de WellBox recalcula todo contra la base: busca cada platillo,
sus opciones y sus costos extra, y arma el total del lado del servidor. Lo mismo con la
identidad: el `user_id` sale del token, nunca del body. La política de inserción exige
`user_id = auth.uid()`, así que aunque el endpoint se equivocara, la base rechaza.

---

## 6. Datos de tarjeta: la decisión es no tenerlos

El modelo del curso guarda `cardNumber` y `cvv` en texto plano. **PCI-DSS prohíbe
almacenar el CVV**, incluso cifrado, incluso un instante. Ellos detectaron la mitad del
problema (el bug IT-PAY-012 quitó el CVV de la *respuesta*), pero se sigue guardando.

WellBox no pide el número completo. Sin pasarela de pago, ese número no tiene nada que
hacer en el servidor: pedirlo solo crea riesgo a cambio de nada. Se guarda marca y
últimos cuatro dígitos, que es lo único necesario para que la clienta reconozca su
tarjeta.

**Una columna que no existe no se puede llenar por accidente.**

---

## 7. Puntos de entrega fijos en vez de direcciones libres

El curso modela `Address` con calle, ciudad, estado, código postal, país y tipo. WellBox
entrega en tres oficinas conocidas: Poder Judicial (Edificio Penal), Poder Judicial
(Edificio Sur) y Semtech (Monte Blanco).

Modelar direcciones libres habría traído validación, errores de captura y ambigüedad de
cobertura, para un negocio que no los tiene. Con puntos fijos, además, sale gratis el
reporte de cuántas clientas y cuántas entregas hay por punto.

**Adaptar el modelo al negocio, no el negocio al modelo del curso.**

---

## 8. Instantáneas en los pedidos

`order_items` guarda `dish_name`, `day_label` y `unit_price` copiados, no solo la
referencia. Si un platillo cambia de precio o se borra, los pedidos anteriores siguen
diciendo lo que la clienta realmente pidió y pagó.

Mismo criterio en `orders.delivery_location_name` y `payment_method_label`.

**La regla:** un registro histórico no puede depender de datos que siguen cambiando.

---

## 9. Bugs que encontramos, y qué enseñó cada uno

> "Si tuvieras que rehacer el proyecto, ¿qué cambiarías?" — la rúbrica dice que esperan
> algo real que hayas aprendido. Esta sección es la respuesta.

### El trigger que se bloqueaba a sí mismo

`protect_role()` revertía cualquier cambio de rol cuando `is_admin()` era falso. En
contexto de servidor `auth.uid()` es nulo, así que `is_admin()` daba falso siempre — y
**no existía forma de crear la primera cuenta admin**. El trigger se cerraba a sí mismo.

Lo detectó el entorno de pruebas local antes de tocar la base real.

### Las cuentas que ya existían se quedaban sin perfil

El trigger de alta se dispara al *insertar* en `auth.users`. La cuenta del equipo ya
estaba insertada, así que no le habría creado perfil: rol nulo, sin acceso al panel, y un
`update` que reporta éxito sin cambiar nada. Se agregó un relleno para las cuentas
previas.

**Lección:** un trigger `after insert` no arregla el pasado.

### `revoke from public` ≠ `revoke from anon`

El linter de Supabase marcó cuatro funciones como llamables sin sesión. Revocamos de
`PUBLIC` y dos siguieron marcadas. Causa: Supabase tiene `alter default privileges ...
grant execute on functions to anon`, así que cada función nace con un permiso
**explícito** a nombre de `anon`, además del implícito de `PUBLIC`. Revocar de `PUBLIC`
no toca el explícito.

**Y el entorno local no lo detectó** porque no reproducía ese `alter default privileges`.
Se agregó, la prueba falló igual que en Supabase, y después se corrigió — ese es el orden
correcto: primero reproducir el fallo, luego arreglarlo.

### Cerrar permisos rompió un rollback

`POST /api/orders` inserta el pedido y sus renglones por separado; si algo fallaba,
borraba el pedido. Al cerrar las políticas, ya nadie puede borrar pedidos — así que ese
borrado empezó a fallar **en silencio**, dejando pedidos huérfanos.

Parche: una función acotada que solo borra un pedido propio y sin renglones. **La
solución real es que crear el pedido sea una sola transacción**, y está registrada como
deuda técnica.

**Lección:** cerrar permisos rompe código que dependía de estar abierto. Hay que revisar
qué más tocaba esa puerta.

### El carrito perdía el menú por el orden de los efectos

`MenuBrowser` (hijo) fija el menú en un efecto. `CartProvider` (padre) hidrata el
carrito desde `sessionStorage` en el suyo. **En React los efectos de los hijos corren
antes que los del padre**, así que la hidratación reemplazaba el estado completo y
borraba el menú que el hijo acababa de fijar.

Resultado: carrito con platillos pero sin menú, y el checkout rechazando el pedido con
"tu sesión expiró" — un mensaje que además apuntaba al lugar equivocado. Era un bug
anterior a este trabajo y solo se manifestaba en la primera visita, cuando
`sessionStorage` está vacío.

Arreglo: la hidratación fusiona en vez de reemplazar, conservando el menú que ya
estuviera fijado, y descarta los platillos guardados si son de otra semana.

**Lección:** el orden de los efectos entre padre e hijo no es intuitivo, y un
`setState` que reemplaza el estado completo desde un efecto puede pisar lo que otro
componente acaba de escribir.

### Una prueba que se comparaba consigo misma

Las etiquetas de día llegaron a Supabase con la `é` convertida en dos caracteres:
`cat archivo | pbcopy` con `LC_CTYPE=C` interpreta bytes UTF-8 como MacRoman.

Lo grave no fue el error, fue que **la prueba no lo detectó**: comparaba la salida contra
un literal del mismo archivo. Si los dos tienen el mismo daño, el error coincide consigo
mismo y la prueba pasa en falso.

Ahora cuenta caracteres y bytes: "Miércoles, 9 de septiembre" son 26 caracteres y 27
bytes, porque la `é` ocupa dos. Eso no depende de cómo esté codificado el archivo de
prueba.

**Lección, y es la más transferible:** una prueba que compara el código contra sí mismo
no verifica nada. Hay que anclarla a algo independiente.

---

## 10. Por qué las pruebas corren en Postgres local

Los evaluadores pueden pedir correr `npm test` en vivo. Si las pruebas necesitaran
internet y un Supabase que se pausa solo, la evaluación dependería del wifi de la
videollamada.

Es el mismo razonamiento que llevó al curso a usar `mongodb-memory-server`: las pruebas
levantan su propia base desechable.

**El límite, dicho de frente:** Postgres local no es Supabase. `bootstrap.sql` recrea el
esquema `auth`, el esquema `storage` y los roles `anon`/`authenticated`, pero no reproduce
Auth ni Storage. Valida la lógica de las políticas, no el servicio completo. Por eso cada
migración se prueba local **y** se verifica contra Supabase después. Es el mismo trato
que acepta `mongodb-memory-server`.

---

## 11. Operaciones de varios pasos van en transacciones

Copiar un platillo son tres inserciones encadenadas: platillo, grupos de opciones,
alternativas. Desde el navegador, un fallo a medias deja un platillo sin sus opciones y
sin aviso.

`clone_dish_into_day` y `duplicate_menu_week` son funciones de Postgres: cada copia es una
sola transacción, se completa o no ocurre.

Van como `security definer` — corren con permisos elevados y **saltan RLS** — con
verificación explícita de `is_admin()` adentro. Sin esa verificación, cualquier sesión
podría escribir el catálogo. Hay una prueba que lo vigila.

---

## 12. Probar el ataque, no el camino feliz

Las pruebas de seguridad no comprueban que algo funcione, comprueban que algo **no** se
pueda:

| Prueba | Qué intenta |
|---|---|
| `CA-3` | Una clienta se asciende a admin |
| `CA-4` | Una clienta cambia los datos bancarios del negocio |
| `CA-5` | Una clienta lee los pedidos de otra |
| `SPOOFING` | Crear un pedido a nombre de alguien más |
| `ANON` | Escalar privilegios sin sesión |
| `PERMISOS` | Llamar funciones internas desde la API pública |

Es la diferencia entre las 20 pruebas de PaymentMethods del curso, que pasan todas sin
detectar tres huecos de autorización, y una suite que sí te avisa.

---

## 13. Riesgos conocidos y no resueltos

> Decir esto sin que lo pregunten vale más que esconderlo hasta que lo pregunten.

- **Supabase gratuito se pausa solo** tras varios días sin actividad, y **no despierta
  con una visita**: hay que restaurarlo a mano desde el dashboard. Si la app está
  dormida el día de la evaluación, no hay arreglo rápido. Mitigación: restaurar días
  antes y tocarla a diario.
- **Crear el pedido todavía no es una transacción** (ver punto 9). Deuda técnica
  registrada, no olvidada.
- **La protección contra contraseñas filtradas requiere plan de pago.** Se identificó y
  se decidió no activarla. Sí se subió el mínimo a 8 caracteres con mayúscula, minúscula
  y dígito.
- **El pago con tarjeta no cobra de verdad, y eso sí es una brecha.** El modelo de
  negocio exige cobrar al confirmar el pedido salvo en efectivo, así que para "tarjeta"
  la pasarela no es una mejora opcional: es lo que hace que ese método exista. Hoy el
  checkout lo dice de frente — pago pendiente, no se ha cobrado nada — y el cobro se
  completa por WhatsApp. Registrado como T-011.

  El proyecto del curso tampoco cobra nada (su `createOrder` solo guarda una referencia
  al método), así que la brecha es la misma; la diferencia es que aquí está identificada,
  dicha al usuario y registrada, en vez de quedar implícita.
