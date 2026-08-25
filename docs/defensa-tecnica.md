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

### Crear un pedido es una sola transacción, no varias llamadas sueltas

Hasta T-003, `POST /api/orders` insertaba el pedido y cada renglón con llamadas HTTP
separadas — el mismo patrón que tenía el rollback parcheado de T-001
(`delete_incomplete_order`, que borraba un pedido a medias si algo fallaba entre una
llamada y la siguiente).

Con el stock, ese hueco dejó de ser tolerable: la comprobación de disponibilidad tiene
que ocurrir bajo el mismo candado que la escritura, o dos clientas pueden ver "queda 1"
y las dos completar su pedido. La solución fue una función de Postgres,
`crear_pedido()`, que hace todo —candado, comprobación, inserción del pedido, de cada
renglón y de sus opciones— en una sola transacción. Si algo falla a la mitad, Postgres
deshace todo solo: **el parche ya no tiene trabajo que hacer**, y se eliminó.

Es el cierre de un ciclo: T-001 detectó el problema y lo parchó: T-003 lo resolvió de
raíz.

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

## 6b. Pago en línea: por qué Stripe es el dueño de las tarjetas

**La pregunta:** "¿por qué no guardas las tarjetas en tu base como el proyecto del curso?"

El Payment Element de Stripe, combinado con una `CustomerSession`, ya muestra las
tarjetas guardadas de cada clienta, la deja elegir entre ellas, agregar una nueva y
borrar viejas. Construir eso otra vez sería duplicar trabajo **y** duplicar el dato:
mantener marca y últimos cuatro en dos lugares es garantizar que algún día no coincidan.

Y refuerza el punto anterior sobre datos de tarjeta: con el Payment Element **el número
se captura dentro de un iframe de Stripe y nunca llega al servidor de WellBox**. La
decisión pasó de "no lo guardamos" a "no lo recibimos", que es más fuerte — no depende
de que nadie se equivoque al escribir un controlador.

Contraste con la referencia: el proyecto del curso guarda `cardNumber` y `cvv` en texto
plano **y nunca cobra nada**. Asume todo el riesgo de custodiar datos de tarjeta sin
obtener el beneficio de procesarlos.

### El pedido se crea antes del cobro

Podría hacerse al revés: cobrar y luego crear el pedido. No se hizo, porque si el cobro
pasa y la creación falla, **la clienta queda cobrada sin pedido y sin registro de qué
compró**. Con este orden el peor caso es un pedido `pending` que sí se pagó: visible,
reconciliable y con el dinero localizable.

Es la misma lógica de la pregunta modelo de la rúbrica sobre la base de datos cayéndose
en pleno checkout: en un cobro, la duda de si te cobraron es peor que un error claro.

### El importe se calcula en el servidor, en centavos

Stripe recibe el importe en la unidad mínima de la moneda: $155.00 son `15500`. La
conversión usa `Math.round`, no truncamiento — un `154.999` truncado cobraría un peso de
menos, y esos errores se acumulan.

El importe sale del carrito recalculado contra la base, nunca de lo que mande el
navegador. Mismo criterio que ya se aplicaba en `POST /api/orders`, y lo contrario de
`createOrder` del proyecto del curso, que lee `totalPrice` del body.

### "Pagado" lo decide el servidor, preguntándole a Stripe

`verificarPagoDelPedido()` consulta el PaymentIntent a Stripe y solo entonces marca el
pedido. Nunca se marca por lo que diga el navegador: un cliente puede llamar a cualquier
endpoint con cualquier cuerpo, pero no puede hacer que Stripe mienta.

### Los checkouts abandonados se cancelan, no se retoman

**La pregunta:** "otros e-commerce te dejan retomar un pedido pendiente, ¿por qué el tuyo
no?"

Retomar tiene sentido con un catálogo permanente: el producto sigue existiendo, al mismo
precio, la semana que viene. En WellBox no:

- Los pedidos caducan solos con el cierre de las 11pm del día anterior.
- El menú cambia cada semana, así que un pedido de hace días apunta a platillos que ya no
  están publicados.
