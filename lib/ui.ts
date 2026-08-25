// Clases compartidas para que todos los botones/links se vean y se sientan igual
// en toda la app. Úsalas en vez de inventar estilos nuevos por pantalla.

export const BTN_PRIMARY =
  "inline-flex items-center justify-center bg-olive text-cream font-semibold rounded-full px-5 py-2.5 disabled:opacity-50";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center bg-white border border-peach text-brown font-semibold rounded-full px-5 py-2.5 disabled:opacity-50";

// Chips pequeños: para acciones dentro de tablas/listas (WhatsApp, publicar, editar, etc.)
export const CHIP_BASE =
  "inline-flex items-center justify-center text-xs font-semibold rounded-full px-3 py-1.5 whitespace-nowrap disabled:opacity-50";
export const CHIP_OLIVE = `${CHIP_BASE} bg-olive text-cream`;
export const CHIP_OLIVE_OUTLINE = `${CHIP_BASE} bg-cream-dark text-olive-dark`;
export const CHIP_DANGER = `${CHIP_BASE} bg-red-50 text-red-600`;

// Links de texto en línea (siempre subrayados, para que se distingan del texto normal)
export const TEXT_LINK =
  "font-semibold text-olive-dark underline underline-offset-2 decoration-olive/40 hover:decoration-olive";
