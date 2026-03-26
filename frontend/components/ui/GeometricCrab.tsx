import React, { SVGProps } from 'react';

interface GeometricCrabProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

export function GeometricCrab({ className = '', ...props }: GeometricCrabProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes org-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(-1.5deg); }
          66% { transform: translateY(-4px) rotate(1deg); }
        }
        
        @keyframes snap-tech-left {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(-40deg); }
          18% { transform: rotate(15deg); }
          28% { transform: rotate(-5deg); }
          35% { transform: rotate(0deg); }
        }

        @keyframes snap-tech-right {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(40deg); }
          18% { transform: rotate(-15deg); }
          28% { transform: rotate(5deg); }
          35% { transform: rotate(0deg); }
        }

        .crab-float {
          animation: org-float 6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .mech-claw-left {
          transform-origin: 25% 65%;
          animation: snap-tech-left 4.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
        }
        
        .mech-claw-right {
          transform-origin: 75% 65%;
          animation: snap-tech-right 4.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite 0.7s;
        }

        /* Hover Reaction Triggered by .group on the Parent */
        .group:hover .mech-eye-glow {
          fill: #84CC16; /* Verde fluorescente/activo estilo Matrix */
          filter: drop-shadow(0 0 6px rgba(132, 204, 22, 0.8));
        }
        
        .group:hover .mech-claw-left {
          animation: snap-tech-left 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
        }
        
        .group:hover .mech-claw-right {
          animation: snap-tech-right 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite 0.2s;
        }
        
        .group:hover .crab-float {
          animation: org-float 2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
      `}} />
      <svg
        viewBox="0 0 200 200"
        className={`crab-float w-full h-full text-[#FF4D4D] transition-all duration-300 ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" />
            <stop offset="100%" stopColor="#BA1C1C" />
          </linearGradient>
          <linearGradient id="legGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2A2A2A" />
            <stop offset="100%" stopColor="#111111" />
          </linearGradient>
        </defs>

        {/* Patas Mecánicas Traseras (Izquierda) */}
        <g stroke="url(#legGrad)" strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter">
          <path d="M70 125 L25 140 L15 180" />
          <path d="M65 110 L15 110 L5 140" />
          {/* Juntas mecánicas P1 */}
          <circle cx="25" cy="140" r="4.5" fill="#444" stroke="none" />
          <circle cx="15" cy="110" r="4.5" fill="#444" stroke="none" />
        </g>

        {/* Patas Mecánicas Traseras (Derecha) */}
        <g stroke="url(#legGrad)" strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter">
          <path d="M130 125 L175 140 L185 180" />
          <path d="M135 110 L185 110 L195 140" />
          {/* Juntas mecánicas P2 */}
          <circle cx="175" cy="140" r="4.5" fill="#444" stroke="none" />
          <circle cx="185" cy="110" r="4.5" fill="#444" stroke="none" />
        </g>

        {/* Brazo + Pinza Izquierda */}
        <g className="mech-claw-left">
          {/* Brazo segmentado */}
          <path d="M 60 115 L 40 90 L 50 60" stroke="#1A1A1A" strokeWidth="8" strokeLinecap="square" strokeLinejoin="bevel" />
          <circle cx="40" cy="90" r="5" fill="#333" />
          {/* Pinza base (biomecánica) */}
          <path d="M30 60 L65 50 L55 15 Z" fill="url(#bodyGrad)" stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round" />
          {/* Pinza móvil (blanca técnica) */}
          <path d="M65 50 L75 25 L60 20 Z" fill="#F8F9FA" stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round" />
        </g>

        {/* Brazo + Pinza Derecha */}
        <g className="mech-claw-right">
          {/* Brazo segmentado */}
          <path d="M 140 115 L 160 90 L 150 60" stroke="#1A1A1A" strokeWidth="8" strokeLinecap="square" strokeLinejoin="bevel" />
          <circle cx="160" cy="90" r="5" fill="#333" />
          {/* Pinza base (biomecánica) */}
          <path d="M170 60 L135 50 L145 15 Z" fill="url(#bodyGrad)" stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round" />
          {/* Pinza móvil (blanca técnica) */}
          <path d="M135 50 L125 25 L140 20 Z" fill="#F8F9FA" stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round" />
        </g>

        {/* Cuerpo Principal Biomecánico */}
        {/* Caparazón geométrico (Mitad círculo duro) */}
        <path d="M30 130 C 30 70, 170 70, 170 130 C 170 150, 150 165, 100 165 C 50 165, 30 150, 30 130 Z" fill="url(#bodyGrad)" stroke="#1A1A1A" strokeWidth="4.5" />
        
        {/* Placas de armadura internas */}
        <path d="M45 105 Q 100 75 155 105 L 140 120 Q 100 95 60 120 Z" fill="#1A1A1A" opacity="0.18" />
        <path d="M85 160 L 115 160 L 100 145 Z" fill="#1A1A1A" opacity="0.12" />
        
        {/* Detalles técnicos (Marcadores y uniones) */}
        <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="square" opacity="0.6">
          {/* Eje central */}
          <line x1="100" y1="85" x2="100" y2="155" strokeDasharray="6 4" opacity="0.4" />
          {/* Conectores laterales */}
          <path d="M 55 140 L 80 140 L 90 150" fill="none" opacity="0.8" />
          <path d="M 145 140 L 120 140 L 110 150" fill="none" opacity="0.8" />
          {/* Core circular en el medio */}
          <circle cx="100" cy="105" r="16" fill="none" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="100" cy="105" r="7" fill="#ffffff" opacity="0.9" />
        </g>

        {/* Sensor Array (Ojos Biomecánicos) */}
        <g>
          {/* Soportes de los ojos */}
          <rect x="73" y="60" width="14" height="30" rx="3" fill="#1A1A1A" />
          <rect x="113" y="60" width="14" height="30" rx="3" fill="#1A1A1A" />
          
          {/* Tallos de los ojos que conectan al cuerpo */}
          <line x1="80" y1="90" x2="80" y2="110" stroke="#1A1A1A" strokeWidth="7" strokeLinecap="round" />
          <line x1="120" y1="90" x2="120" y2="110" stroke="#1A1A1A" strokeWidth="7" strokeLinecap="round" />

          {/* Lentes / OjosGlowing */}
          {/* Usamos fillcurrentColor mezclado o un class que lo sobreescriba en CSS */}
          <circle cx="80" cy="68" r="4.5" fill="#FFE0E0" className="mech-eye-glow transition-all duration-300" />
          <circle cx="120" cy="68" r="4.5" fill="#FFE0E0" className="mech-eye-glow transition-all duration-300" />
          
          {/* Iris o pupila microscópica */}
          <circle cx="80" cy="68" r="1.5" fill="#1A1A1A" />
          <circle cx="120" cy="68" r="1.5" fill="#1A1A1A" />
        </g>
      </svg>
    </>
  );
}
