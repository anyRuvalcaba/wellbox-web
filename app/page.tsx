import Image from "next/image";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { esFalloDeConexion } from "@/lib/db-error";
import { formatMXN, formatWeekRangeLabel } from "@/lib/format";
import { nextUpcomingCutoff } from "@/lib/cutoff";
import EstadoSinConexion from "./EstadoSinConexion";
import HeroCarousel from "./HeroCarousel";
import { CartProvider } from "./pedido/cart-context";
import CartIcon from "./pedido/CartIcon";
import AccountMenu from "./pedido/AccountMenu";

export const dynamic = "force-dynamic";

// Botones propios de esta página: acentos naranja (rust), como en el mockup — el
// BTN_PRIMARY/BTN_SECONDARY compartido en lib/ui.ts es olive y se usa en el resto del
// sitio (login, pedido, admin), así que no se toca para no cambiarlo ahí también.
const CTA_PRIMARY =
  "inline-flex items-center justify-center bg-rust text-cream font-semibold rounded-full px-5 py-2.5 hover:bg-rust/90 transition-colors disabled:opacity-50";
const CTA_SECONDARY =
  "inline-flex items-center justify-center bg-white border border-rust/40 text-rust font-semibold rounded-full px-5 py-2.5 hover:bg-rust/10 transition-colors disabled:opacity-50";

const F = "/marketing/platillos";

// Las que rotan en el banner: las más apetitosas, mezclando vertical y horizontal para
// que el encuadre funcione igual en celular que en pantalla ancha.
const FOTOS_HERO = [
  { src: `${F}/toast-aguacate-huevo-tocino.jpg`, alt: "Toast de aguacate con huevo estrellado y tocino" },
  { src: `${F}/avena-platano-chocolate.jpg`, alt: "Avena con plátano, pecanas, chocolate y crema de almendra" },
  { src: `${F}/tiramisu-avena.jpg`, alt: "Tiramisú de avena con crema y chocolate" },
  { src: `${F}/waffles-fresa-maple.jpg`, alt: "Waffles de avena con fresa, plátano y miel de maple" },
  { src: `${F}/croissant-salmon.jpg`, alt: "Croissant de salmón ahumado con aguacate y alcaparras" },
];

// La galería de "cambia cada semana": variedad deliberada —dulce y salado, pan y bowl—
// para que se vea que el menú no se repite. El orden importa: la primera ocupa dos
// filas y la última dos columnas, así que van la más vertical y la más ancha.
const FOTOS_GALERIA = [
  { src: `${F}/waffles-chispas-platano.jpg`, alt: "Waffles con chispas de chocolate y plátano" },
  { src: `${F}/toast-champinones-tocino.jpg`, alt: "Toast de champiñones, tocino y ricotta" },
  { src: `${F}/waffles-chocolate-fresas.jpg`, alt: "Waffles de chocolate con fresas y yogurt" },
  { src: `${F}/crepas-espinaca-pollo.jpg`, alt: "Crepas de espinaca rellenas de pollo con aguacate" },
  { src: `${F}/sandwich-pollo-pesto.jpg`, alt: "Sandwich de pollo al pesto con jitomate deshidratado" },
  { src: `${F}/croissant-frances-blueberries.jpg`, alt: "Croissant francés con blueberries y crema" },
];

const FOTO_NOSOTROS = {
  src: `${F}/avena-berries-pecanas.jpg`,
  alt: "Avena con blueberries, fresas y pecanas sobre una mesa de madera",
};

