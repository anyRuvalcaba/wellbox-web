"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function HeroCarousel({ photos }: { photos: { src: string; alt: string }[] }) {
  const [activo, setActivo] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setActivo((i) => (i + 1) % photos.length);
    }, 4500);
    return () => clearInterval(intervalo);
  }, [photos.length]);

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden">
      {photos.map((foto, i) => (
        <div
          key={foto.src}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === activo ? 1 : 0 }}
        >
          <Image src={foto.src} alt={foto.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" priority={i === 0} />
        </div>
      ))}
      <div className="absolute left-1/2 bottom-4 -translate-x-1/2 flex gap-2 z-10">
        {photos.map((foto, i) => (
          <button
            key={foto.src}
            type="button"
            onClick={() => setActivo(i)}
            aria-label={`Foto ${i + 1}`}
            className="w-2.5 h-2.5 rounded-full bg-white transition-opacity"
            style={{ opacity: i === activo ? 1 : 0.45, boxShadow: "0 0 0 1.5px rgba(74,56,38,0.45)" }}
          />
        ))}
      </div>
    </div>
  );
}
