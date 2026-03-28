import React, { useState, useEffect, useCallback } from 'react';
import { Oswald } from 'next/font/google';
import { useT } from '@/lib/i18n/LanguageContext';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});


export function OutcomesSection() {
  const { t } = useT();
  const EXPLANATION_CARDS = t.outcomes.cards;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextCard = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % EXPLANATION_CARDS.length);
  }, []);

  const prevCard = () => {
    setActiveIndex((prev) => (prev - 1 + EXPLANATION_CARDS.length) % EXPLANATION_CARDS.length);
    setIsAutoPlaying(false); // Detener autoplay si el usuario interactúa
  };

  const handleNextClick = () => {
    nextCard();
    setIsAutoPlaying(false); // Detener autoplay si el usuario interactúa
  };

  const goToCard = (index: number) => {
    setActiveIndex(index);
    setIsAutoPlaying(false);
  };

  // Autoplay sutil
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextCard, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextCard]);

  return (
    <section id="outcomes" className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#FAFAFA] py-20 font-sans">
      {/* Background Decorativo (Blur blobs basados en la imagen 2) */}
      <div className="pointer-events-none absolute bottom-10 left-10 h-64 w-64 rounded-full bg-[#FCE166] opacity-20 blur-[100px]" />
      <div className="pointer-events-none absolute right-10 top-1/4 h-80 w-80 rounded-full bg-[#1A1A1A] opacity-5 blur-[120px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4">
        {/* Encabezado de la Sección */}
        <div className="mb-16 text-center">
          <span className="mb-4 block font-mono text-[11px] uppercase tracking-[0.3em] text-black/50">
            {t.outcomes.badgeLabel}
          </span>
          <h2
            className={`${oswald.className} text-4xl uppercase leading-none tracking-[0.05em] text-[#1A1A1A] md:text-6xl`}
          >
            {t.outcomes.title}
          </h2>
        </div>

        {/* Contenedor del Carrusel de Tarjetas Apiladas */}
        <div className="relative flex h-[480px] w-full max-w-4xl justify-center perspective-[1000px] md:h-[520px]">
          {EXPLANATION_CARDS.map((card, index) => {
            // Calcular la posición relativa de la tarjeta respecto a la activa
            let offset = index - activeIndex;
            // Manejar carrusel infinito circular
            if (offset < 0) offset += EXPLANATION_CARDS.length;

            // Solo renderizar las primeras 3 tarjetas visibles
            if (offset > 2) return null;

            const isFront = offset === 0;

            return (
              <div
                key={index}
                className="absolute top-0 w-full max-w-[850px] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{
                  zIndex: 30 - offset * 10,
                  transform: `translateY(-${offset * 24}px) scale(${1 - offset * 0.05})`,
                  opacity: isFront ? 1 : offset === 1 ? 0.7 : 0.3,
                  pointerEvents: isFront ? 'auto' : 'none',
                }}
              >
                <div className="group relative h-[400px] w-full overflow-hidden rounded-md bg-[#0D1219] shadow-2xl md:h-[450px]">
                  {/* Fondo Base con Textura Oscura */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#121A24] to-[#070A0F]" />

                  {/* Imagen de fondo simulada (Ruido/Mapa) */}
                  <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay">
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
                      <filter id="noiseFilter">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                      </filter>
                      <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                    </svg>
                  </div>

                  {/* Cuadrícula Técnica (Grid) superpuesta */}
                  <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:40px_40px]" />

                  {/* Cruces Decorativas (Crosshairs) */}
                  <div className="absolute left-1/3 top-1/4 h-8 w-8 border border-white/10">
                    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
                    <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/30" />
                  </div>
                  <div className="absolute bottom-1/3 right-1/4 h-12 w-12 border border-white/10">
                    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
                    <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/30" />
                  </div>

                  {/* Contenido de la Tarjeta */}
                  <div className="relative flex h-full flex-col items-center justify-center p-8 text-center md:p-12">
                    {/* Tag / Pastilla Amarilla */}
                    <div className="mb-10 rounded bg-[#FCE166] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-[#1A1A1A] shadow-[0_0_20px_rgba(252,225,102,0.5)]">
                      {card.tag}
                    </div>

                    {/* Texto Central */}
                    <h3
                      className={`${oswald.className} mb-12 max-w-2xl text-2xl font-medium leading-tight text-white md:text-3xl lg:text-4xl`}
                      style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}
                    >
                      {card.description}
                    </h3>

                    {/* Botón Decorativo */}
                    <button className="rounded-full border border-[#FCE166] bg-[#FCE166]/10 px-8 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#FCE166] backdrop-blur-md transition-all duration-300 hover:bg-[#FCE166] hover:text-[#1A1A1A] active:scale-95">
                      {t.outcomes.inspectButton}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controles de Navegación Inferiores */}
        <div className="mt-4 flex items-center justify-center gap-6">
          {/* Botón Prev */}
          <button
            onClick={prevCard}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FCE166] text-black shadow-md transition-transform hover:scale-105 active:scale-95"
            aria-label="Anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Paginación */}
          <div className="flex items-center gap-3">
            {EXPLANATION_CARDS.map((_, index) => (
              <button
                key={index}
                onClick={() => goToCard(index)}
                className={`transition-all duration-300 ${
                  index === activeIndex
                    ? 'flex h-4 w-4 items-center justify-center border border-[#1A1A1A]' 
                    : 'h-1.5 w-1.5 rounded-sm bg-black/30 hover:bg-black/60'
                }`}
                aria-label={`Ir a diapositiva ${index + 1}`}
              >
                {index === activeIndex && <div className="h-1.5 w-1.5 bg-[#1A1A1A]" />}
              </button>
            ))}
          </div>

          {/* Botón Next */}
          <button
            onClick={handleNextClick}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FCE166] text-black shadow-md transition-transform hover:scale-105 active:scale-95"
            aria-label="Siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
