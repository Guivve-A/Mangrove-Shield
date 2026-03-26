import React from 'react';
import { Github } from 'lucide-react';

import CartoonKingCrab from '@/components/ui/CartoonKingCrab';

export function CTASection(): JSX.Element {
    return (
        <div id="contact" className="relative w-full h-screen overflow-hidden bg-[#fbfbfb] font-mono selection:bg-black selection:text-white">

            {/* ===============================================================
        ESTILOS Y ANIMACIONES PERSONALIZADAS
        ===============================================================
      */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .font-grotesk { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        .animate-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee 25s linear infinite;
        }
      `}} />

            {/* ===============================================================
        FONDOS PASTEL (Inspirado en la imagen de referencia)
        ===============================================================
      */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-[50vw] h-[50vh] bg-[#fdfbe3] rounded-full blur-[120px] opacity-70 transform -translate-x-1/4 -translate-y-1/4"></div>
                <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] bg-[#ebe3fd] rounded-full blur-[120px] opacity-70 transform translate-x-1/4 translate-y-1/4"></div>
            </div>

            {/* ===============================================================
        TEXTO GIGANTE DE FONDO (Marquee)
        ===============================================================
      */}
            <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none overflow-hidden mix-blend-multiply opacity-90 z-0">
                <div className="animate-marquee font-grotesk font-bold text-[14vw] leading-none tracking-tighter text-black whitespace-nowrap">
                    PROTECT THE MANGROVES • SAVE THE COAST • PROTECT THE MANGROVES • SAVE THE COAST •
                </div>
            </div>

            {/* ===============================================================
        CENTRO: MASCOTA Y BOTÓN DE GITHUB
        ===============================================================
      */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">

                {/* Contenedor Flotante General interconectado */}
                <div className="flex flex-col items-center pointer-events-auto mt-12 group">

                    {/* Botón Circular de GitHub (Emulando el "CONTACT US") */}
                    <a
                        href="https://github.com/Guivve-A"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative z-20 mb-[-2rem]"
                    >
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#e3eec1] text-black flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-transform duration-500 hover:scale-105 hover:bg-[#d5e2a8] group-hover:scale-105 group-hover:bg-[#d5e2a8]">
                            <Github className="w-10 h-10 mb-2 transition-transform duration-500 group-hover:-rotate-12" />
                            <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase">
                                GitHub
                            </span>
                        </div>
                    </a>

                    {/* Mascota: Cangrejo Rey Cartoon (SVG) */}
                    <div className="w-64 h-64 md:w-80 md:h-80 relative z-10">
                        <CartoonKingCrab />
                    </div>
                </div>
            </div>

            {/* ===============================================================
        FOOTER LINKS (Navegación inferior minimalista)
        ===============================================================
      */}
            <div className="absolute bottom-0 left-0 w-full p-6 flex justify-center z-20 text-[10px] uppercase tracking-widest text-neutral-500 pointer-events-auto">
                {/* Centro */}
                <div>
                    <a href="#" className="hover:text-black transition-colors font-bold text-black relative after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-[1px] after:bg-black">
                        LinkedIn
                    </a>
                </div>
            </div>
        </div>
    );
}
