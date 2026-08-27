"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function HeroCarousel({ photos }: { photos: { src: string; alt: string }[] }) {
  const [activo, setActivo] = useState(0);
  // La foto que estaba antes se queda visible DEBAJO mientras la nueva aparece encima.
  // Sin esto las dos se desvanecían a la vez y, a media transición, el panel se veía
  // en blanco por un instante: dos imágenes al 50% sobre el fondo no tapan nada.
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setActivo((i) => {
        anterior.current = i;
        return (i + 1) % photos.length;
      });
    }, 4500);
    return () => clearInterval(intervalo);
  }, [photos.length]);

  function irA(i: number) {
    if (i === activo) return;
    anterior.current = activo;
    setActivo(i);
  }

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden bg-cream-dark">
      {photos.map((foto, i) => {
        const esActiva = i === activo;
        const esAnterior = i === anterior.current && !esActiva;
        if (!esActiva && !esAnterior) {
          // Las demás siguen montadas —para que el navegador las tenga descargadas—
          // pero sin opacidad ni transición, así no participan del fundido.
          return (
            <div key={foto.src} className="absolute inset-0 opacity-0">
              <Image src={foto.src} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
          );
        }
        return (
          <div
            key={foto.src}
            className={esActiva ? "absolute inset-0 transition-opacity duration-1000 ease-in-out" : "absolute inset-0"}
            style={{ opacity: 1, zIndex: esActiva ? 2 : 1 }}
          >
            <Image
              src={foto.src}
              alt={foto.alt}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        );
      })}

      <div className="absolute left-1/2 bottom-4 -translate-x-1/2 flex gap-2 z-10">
        {photos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            onClick={() => irA(i)}
            aria-label={`Ver foto ${i + 1} de ${photos.length}`}
            aria-current={i === activo}
            className="w-2.5 h-2.5 rounded-full bg-white transition-opacity"
            style={{ opacity: i === activo ? 1 : 0.45, boxShadow: "0 0 0 1.5px rgba(74,56,38,0.45)" }}
          />
        ))}
      </div>
    </div>
  );
}
