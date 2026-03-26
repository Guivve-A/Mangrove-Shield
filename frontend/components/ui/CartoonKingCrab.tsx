import React from 'react';

/**
 * Componente CartoonKingCrab
 * * Un componente SVG animado que representa un cangrejo caricaturesco con corona.
 * Incluye animaciones CSS para flotado, balanceo de corona e interacción (hover) 
 * en las pinzas y corona.
 */
export default function CartoonKingCrab({ className = '', ...props }: React.SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Flote juguetón base */
        @keyframes cartoon-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        /* Balanceo de la corona */
        @keyframes crown-tilt {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        /* Balanceo rápido de la corona para hover */
        @keyframes crown-hover-tilt {
          0%, 100% { transform: rotate(-10deg) translateY(-3px); }
          50% { transform: rotate(10deg) translateY(0px); }
        }

        /* Movimiento de las pinzas (Celebración) */
        @keyframes claw-cheer-l {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes claw-cheer-r {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(15deg); }
        }

        .crab-cartoon-container {
          width: 300px;
          height: 300px;
          cursor: pointer;
        }

        .crab-cartoon-wrapper {
          animation: cartoon-float 3s ease-in-out infinite;
          transform-origin: bottom center;
        }

        .crown-anim {
          transform-origin: 150px 80px;
          animation: crown-tilt 4s ease-in-out infinite;
          transition: transform 0.3s ease;
        }

        .claw-l {
          transform-origin: 80px 160px;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .claw-r {
          transform-origin: 220px 160px;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* --- INTERACCIONES AL HACER HOVER --- */
        /* Link with .group or container hover */
        .group:hover .claw-l, .crab-cartoon-container:hover .claw-l {
          animation: claw-cheer-l 0.6s ease-in-out infinite;
        }
        
        .group:hover .claw-r, .crab-cartoon-container:hover .claw-r {
          animation: claw-cheer-r 0.6s ease-in-out infinite 0.1s;
        }

        .group:hover .crown-anim, .crab-cartoon-container:hover .crown-anim {
          animation: crown-hover-tilt 0.5s ease-in-out infinite;
        }
      `}} />
      
      <div className="crab-cartoon-container">
        <svg
          viewBox="-40 -40 380 380"
          className="crab-cartoon-wrapper w-full h-full drop-shadow-[0_20px_20px_rgba(0,0,0,0.15)] overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/* GRUPO PRINCIPAL: Trazos gruesos, esquinas redondeadas, relleno rojo vibrante */}
          <g stroke="#6B0A0A" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="#F92F2F">
            
            {/* --- PATAS --- */}
            {/* Izquierdas */}
            <path d="M 80 180 Q 20 180 20 220 Q 40 190 70 195 Z" />
            <path d="M 75 200 Q 15 210 25 255 Q 45 220 70 215 Z" />
            <path d="M 85 220 Q 40 240 55 285 Q 70 250 90 235 Z" />
            
            {/* Derechas */}
            <path d="M 220 180 Q 280 180 280 220 Q 260 190 230 195 Z" />
            <path d="M 225 200 Q 285 210 275 255 Q 255 220 230 215 Z" />
            <path d="M 215 220 Q 260 240 245 285 Q 230 250 210 235 Z" />

            {/* --- PINZA IZQUIERDA --- */}
            <g className="claw-l">
              <path d="M 70 160 Q 10 120 40 70 Q 70 110 85 130 Z" />
              <path d="M 60 75 C -10 90, -20 10, 50 10 C 90 10, 100 45, 75 65 C 65 75, 60 75, 60 75 Z" />
              <path d="M 55 80 C 80 110, 110 80, 100 60 C 85 75, 65 80, 55 80 Z" />
            </g>

            {/* --- PINZA DERECHA --- */}
            <g className="claw-r">
              <path d="M 230 160 Q 290 120 260 70 Q 230 110 215 130 Z" />
              <path d="M 240 75 C 310 90, 320 10, 250 10 C 210 10, 200 45, 225 65 C 235 75, 240 75, 240 75 Z" />
              <path d="M 245 80 C 220 110, 190 80, 200 60 C 215 75, 235 80, 245 80 Z" />
            </g>

            {/* --- CUERPO --- */}
            <ellipse cx="150" cy="175" rx="100" ry="70" />
          </g>

          {/* --- CORONA DORADA --- */}
          <g className="crown-anim">
            <path d="M 115 110 L 105 50 L 130 80 L 150 40 L 170 80 L 195 50 L 185 110 Z" 
                  fill="#FFC400" stroke="#8B5A00" strokeWidth="7" strokeLinejoin="round" />
            <polygon points="140,65 150,55 160,65" fill="#FFE866" />
          </g>

          {/* --- CARA --- */}
          <g>
            <circle cx="120" cy="130" r="22" fill="#FFFFFF" stroke="#6B0A0A" strokeWidth="7" />
            <circle cx="180" cy="130" r="22" fill="#FFFFFF" stroke="#6B0A0A" strokeWidth="7" />
            <circle cx="120" cy="132" r="13" fill="#1A0505" />
            <circle cx="180" cy="132" r="13" fill="#1A0505" />
            <circle cx="115" cy="125" r="5" fill="#FFFFFF" />
            <circle cx="175" cy="125" r="5" fill="#FFFFFF" />
            <circle cx="124" cy="139" r="2.5" fill="#FFFFFF" />
            <circle cx="184" cy="139" r="2.5" fill="#FFFFFF" />
          </g>

          {/* BOCA --- */}
          <g>
            <path d="M 120 165 C 120 165, 150 160, 180 165 C 185 195, 175 210, 150 210 C 125 210, 115 195, 120 165 Z" 
                  fill="#4A0B0B" stroke="#6B0A0A" strokeWidth="6" strokeLinejoin="round" />
            <path d="M 130 190 Q 150 175 170 190 Q 160 210 150 210 Q 140 210 130 190 Z" fill="#FF8888" />
          </g>
          
          <path d="M 140 220 Q 150 225 160 220" fill="none" stroke="#B01B1B" strokeWidth="5" strokeLinecap="round" />

          {/* HIGHLIGHTS --- */}
          <g fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity="0.6">
            <path d="M 85 135 Q 150 115 215 135" /> 
            <path d="M 30 40 C 15 55, 20 75, 40 85" /> 
            <path d="M 270 40 C 285 55, 280 75, 260 85" /> 
          </g>

        </svg>
      </div>
    </div>
  );
}