- El importe del cobro queda congelado al crearlo; retomarlo con un carrito distinto
  obligaría a actualizar el cobro y revalidar precios y cierres.

Y el caso real no es "abandoné el martes y vuelvo el viernes": es una tarjeta rechazada
seguida de otro intento, o una recarga de página, todo en minutos. Para eso lo correcto
no es preguntar, es que no se acumulen: al empezar un checkout con tarjeta se cancelan
los anteriores sin pagar, en la base **y en Stripe**.

Deja como máximo un pendiente vivo por clienta y por semana, sin interfaz nueva que
explicar y sin riesgo de cobrar un importe viejo.

**El detalle que hace que esto sea seguro:** antes de cancelar se le pregunta a Stripe el
estado real del cobro. Si está `succeeded` o `processing`, no se toca — cancelar un
pedido ya pagado sería mucho peor que dejar ruido. No basta con mirar el estado guardado,
porque el webhook puede no haber llegado todavía.

### El equipo no puede marcar un pedido como pagado

En `/admin/pedidos`, los estados que vienen del cobro —pagado, rechazado, abandonado— se
muestran pero no se editan. Solo se pueden cambiar a mano los de transferencia y
efectivo, que son los que sí dependen de que una persona verifique algo.

Dejar que alguien marcara "pagado" a mano sería permitir afirmar un cobro que nadie
verificó, y rompería la regla de que ese estado lo decide Stripe.

### El carrito no se vacía hasta que el cobro confirma

Si la tarjeta es rechazada, la clienta conserva lo que armó. Vaciar el carrito al iniciar
el pago la obligaría a rehacer el pedido justo después de una frustración.

---

## 6c. El webhook y la llave de servicio

**La pregunta que van a hacer:** "usas una llave que salta la seguridad de tu base, ¿por
qué eso no tira todo tu argumento de RLS?"

### Qué significa "salta las políticas"

Supabase emite dos llaves, y las dos son tokens JWT. La diferencia está en un solo dato
adentro: el rol con el que la petición llega a Postgres.

| Llave | Rol en Postgres | Qué ve |
|---|---|---|
| `anon` / publicable | `anon` o `authenticated` | Solo lo que las políticas permiten |
| `service_role` | `service_role` | **Todo** |

No es que el código ignore las políticas: **es Postgres el que no se las aplica a ese
rol**, porque está creado con el atributo `BYPASSRLS`. Un `select * from orders` con la
llave pública devuelve los pedidos propios; con la llave de servicio devuelve los de
todas las clientas.

Y aplica igual a la escritura. Incluso el trigger `protect_role()` deja pasar un cambio
de rol cuando `auth.uid()` es nulo — que es justo el caso de esta llave. Eso es
deliberado (así se creó la primera cuenta admin), pero significa que **quien tenga esta
llave puede volverse administrador**. Es control total de la base.

### Por qué el webhook no puede funcionar sin ella

La petición del webhook la manda el servidor de Stripe. No hay navegador, no hay cookies,
no hay sesión: `auth.uid()` es nulo. Todas las políticas de `orders` son
`to authenticated` y comparan contra `auth.uid()`, así que el webhook llegaría como
`anon` y su `update` afectaría **cero filas, sin error**. No es que sea incómodo pasar
por RLS: es que es imposible.

### Por qué eso no rompe el argumento

Lo que autentica al webhook **no es una sesión, es la firma de Stripe**. Antes de tocar
la base, la ruta recalcula la firma sobre el cuerpo crudo con el secreto compartido; si
no coincide, responde 400 y no sigue. Sin esa verificación, cualquiera podría marcar
pedidos como pagados con un simple POST.

Además:

- **Superficie mínima:** un solo archivo la usa. Lo único que hace es leer un pedido,
  preguntarle a Stripe si el cobro ocurrió, y actualizar el estado.
- **No acepta datos arbitrarios:** el id del pedido sale de los `metadata` del
  PaymentIntent, que solo escribe nuestro propio servidor al crearlo.
- **No puede llegar al navegador:** la variable no lleva prefijo `NEXT_PUBLIC_`, así que
  Next falla el build si un componente cliente intenta importarla.

