# Guion de la explicación técnica

> Escrito para decirse en voz alta, no para leerse en silencio. Frases cortas a
> propósito. Cada término técnico viene traducido en el mismo renglón.
>
> Duración aproximada: **10 minutos**. Los tiempos son guía, no cronómetro.
>
> Lee esto en voz alta dos veces antes de la revisión. No para memorizarlo — para que
> las palabras dejen de sentirse ajenas.

---

## 1 · Qué es WellBox *(1 min)*

WellBox es un negocio real mío: preparo desayunos saludables y los entrego en oficinas.

Funciona por semana. Cada semana publico un menú con un platillo distinto para cada día,
de lunes a viernes. Mis clientas entran, ven el menú, eligen qué quieren cada día, y
pagan. Yo entrego a las 10 de la mañana en un punto fijo de cada oficina.

Antes esto lo llevaba por WhatsApp, a mano. Por eso hice la app: es una necesidad real
mía, no un ejercicio.

En la app hay dos tipos de persona:

- **La clienta**, que ve el menú, arma su pedido y paga.
- **Yo como administradora**, que subo el menú de la semana, defino cuántas cajas hay de
  cada platillo, veo los pedidos y confirmo los pagos.

---

## 2 · Las piezas *(1 min y medio)*

Toda la app son tres cosas:

- El **navegador** — el celular o la computadora de mi clienta. Ahí ve y toca.
- El **servidor** — una computadora de Vercel. Ahí corre mi código.
- La **base de datos** — Postgres, en Supabase. Ahí se guarda todo: menús, platillos,
  pedidos, perfiles.

Cuando decimos **front** hablamos de lo que la persona ve y toca. Cuando decimos **back**
hablamos de lo que pasa donde ella no ve: guardar el pedido, decidir permisos, cobrar.

En el proyecto que vimos en clase, el front y el back son dos proyectos separados, cada
uno en su carpeta. En el mío son un solo proyecto de Next.js con las dos cosas adentro.

Para saber cuál es cuál en mi código hay una marca literal: los archivos que empiezan con
`"use client"` se van al navegador. Los que no la traen, corren en el servidor.

---

## 3 · Qué pasa cuando alguien ve el menú *(1 min)*

Aquí hay algo que vale la pena explicar, porque es distinto al proyecto de clase.

En el de clase, el código de React vive en el navegador. Desde ahí no puede tocar la base
de datos, así que tiene que pedirle los datos al back por internet.

En el mío, el archivo que muestra el menú corre **en el servidor**. Como ya está del
mismo lado que la base, le pregunta directo y arma la página con los platillos ya
escritos adentro. Cuando la página llega al celular de mi clienta, los precios ya vienen
puestos.

Por eso en ese archivo no hay ninguna llamada de red. No hace falta: no hay dos
computadoras que conectar.

Y el menú es público a propósito. No pido cuenta para verlo, porque es el escaparate del
negocio: pedir cuenta para mirar espantaría clientas.

---

## 4 · Qué pasa cuando alguien hace un pedido *(2 min y medio)*

Aquí sí ocurre el viaje completo, y es la parte que más me importa explicar.

**Primero, el carrito.** Mientras mi clienta va eligiendo platillos, nada se guarda en el
servidor. El carrito vive solo en su navegador. Si cierra la pestaña, no queda basura en
mi base de datos.

**Cuando presiona "Confirmar pedido"**, ahí sí. Para ese momento la página ya está en su
celular, así que el código que corre es el del navegador — y desde ahí no puede tocar
Postgres. Tiene que mandar un mensaje al servidor. Ese mensaje va a `/api/orders`, que es
mi API: la dirección donde mi servidor escucha peticiones.

**Y en el servidor pasan cuatro cosas, en este orden:**

1. **Saco quién es de la sesión, nunca de lo que manda el navegador.** Si confiara en el
   dato que viene del cliente, cualquiera podría crear un pedido a nombre de otra persona.

2. **Vuelvo a calcular el total contra los precios de la base.** El navegador me manda qué
   platillos quiere, no cuánto cuestan. El precio lo pongo yo del lado del servidor. Si
   confiara en el número que manda el cliente, podría pagar diez pesos por lo que quisiera.

3. **Vuelvo a revisar el horario de cierre.** Los pedidos de cada día cierran a las 6 de
   la tarde del día anterior. Eso ya se revisó en la pantalla para avisarle a la clienta,
   pero se revisa otra vez aquí — porque la pantalla se puede manipular y el servidor no.

4. **Guardo todo con una función de Postgres, `crear_pedido`.** Esa función aparta el
   stock, revisa que alcance, y escribe el pedido, sus renglones y sus opciones, todo en
   una sola transacción. "Transacción" significa que o pasa todo, o no pasa nada. Si algo
   falla a la mitad, no queda un pedido incompleto.

Ese punto 4 lo hice así por un problema concreto: si dos clientas piden el último platillo
al mismo tiempo, las dos podrían ver "queda 1" y las dos completar el pedido. Al hacerlo
dentro de una transacción, Postgres se encarga de que solo una gane.

---

## 5 · Los permisos: quién puede hacer qué *(2 min)*

