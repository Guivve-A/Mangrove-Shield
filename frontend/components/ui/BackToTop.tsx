import React, { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { gsap } from 'gsap';

export const BackToTop: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            // Visibilidad inteligente (umbral de 400px)
            const scrollTop = window.scrollY;
            setIsVisible(scrollTop > 400);

            // Cálculo de progreso de scroll
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;
            setProgress(scrollPercent);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    // SVG Circular Progress Constants
    const size = 56;
    const strokeWidth = 2;
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <button
            onClick={scrollToTop}
            className={`fixed bottom-8 right-8 z-[90] flex items-center justify-center transition-all duration-500 ease-out group 
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}
            aria-label="Back to top"
        >
            {/* Indicador de Progreso Circular */}
            <svg
                width={size}
                height={size}
                className="absolute transform -rotate-90"
            >
                {/* Círculo de fondo (Track) */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-white/5"
                />
                {/* Círculo de progreso (Teal) */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="#2dd4bf"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{ 
                        strokeDashoffset: offset,
                        transition: 'stroke-dashoffset 0.1s linear'
                    }}
                    strokeLinecap="round"
                />
            </svg>

            {/* Cuerpo del Botón (FAB) */}
            <div className="relative w-11 h-11 rounded-full flex items-center justify-center bg-[#0a1219]/30 backdrop-blur-xl border border-white/10 text-[#2dd4bf] shadow-lg group-hover:bg-white/10 group-hover:shadow-[0_0_20px_rgba(45,212,191,0.2)] transition-all duration-500">
                <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-500" />
            </div>

            {/* Tooltip / Label Técnica (Opcional, estilo core) */}
            <span className="absolute right-full mr-4 px-2 py-1 bg-[#0a1219]/80 backdrop-blur-md border border-white/10 text-[9px] font-mono tracking-widest text-[#2dd4bf] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                RETURN TO SURFACE
            </span>
        </button>
    );
};