### Alternativas que se descartaron

- **Darle a `anon` una política para actualizar pedidos por id de PaymentIntent.** Eso
  permitiría a cualquiera marcar pedidos como pagados. Peor que el problema.
- **Una función `security definer` llamable por `anon`.** Mismo problema: Postgres no
  puede consultarle a Stripe si el cobro ocurrió, así que tendría que creerle a quien la
  llama.

**La conclusión, y es el argumento:** la comprobación que hace seguro a este camino —la
firma de Stripe— no puede vivir dentro de la base de datos. Tiene que correr en código, y
ese código necesita escribir sin sesión. La llave de servicio no es una excepción a la
regla de "la autorización vive en la base": es el reconocimiento de que hay exactamente
un caso donde la base no tiene la información para decidir, y ese caso está acotado,
autenticado por otro medio y aislado en un archivo.

### El riesgo, dicho de frente

Si esta llave se filtra, quien la tenga puede leer y modificar todo. Por eso: nunca se
commitea, nunca va al navegador, y si se filtrara hay que rotarla desde el dashboard de
Supabase. Es el mismo trato que cualquier credencial de administrador.

---

## 6d. Stock: se calcula, no se descuenta

**La pregunta:** "¿cómo llevas el inventario?"

Hay dos maneras. La obvia es **descontar**: bajar un contador al crear el pedido y subirlo
al cancelarlo. La que se eligió es **calcular**:

```
disponible = stock − lo pedido en pedidos vivos
```

El motivo es concreto y salió de este mismo proyecto. Un pedido puede terminar en cinco
estados distintos: pagado, comprobante recibido, confirmado, **rechazado** (tarjeta) o
**cancelado** (checkout abandonado). Con un contador, cada uno de esos caminos necesita
lógica que devuelva el stock. El día que se agregue un sexto estado y alguien olvide
compensarlo, queda **inventario fantasma**: cajas que nadie puede comprar y nadie sabe
por qué.

Calculándolo, cancelar devuelve el stock **solo**. Da igual quién cambie el estado —el
webhook de Stripe, el panel, una corrección a mano en SQL—: la disponibilidad se ajusta
sin código que lo recuerde.

El costo es una consulta agregada. Con unos pocos platillos por semana, irrelevante.

**Un pedido sin pagar sí aparta su caja.** Si no, dos clientas podrían llegar al checkout
por la última al mismo tiempo y las dos pasarían. Es lo mismo que hace una tienda cuando
aparta el producto mientras pagas.

### El bug que atrapó la prueba

La primera versión de la vista usaba un `LEFT JOIN` a `orders` con la condición del
estado dentro del `ON`. Eso deja la fila de `order_items` presente aunque el pedido no
califique, así que `sum(oi.quantity)` **la seguía contando**: cancelar un pedido no
devolvía el stock.

Compilaba, no daba error, y devolvía un número plausible. Lo detectó la prueba de CA-3,
que verifica justamente el comportamiento —no la sintaxis.

Se corrigió con `filter (where o.id is not null)`.

### Dos clientas por la última caja

Entre "verifiqué que hay stock" y "guardé el pedido" caben otras peticiones. Sin un
candado, las dos ven "queda 1" y las dos crean su pedido: sobreventa.

La comprobación toma un candado sobre la fila del **platillo** —el recurso escaso—, no
sobre el pedido. Las peticiones por el mismo platillo hacen fila; las de platillos
distintos no se estorban.

**Esto se prueba con dos conexiones reales compitiendo**, no con un archivo SQL: con una
sola conexión las operaciones van en orden y el candado nunca tiene que hacer su trabajo.
`scripts/db-test-concurrencia.sh` lanza dos sesiones simultáneas por la última caja:

```
→ Ana:  pasó
→ Beto: rechazada
→ pedidos que pasaron: 1
→ cajas comprometidas: 2 de 2
   rechazo: ERROR: Solo quedan 0 de Bowl Limitado
```

Es la prueba que vale la pena correr en vivo el día de la defensa.