// Las tarjetas del menú muestran la foto del platillo tal como está en la base
// (dishes.photo_url), que se sube desde el editor de menú. Mientras un platillo no
// tenga la suya, se marca en vez de poner una foto de otro platillo: enseñar unos
// waffles donde va un omelette es peor que no enseñar nada.
function FotoPendiente({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-cream-dark border border-dashed border-peach text-brown/40 text-xs font-semibold text-center px-3 ${className}`}
    >
      Foto pendiente
    </div>
  );
}

type DiaPreview = {
  id: string;
  dayLabel: string;
  dayDate: string;
  platillo: { name: string; description: string | null; price: number; photoUrl: string | null } | null;
};

async function getMenuPreview(): Promise<{
  weekLabel: string;
  proximoCierre: Date | null;
  dias: DiaPreview[];
  sinConexion: boolean;
}> {
  const supabase = await createClient();

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id")
    .eq("is_published", true)
    .maybeSingle();

  if (esFalloDeConexion(menuError)) return { weekLabel: "", proximoCierre: null, dias: [], sinConexion: true };
  if (!menu) return { weekLabel: "", proximoCierre: null, dias: [], sinConexion: false };

  const { data: days } = await supabase
    .from("menu_days")
    .select("id, day_date, day_label, position")
    .eq("menu_id", menu.id)
    .order("position");

  if (!days || days.length === 0) {
    return { weekLabel: "", proximoCierre: null, dias: [], sinConexion: false };
  }

  const dayIds = days.map((d) => d.id);
  // Solo el primer platillo de cada día: esto es un adelanto, no el selector completo
  // (ese vive en /pedido, con variantes y disponibilidad).
  const { data: dishes } = await supabase
    .from("dishes")
    .select("menu_day_id, name, description, price, photo_url, position")
    .in("menu_day_id", dayIds)
    .order("position");

  const primerPlatilloPorDia = new Map<string, NonNullable<typeof dishes>[number]>();
  for (const dish of dishes ?? []) {
    if (!primerPlatilloPorDia.has(dish.menu_day_id)) primerPlatilloPorDia.set(dish.menu_day_id, dish);
  }

  const dias: DiaPreview[] = days.map((day) => {
    const platillo = primerPlatilloPorDia.get(day.id);
    return {
      id: day.id,
      dayLabel: day.day_label,
      dayDate: day.day_date,
      platillo: platillo
        ? {
            name: platillo.name,
            description: platillo.description,
            price: Number(platillo.price),
            photoUrl: platillo.photo_url,
          }
        : null,
    };
  });

  return {
    weekLabel: formatWeekRangeLabel(days.map((d) => d.day_date)),
    proximoCierre: nextUpcomingCutoff(days.map((d) => d.day_date)),
    dias,
    sinConexion: false,
  };
}

async function getPuntosEntrega(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_locations")
    .select("name")
    .eq("is_active", true)
    .order("position");
  return (data ?? []).map((p) => p.name);
}

async function getWhatsapp(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "whatsapp_number").maybeSingle();
  return data?.value ?? null;
}

function formatCierre(fecha: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(fecha);
}

export default async function HomePage() {
  const perfil = await getSessionProfile();

  const [menuPreview, puntos, whatsapp] = await Promise.all([
    getMenuPreview(),
    getPuntosEntrega(),
    getWhatsapp(),
  ]);

  return (
    <CartProvider nombreCuenta={perfil?.fullName ?? ""} telefonoCuenta={perfil?.phone ?? ""}>
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 sm:px-8 py-2.5 bg-cream/90 backdrop-blur-md border-b border-peach">
        <a href="#top" className="flex flex-col items-center gap-0.5">
          <Image
            src="/marketing/wellbox-mark-horizontal.png"
            alt="wellBOX — Healthy Lunch"
            width={780}
            height={228}
            className="h-7 sm:h-8 w-auto"
            priority
          />
          <span className="text-[9px] tracking-[0.34em] uppercase text-brown/55 pl-[0.34em]">
            Healthy Lunch
          </span>
        </a>
        {perfil ? (
          <nav className="flex items-center gap-2 sm:gap-3">
            <CartIcon />
            <AccountMenu email={perfil.email} esAdmin={perfil.role === "admin"} />
          </nav>
        ) : (
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/registro" className={`${CTA_SECONDARY} !px-4 !py-2 text-sm`}>
              Crear cuenta
            </Link>
            <Link href="/login" className={`${CTA_PRIMARY} !px-4 !py-2 text-sm`}>
              Iniciar sesión
            </Link>
          </nav>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* Hero */}
        <section className="grid md:grid-cols-2 items-stretch min-h-[560px] md:min-h-[640px]">
          <div className="order-2 md:order-2 relative min-h-[320px]">
            <HeroCarousel photos={FOTOS_HERO} />
          </div>
          <div className="order-1 md:order-1 flex flex-col items-center justify-center text-center gap-5 px-6 sm:px-10 py-10 sm:py-16">
            <Image
              src="/logo-wellbox.png"
              alt="wellBOX — Healthy Lunch"
              width={210}
              height={210}
              className="w-36 sm:w-44 h-auto"
              priority
            />
            <h1 className="font-display text-4xl sm:text-5xl text-olive-dark leading-tight max-w-[13ch]">
              Healthy-Clean Dark Kitchen
            </h1>
            <p className="text-brown/75 text-base sm:text-lg max-w-[44ch]">
              Desayunos saludables 100% para llevar, cocinados el mismo día y entregados
              en tu oficina.
            </p>
            <a href="#menu" className={`${CTA_PRIMARY} mt-1`}>
              Ver el menú de la semana
            </a>
          </div>
        </section>

        {/* Menú de la semana */}
        <section id="menu" className="px-4 sm:px-8 py-12 sm:py-20 bg-cream-dark/60 border-t border-peach">
          <div className="max-w-5xl mx-auto">
            {menuPreview.sinConexion ? (
              <EstadoSinConexion />
            ) : menuPreview.dias.length === 0 ? (
              <div className="text-center py-8">
                <h2 className="font-display text-3xl text-olive-dark mb-2">
                  Por ahora no hay menú disponible
                </h2>
                <p className="text-brown/70">
                  Vuelve a checar pronto, estamos preparando la próxima semana.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
                  <div>
                    <p className="text-xs font-semibold tracking-widest uppercase text-olive-dark mb-1">
                      Semana del {menuPreview.weekLabel}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl text-olive-dark mb-2">
                      El menú de esta semana
                    </h2>
                    {menuPreview.proximoCierre && (
                      <div className="flex items-center gap-2 text-sm text-brown/65">
                        <span className="w-1.5 h-1.5 rounded-full bg-rust" />
                        <span>
                          El próximo día cierra el{" "}
                          <strong className="text-rust">{formatCierre(menuPreview.proximoCierre)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}>
                  {menuPreview.dias.map((dia) =>
                    dia.platillo ? (
                      <article
                        key={dia.id}
                        className="bg-white border border-peach rounded-2xl overflow-hidden flex flex-col"
                      >
                        <div className="relative h-32 bg-cream-dark">
                          {dia.platillo.photoUrl ? (
                            <Image
                              src={dia.platillo.photoUrl}
                              alt={dia.platillo.name}
                              fill
                              sizes="200px"
                              className="object-cover"
                            />
                          ) : (
                            <FotoPendiente className="absolute inset-0" />
                          )}
                        </div>
                        <div className="p-4 flex flex-col gap-1.5 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-olive-dark">
                            {dia.dayLabel}
                          </p>
                          <h4 className="font-display text-lg text-brown leading-tight">{dia.platillo.name}</h4>
                          <p className="text-xs text-brown/60 line-clamp-2">{dia.platillo.description}</p>
                          <span className="mt-auto font-display text-xl text-rust pt-1">
                            {formatMXN(dia.platillo.price)}
                          </span>
                        </div>
                      </article>
                    ) : null
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mt-6 p-5 bg-cream border border-peach rounded-2xl">
                  <p className="text-sm text-brown/80 max-w-[52ch]">
                    Pides los días que quieras: cada día cierra a las 6pm del día
                    anterior.
                  </p>
                  <Link href="/registro" className={`${CTA_PRIMARY} whitespace-nowrap`}>
                    Crear cuenta para pedir
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Quiénes somos */}
        <section className="px-4 sm:px-8 py-14 sm:py-24">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 sm:gap-14 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-olive-dark mb-2">
                Quiénes somos
              </p>
              <h2 className="font-display text-3xl sm:text-4xl text-brown mb-4 max-w-[16ch]">
                Cocina de verdad, empacada para llevar
              </h2>
              <p className="text-brown/75 text-base sm:text-lg max-w-[50ch] mb-3">
                Somos una cocina pequeña que prepara desayunos para gente que trabaja y
                no tiene tiempo de cocinar. Cada platillo lo revisa y ajusta una
                nutrióloga, y lo cocinamos el mismo día que lo entregamos.
              </p>
              <p className="text-brown/75 text-base sm:text-lg max-w-[50ch]">
                No hay menú fijo: nos gusta que la semana sepa distinta.
              </p>
            </div>
            <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden">
              <Image
                src={FOTO_NOSOTROS.src}
                alt={FOTO_NOSOTROS.alt}
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="px-4 sm:px-8 py-12 sm:py-20 bg-cream-dark/60">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-olive-dark mb-2">
              Cómo funciona
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-brown mb-8 sm:mb-12 max-w-[18ch]">
              Cuatro pasos, una vez por semana
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7 sm:gap-9">
              {[
                {
                  n: 1,
                  titulo: "Ves el menú",
                  texto: "Publicamos el menú de la semana el jueves. No necesitas cuenta para verlo.",
                },
                {
                  n: 2,
                  titulo: "Eliges tus días",
                  texto: "Un platillo por día, de lunes a viernes. Pides los días que quieras, o toda la semana.",
                },
                {
                  n: 3,
                  titulo: "Punto de entrega y pago",
                  texto: "Efectivo, transferencia con comprobante o tarjeta en línea.",
                },
                {
                  n: 4,
                  titulo: "Recibes de 10 a 10:30",
                  texto: "Llegamos al punto de entrega entre 10:00 y 10:30, recuerda también recoger puntual tu desayuno.",
                },
              ].map((paso) => (
                <div key={paso.n} className="flex flex-col gap-3">
                  <span className="w-12 h-12 flex items-center justify-center rounded-full bg-olive text-cream font-display text-xl">
                    {paso.n}
                  </span>
                  <h4 className="font-display text-lg text-brown">{paso.titulo}</h4>
                  <p className="text-sm text-brown/65">{paso.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cambia cada semana */}
        <section className="px-4 sm:px-8 py-14 sm:py-22">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-olive-dark mb-2">
              Nunca el mismo menú
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-brown mb-6 max-w-[18ch]">
              Cambia cada semana
            </h2>
            <div className="flex flex-wrap gap-3 items-center mb-6 p-5 bg-olive-light/25 border border-olive-light/60 rounded-2xl">
              <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-olive-light/40 text-olive-dark flex-none">
                Semana de favoritos
              </span>
              <p className="text-sm text-olive-dark/90 max-w-[60ch]">
                Trabajamos con lo que está en temporada y los platillos siempre varían,
                aunque tenemos &ldquo;semana de favoritos&rdquo; donde los menús que más
                gustaron regresan, ya sea la semana completa o un platillo suelto.
              </p>
            </div>
            <div
              className="grid gap-3 sm:gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gridAutoRows: "clamp(140px, 17vw, 200px)" }}
            >
              {FOTOS_GALERIA.map((foto, i) => (
                <div
                  key={foto.src}
                  className="relative rounded-2xl overflow-hidden"
                  style={i === 0 ? { gridRow: "span 2" } : i === 5 ? { gridColumn: "span 2" } : undefined}
                >
                  <Image src={foto.src} alt={foto.alt} fill sizes="(min-width: 640px) 320px, 50vw" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Puntos de entrega */}
        {puntos.length > 0 && (
          <section className="px-4 sm:px-8 py-12 sm:py-20 bg-cream-dark/60 border-t border-b border-peach">
            <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 sm:gap-12">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-olive-dark mb-2">
                  Puntos de entrega
                </p>
                <h2 className="font-display text-3xl sm:text-4xl text-brown mb-3 max-w-[16ch]">
                  Entregamos en tu oficina
                </h2>
                <p className="text-brown/70 max-w-[44ch]">
                  No entregamos a domicilio de forma individual, sino que cada sede tiene
                  un punto fijo de entrega. Elige tu punto al crear tu cuenta.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {puntos.map((nombre) => (
                  <div
                    key={nombre}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 bg-white border border-peach rounded-full"
                  >
                    <span className="font-display text-base text-brown">{nombre}</span>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-olive-light/40 text-olive-dark">
                      Activo
                    </span>
                  </div>
                ))}
                <p className="text-sm text-brown/55 mt-1">
                  ¿Tu oficina no está en la lista? Escríbenos y valoramos abrir un punto
                  nuevo.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="px-4 sm:px-8 py-16 sm:py-28 text-center">
          <div className="max-w-xl mx-auto flex flex-col items-center gap-4">
            <h2 className="font-display text-3xl sm:text-5xl text-olive-dark leading-tight">
              Tu desayuno de la próxima semana empieza aquí
            </h2>
            <p className="text-brown/70 text-base sm:text-lg max-w-[44ch]">
              Crea tu cuenta en un minuto. Necesitas cuenta solo para pedir — el menú
              siempre es público.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-1">
              <Link href="/registro" className={`${CTA_PRIMARY} !px-8 !py-3.5`}>
                Crear cuenta
              </Link>
              <Link href="/login" className={`${CTA_SECONDARY} !px-8 !py-3.5`}>
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 sm:px-8 py-10 sm:py-14 bg-olive-dark text-cream-dark">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10">
          <div className="flex flex-col gap-3">
            <span className="inline-flex flex-col items-center gap-1 self-start px-5 py-3.5 bg-cream rounded-2xl">
              <Image
                src="/marketing/wellbox-mark-horizontal.png"
                alt="wellBOX"
                width={780}
                height={228}
                className="h-8 w-auto"
              />
            </span>
            <p className="text-sm opacity-75 max-w-[30ch]">
              Desayunos saludables para llevar, entregados en oficina.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-display text-base opacity-90">Contacto</span>
            {whatsapp && <span className="opacity-75">WhatsApp {whatsapp}</span>}
            <span className="opacity-75">Instagram @wellbox_ags</span>
            <span className="opacity-75">Aguascalientes, Ags, MX</span>
          </div>
        </div>
        <p className="max-w-5xl mx-auto mt-8 sm:mt-10 text-xs opacity-55">
          © {new Date().getFullYear()} wellBOX. Todos los derechos reservados.
        </p>
      </footer>
    </div>
    </CartProvider>
  );
}
