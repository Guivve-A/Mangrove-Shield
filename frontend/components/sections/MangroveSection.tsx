import React, { useRef } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface MangroveCardItem {
  tag: string;
  title: string;
  description: string;
  src: string;
  imageAlt: string;
}

/* ═══════════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════════ */

const mangroveData: MangroveCardItem[] = [
  {
    tag: "ALERTA TEMPRANA",
    title: "Protección de Vidas y Bienes Contra Inundaciones",
    description: "El sistema utiliza radar satelital y datos en tiempo real para predecir vulnerabilidades ante inundaciones, permitiendo una alerta temprana para comunidades vulnerables en el estuario.",
    src: "/assets/Utilidades/alerta-temprana.png",
    imageAlt: "Radar satelital e inundaciones"
  },
  {
    tag: "CONSERVACIÓN",
    title: "Preservación de Barreras Naturales",
    description: "Al monitorear la salud del manglar mediante el índice NDVI (Sentinel-2), se protegen los muros naturales que reducen hasta en un 60% la fuerza de las marejadas y el oleaje extremo.",
    src: "/assets/Utilidades/conservacion.png",
    imageAlt: "Manglares desde arriba"
  },
  {
    tag: "ECONOMÍA LOCAL",
    title: "Seguridad Alimentaria y Económica",
    description: "Los manglares de Guayaquil son la 'sala de maternidad' de crustáceos y peces esenciales. El monitoreo constante asegura los medios de vida de miles de recolectores y pescadores.",
    src: "/assets/Utilidades/economia-local.png",
    imageAlt: "Pescador artesanal en estuario"
  },
  {
    tag: "CARBONO AZUL",
    title: "Mitigación del Cambio Climático",
    description: "Identifica áreas de degradación para intervenciones precisas, maximizando la capacidad del estuario para secuestrar hasta 10 veces más carbono que los bosques tropicales terrestres.",
    src: "/assets/Utilidades/carbono-azul.png",
    imageAlt: "Bosque tropical denso y raíces"
  },
  {
    tag: "DATOS ABIERTOS",
    title: "Toma de Decisiones Basada en Evidencia",
    description: "MangroveShield democratiza el acceso a datos geoespaciales (SAR, NDVI, mareas), permitiendo colaborar en estrategias de conservación basadas en datos científicos reales.",
    src: "/assets/Utilidades/datos-abiertos.png",
    imageAlt: "Visión satelital de la tierra y datos"
  }
];

/* ═══════════════════════════════════════════════════
   Card Component
   ═══════════════════════════════════════════════════ */

const Card: React.FC<{ item: MangroveCardItem }> = ({ item }) => {
  return (
    <div
      className="flex flex-col flex-shrink-0 w-[320px] md:w-[400px] snap-start relative group cursor-pointer shadow-lg"
      style={{ clipPath: 'polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 0 100%)' }}
    >
      {/* Mitad superior: Imagen y Tag */}
      <div className="relative h-[220px] w-full overflow-hidden bg-slate-900">
        <Image
          src={item.src}
          alt={item.imageAlt}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />

        <div className="absolute top-0 left-0 z-10">
          <span className="inline-block bg-white text-black text-[10px] md:text-xs font-bold tracking-wider uppercase px-3 py-1.5 mt-4 ml-4">
            {item.tag}
          </span>
        </div>
      </div>

      {/* Mitad inferior: Texto */}
      <div className="bg-white p-6 md:p-8 flex-grow flex flex-col justify-start min-h-[220px] transition-colors duration-300 group-hover:bg-slate-50">
        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 mb-4 leading-tight">
          {item.title}
        </h3>
        <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium">
          {item.description}
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   Main Section
   ═══════════════════════════════════════════════════ */

export function MangroveSection(): JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const scrollAmount = 400;

      if (direction === 'right') {
        // Check if we are at the end (with a small buffer for subpixel issues)
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10;
        if (isAtEnd) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      } else {
        // Check if we are at the start
        const isAtStart = scrollLeft <= 10;
        if (isAtStart) {
          scrollContainerRef.current.scrollTo({ left: scrollWidth, behavior: 'smooth' });
        } else {
          scrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <section id="mangroves" className="section section-light !min-h-0 !items-start overflow-hidden py-16 md:py-24">
      <div className="section-inner w-full">

        {/* Header Section */}
        <div className="w-full mb-12">
          <div className="accent-line mb-6 reveal" />
          <p className="reveal text-sm md:text-base text-blue-600 font-bold tracking-widest uppercase mb-4 text-center md:text-left">
            Proyecto Resiliencia Guayaquil
          </p>
          <h2 className="reveal text-3xl md:text-5xl lg:text-6xl font-medium tracking-tight text-center md:text-left max-w-4xl text-slate-900 mb-6">
            MangroveShield no es solo tecnología. Es infraestructura crítica.
          </h2>

          <div className="flex flex-col md:flex-row justify-between items-end gap-6 mt-8">
            <p className="reveal text-lg md:text-xl text-slate-600 max-w-2xl text-center md:text-left">
              Aquí presentamos las 5 razones fundamentales de su impacto en la resiliencia climática del estuario.
            </p>

            {/* Navigation Buttons (Desktop) */}
            <div className="reveal hidden md:flex gap-3">
              <button
                onClick={() => scroll('left')}
                className="p-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 text-slate-700"
                aria-label="Scroll left"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={() => scroll('right')}
                className="p-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 text-slate-700"
                aria-label="Scroll right"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Section */}
        <div className="reveal w-full relative">
          {/* Scroll Hint (Mobile) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-24 h-full bg-gradient-to-l from-[#F2F6F5] to-transparent z-10 pointer-events-none md:hidden" />

          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-6 snap-x snap-mandatory pb-12 pt-4 pr-16 
                       scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {mangroveData.map((item, index) => (
              <Card key={index} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