Esta es la parte de la que estoy más segura, y es donde mi proyecto se separa más del de
clase.

Tengo la autorización en **tres capas**:

1. **`proxy.ts`** — una revisión rápida antes de dibujar la pantalla. Si alguien sin
   sesión intenta entrar al panel de administración, lo mando al login. Esto es solo por
   comodidad: no quiero dibujar pantallas que la persona no va a poder usar.

2. **`lib/auth.ts`** — la revisión de verdad, del lado del servidor, junto al acceso a los
   datos. Aquí sí se valida la sesión contra Supabase.

3. **Las políticas RLS en Postgres** — y esta es la que de verdad cuenta.

**RLS** son las siglas de *Row-Level Security*, seguridad a nivel de fila. Una fila es un
renglón de una tabla: un pedido, un perfil. La política decide, fila por fila, quién puede
verla o tocarla.

Lo puedo demostrar: la pantalla de "Mis pedidos" **no filtra por usuario**. Le pide a
Postgres todos los pedidos, sin condición. Y aun así cada clienta ve solo los suyos,
porque el filtro lo hace la base de datos, no mi código.

Eso importa porque si algún día se me olvida proteger una pantalla, la base sigue
rechazando la consulta. En el proyecto de clase la autorización está repartida en cada
controlador, y ahí sí se les escaparon tres lugares — por ejemplo, cualquiera con sesión
puede borrar el método de pago de otra persona.

Y el rol de administradora no lo puede cambiar el cliente: vive en la tabla `profiles`, y
hay un disparador, `protect_role`, que revierte cualquier intento de ascenderse solo.

---

## 6 · El pago *(1 min y medio)*

Acepto tres formas: efectivo al entregar, transferencia con comprobante, y tarjeta en
línea.

Con tarjeta uso Stripe. Lo importante es esto: **el número de la tarjeta nunca llega a mi
servidor.** Se captura dentro de un recuadro que sirve Stripe, en su propio dominio. Yo
nunca lo veo, así que no lo puedo perder.

En el proyecto de clase se guarda el número de tarjeta y el CVV en texto plano, en la base
de datos. Guardar el CVV está prohibido por la norma de la industria, aunque esté cifrado.
Mi decisión fue no tener ese dato.

El pedido se crea **antes** de cobrar. Lo hice en ese orden a propósito: si cobrara
primero y la creación fallara, mi clienta quedaría cobrada sin pedido y sin registro de
qué compró. Así, el peor caso es un pedido pendiente que sí se pagó — visible y arreglable.

Cuando el cobro se completa, Stripe le avisa a mi servidor con lo que se llama un
**webhook**: una petición que Stripe le hace a mi app. Y esa petición viene firmada, así
que verifico la firma antes de creerle. Si no, cualquiera podría avisarme que un pedido se
pagó cuando no es cierto.

---

## 7 · Por qué este stack y no el de clase *(1 min)*

El curso fue React, Node y pruebas — y eso es exactamente lo que traigo. Mi proyecto tiene
las mismas capas que vimos: componentes, contexto, servicios, rutas, controladores,
middleware, modelos y pruebas. Lo que cambia es dónde viven y cómo se llaman.

Cambié tres piezas de infraestructura:

- **TypeScript en vez de JavaScript.** TypeScript es JavaScript con anotaciones de tipo;
  se compila a JavaScript y eso es lo que corre.
- **Postgres en vez de MongoDB.** Mis datos son muy relacionales: un menú tiene días, cada
  día tiene platillos, cada platillo tiene grupos de opciones. Y Postgres me da RLS y
  transacciones, que es de donde sale casi toda mi seguridad.
- **Next.js en vez de Create React App más Express**, que es lo que junta el front y el
  back en un solo proyecto.

Y las pruebas están en verde: 43 pruebas con Vitest, más verificaciones en SQL contra un
Postgres real — incluida una que levanta dos conexiones peleándose por la última pieza de
stock, para comprobar que solo una gana.

---

## 8 · Lo que todavía no está *(30 seg)*

Prefiero decirlo yo antes de que lo pregunten:

- **Las fotos de los platillos no están.** Los espacios están marcados como "foto
  pendiente" en la página principal. Es contenido que me falta subir, no código que falte.
- **El corte de pedidos estaba mal en el código hasta ayer**: decía 11 de la noche cuando
  mi negocio cierra a las 6 de la tarde. Lo encontré yo probando la app, y ninguna de mis
  pruebas lo había detectado — porque verificaban que el código coincidiera consigo mismo,
  no con la regla real del negocio. Ya está corregido.
- **Hay partes de la arquitectura que todavía estoy entendiendo a fondo.** Sé qué hace
  cada pieza y por qué está ahí; hay detalles de implementación que todavía no domino y
  los estoy estudiando.

---

## Si solo te da tiempo de decir una cosa

> "WellBox es un negocio real mío. La app tiene las mismas capas que vimos en clase, con
> otros nombres, y la diferencia de fondo es que la autorización vive en la base de datos
> en vez de estar repartida en cada endpoint: si se me olvida proteger una pantalla, la
> base sigue rechazando la consulta."