**Y se repitió contra producción, por el endpoint HTTP completo.** Con el servidor
apuntando a la base real, dos peticiones `POST /api/orders` simultáneas por la última
unidad de un platillo real del menú: una devolvió `200` con el pedido creado, la otra
`409` con "Solo quedan 0 de Waffles de Avena y Queso". La base terminó exactamente en
`reservado = stock`. No es una simulación — es el mismo camino que sigue una clienta real,
ejercitado dos veces a la vez.

Contraste con la referencia: el proyecto del curso **declara** `Product.stock` pero solo
lo usa para filtrar búsquedas. Su `createOrder` no lo valida ni lo descuenta, así que se
puede pedir cualquier cantidad de cualquier producto agotado.


---

## 6e. Manejo de errores: qué pasa si Supabase se cae

**La pregunta modelo exacta del documento de evaluación.** Y la respuesta empieza con
algo que se verificó antes de diseñar nada, no se asumió: `supabase-js` **no lanza
excepciones** cuando la conexión falla. Se probó contra un puerto sin nada escuchando:

```
{ data: null, error: { message: "TypeError: fetch failed", code: "" } }
```

Eso cambia el diagnóstico. El problema no era la falta de `try/catch` — eran **11
páginas del servidor que leían `data` y nunca miraban `error`**, así que una base caída
se veía exactamente igual que "no hay menú esta semana" o "no tienes pedidos". Se agregó
`esFalloDeConexion()` (una heurística documentada, no una certeza — no existe un código
estándar de Postgres para "no pude ni preguntar") y cada página aprendió a distinguir
las dos cosas.

### El hallazgo que no estaba en el plan

Verificando esa corrección contra una caída real, apareció algo peor: **el proxy y la
capa de autorización expulsaban a cualquiera al login** cuando no podían verificar la
sesión — sin distinguir "no hay sesión" de "no se pudo verificar por la red". Le pasaba
a una clienta a media compra.

La corrección usa una propiedad real de la librería, confirmada leyendo su código
fuente: `getSession()` lee la cookie y la decodifica localmente, sin red;
`getUser()` siempre llama a Supabase para confirmarla. Si `getSession()` encuentra una
sesión pero `getUser()` no pudo verificarla, ya no se concluye "no hay sesión" — el
proxy deja pasar la petición, y la capa de autorización lanza una excepción que atrapa
el `error.tsx` correspondiente, con botón de reintentar, en vez de un salto silencioso.

**Cómo se verificó sin poder simular la caída completa.** Cambiar la URL de Supabase a
un host inalcanzable también cambia el nombre de cookie que el cliente espera (se
deriva de la referencia del proyecto), así que ese método de prueba rompe por una razón
distinta a la que se quiere probar. Y usar `/etc/hosts` para simular la caída
manteniendo la URL real queda fuera de lo que se debe tocar sin autorización explícita.

Se armó una prueba aislada en su lugar: la URL real del proyecto (para que el nombre de
cookie coincida) más una cookie de sesión real, con `fetch` interceptado para fallar
solo donde se necesitaba:

```
getUser() con red  → user: prueba.clienta@wellbox-test.mx
getSession() sin red → session: ENCONTRADA (local, sin red)
getUser() sin red    → user: null
```

Confirma exactamente la premisa del arreglo, y de que el arreglo no abre una puerta a
quien de verdad no tiene sesión se verificó aparte: una petición sin ninguna cookie
sigue siendo rechazada.

**El patrón que se repite en este proyecto:** la prueba correcta no siempre es la más
obvia. Cambiar una variable de entorno para "simular una caída" parecía suficiente, y no
lo era — habría dado un falso negativo por una razón completamente distinta a la que se
quería probar. Vale la pena entender qué se está probando de verdad antes de construir
la simulación.


---

## 6f. Dos suites de pruebas, no una forzada a hacer todo

**La pregunta:** "¿por qué `npm run db:verify` y `npm test` por separado? ¿No debería
ser todo `npm test`?"

`npm test` corre Vitest: 43 pruebas, sin ninguna dependencia externa, en 2 segundos.
Cubre las funciones puras de `lib/` (el corte de las 11pm, el formateo de moneda, el
redondeo a centavos) y un componente de React. `npm run db:verify` corre 28
verificaciones en SQL contra un Postgres local real, incluida la prueba de concurrencia
con dos conexiones compitiendo por la última unidad de stock.

No se reescribió esa prueba de concurrencia en JavaScript con mocks, y es una decisión,
no una omisión: un mock de Postgres no puede probar que un candado de verdad funciona —
solo puede probar que el código *llama* a lo que se espera que llame. La única forma
honesta de probar "dos transacciones reales compitiendo por la misma fila, solo una
gana" es con dos transacciones reales.

Es la misma separación que ya usa el proyecto del curso —unitarios sin dependencias vs.
integración con `mongodb-memory-server`— con una diferencia de mecanismo: Postgres no
tiene un equivalente maduro a `mongodb-memory-server` que levante una instancia completa
embebida en el proceso de pruebas, así que WellBox usa un Postgres local real vía
Homebrew en su lugar. Mismo principio — pruebas de integración no dependen de servicios
en producción — con la herramienta que el motor de base de datos elegido sí tiene
disponible.

### Un detalle de Vitest que costó cinco pruebas fallidas

Vitest, a diferencia de Jest, **no limpia el DOM entre pruebas por su cuenta**. El primer
intento de probar `QuantityStepper` falló 5 de 6 casos con "se encontraron varios
elementos" — los renders de una prueba se quedaban montados para la siguiente. Se
corrige con un `afterEach(cleanup)` explícito en la configuración.

Vale la pena decirlo así en la defensa: "usa Vitest en vez de Jest" no es un cambio
cosmético de nombre. El comportamiento por defecto difiere, y solo se nota al correr las
pruebas de verdad — otra vez el patrón de esta sesión: la prueba real encuentra cosas
que la lectura del código no.


---

## 6g. `npm audit`: el aviso de Next.js que sí importaba

**La pregunta:** "¿corriste `npm audit`? ¿qué encontraste?"

Tres vulnerabilidades altas, las tres resueltas por la misma actualización de Next.js
(16.2.9 → 16.3.2). Pero no era boilerplate de dependencias transitivas: `next` mismo
estaba listado, con un aviso real —**GHSA-6gpp-xcg3-4w24**— de bypass de autorización en
middleware/proxy, activo bajo tres condiciones: App Router, Turbopack, y un solo locale
configurado.

**Se verificó cuánto aplicaba, en vez de asumir.** El build de WellBox ya usa Turbopack
por defecto (aparece en cada compilación), y usa App Router — dos de tres. La tercera no
se pudo confirmar con certeza: el proyecto no tiene **ningún** `i18n` configurado, que no
es lo mismo que tener exactamente uno. No se afirmó una cosa que no se pudo verificar.

**Y no importaba de todas formas, por diseño previo.** El propio aviso recomienda como
mitigación "mover la autorización a la ruta de datos del servidor en vez de depender
solo del middleware" — que es exactamente el modelo de tres capas que ya existía desde
T-001: `proxy.ts` es el chequeo optimista, `requireAdmin()`/`requireUser()` en
`lib/auth.ts` es la verificación real, RLS es la que de verdad decide. Se comprobó en
vivo, sin intentar explotar la vulnerabilidad real: una cuenta con rol `customer` pidió
una ruta de administración profunda y quedó en `/pedido`, no en `/login` — el
comportamiento específico de que `requireAdmin()` evalúa el rol por su cuenta, sin leer
ninguna señal que el proxy haya dejado. Aunque la primera capa fallara, la segunda no
tiene manera de enterarse de que falló.

**Esa es la respuesta completa a "¿por qué tres capas y no solo el proxy?"**, con un CVE
real de la semana en que se hizo el proyecto como evidencia, no como hipotético.

Tras la actualización: `npm audit` en 0, y las dos suites de pruebas —43 de Vitest, 28
de SQL con concurrencia real— siguieron en verde sin tocar un solo archivo del proyecto.

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
