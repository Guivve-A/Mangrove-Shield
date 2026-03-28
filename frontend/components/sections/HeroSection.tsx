import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useT } from '@/lib/i18n/LanguageContext';

export function HeroSection(): JSX.Element {
    const { t } = useT();
    const fullText = t.hero.cta;
    const heroRef = useRef<HTMLElement | null>(null);
    const causticsRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const islandRef = useRef<HTMLDivElement | null>(null);
    const islandImgRef = useRef<HTMLImageElement | null>(null);
    const labelRef = useRef<HTMLParagraphElement | null>(null);
    const titleRef = useRef<HTMLHeadingElement | null>(null);
    const subtitleRef = useRef<HTMLParagraphElement | null>(null);
    const ctaRef = useRef<HTMLButtonElement | null>(null);
    const [ctaText, setCtaText] = useState(fullText);
    const mouseFrameRef = useRef<number | null>(null);
    const typeIntervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

    useEffect(() => {
        if (typeIntervalRef.current) {
            window.clearInterval(typeIntervalRef.current);
            typeIntervalRef.current = null;
        }
        setCtaText(fullText);
    }, [fullText]);

    useEffect(() => {
        const heroElement = heroRef.current;
        if (!heroElement) {
            return;
        }

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

        const ctx = gsap.context(() => {
            // Initial state
            gsap.set([labelRef.current, subtitleRef.current, ctaRef.current], {
                opacity: 0,
                y: 20,
            });

            gsap.set(titleRef.current, {
                opacity: 0,
                y: 30,
            });

            // IMPORTANT FIX:
            // Move centering/offset responsibility from CSS transform to GSAP
            gsap.set(islandRef.current, {
                xPercent: -50,
                yPercent: -50,
                x: 0,
                y: 0,
                rotationZ: 0,
                transformOrigin: '50% 50%',
                force3D: true,
            });

            gsap.set(islandImgRef.current, {
                y: 0,
                force3D: true,
            });

            // ─── Text entrance sequence ───
            const tl = gsap.timeline({ delay: 0.3 });

            tl.to(labelRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power3.out',
            }, 0);

            tl.to(titleRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power3.out',
            }, 0.15);

            tl.to(subtitleRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: 'power3.out',
            }, 0.5);

            tl.to(ctaRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power3.out',
            }, 0.7);

            if (prefersReduced || !hasFinePointer) return;

            // ─── Layer animations ───

            // Layer 2: Caustics slow drift
            gsap.to(causticsRef.current, {
                x: 40,
                y: -30,
                duration: 22,
                ease: 'sine.inOut',
                repeat: -1,
                yoyo: true,
            });

            // Layer 4: Grid subtle horizontal drift
            gsap.to(gridRef.current, {
                backgroundPositionX: '20px',
                duration: 30,
                ease: 'none',
                repeat: -1,
                yoyo: true,
            });

            // Layer 5: Island floating
            gsap.to(islandImgRef.current, {
                y: 10,
                duration: 4.5,
                ease: 'sine.inOut',
                repeat: -1,
                yoyo: true,
            });

            // ─── Mouse Parallax Micro-motion ───
            const xToIsland = gsap.quickTo(islandRef.current, 'x', {
                duration: 0.8,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const yToIsland = gsap.quickTo(islandRef.current, 'y', {
                duration: 0.8,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const rToIsland = gsap.quickTo(islandRef.current, 'rotationZ', {
                duration: 0.8,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const xToGrid = gsap.quickTo(gridRef.current, 'x', {
                duration: 1.0,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const yToGrid = gsap.quickTo(gridRef.current, 'y', {
                duration: 1.0,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const xToTitle = gsap.quickTo(titleRef.current, 'x', {
                duration: 1.2,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const yToTitle = gsap.quickTo(titleRef.current, 'y', {
                duration: 1.2,
                ease: 'power3.out',
                overwrite: 'auto',
            });

            const applyPointerMove = (clientX: number, clientY: number) => {
                if (window.innerWidth < 768) return;

                const rect = heroElement.getBoundingClientRect();
                if (!rect) return;

                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const nx = (clientX - centerX) / (rect.width / 2);
                const ny = (clientY - centerY) / (rect.height / 2);

                xToIsland(nx * 16);
                yToIsland(ny * 10);
                rToIsland(nx * 1.2);

                xToGrid(nx * 8);
                yToGrid(ny * 6);

                xToTitle(nx * -4);
                yToTitle(ny * -2);
            };

            const handlePointerMove = (event: PointerEvent) => {
                const { clientX, clientY } = event;

                if (mouseFrameRef.current !== null) {
                    window.cancelAnimationFrame(mouseFrameRef.current);
                }

                mouseFrameRef.current = window.requestAnimationFrame(() => {
                    mouseFrameRef.current = null;
                    applyPointerMove(clientX, clientY);
                });
            };

            const handlePointerLeave = () => {
                if (mouseFrameRef.current !== null) {
                    window.cancelAnimationFrame(mouseFrameRef.current);
                    mouseFrameRef.current = null;
                }

                xToIsland(0);
                yToIsland(0);
                rToIsland(0);

                xToGrid(0);
                yToGrid(0);

                xToTitle(0);
                yToTitle(0);
            };

            heroElement.addEventListener('pointermove', handlePointerMove, { passive: true });
            heroElement.addEventListener('pointerleave', handlePointerLeave);

            return () => {
                if (mouseFrameRef.current !== null) {
                    window.cancelAnimationFrame(mouseFrameRef.current);
                    mouseFrameRef.current = null;
                }
                heroElement.removeEventListener('pointermove', handlePointerMove);
                heroElement.removeEventListener('pointerleave', handlePointerLeave);
            };
        }, heroRef);

        return () => {
            if (typeIntervalRef.current) {
                clearInterval(typeIntervalRef.current);
            }
            ctx.revert();
        };
    }, []);

    const handleMouseEnterCta = () => {
        if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
        setCtaText("");
        let index = 0;

        typeIntervalRef.current = setInterval(() => {
            index++;
            setCtaText(fullText.slice(0, index));
            if (index >= fullText.length) {
                if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
            }
        }, 35);
    };

    const handleMouseLeaveCta = () => {
        if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
        setCtaText(fullText);
    };

    const handleExplore = () => {
        document.getElementById('mangrove')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section
            id="hero"
            ref={heroRef}
            className="relative min-h-screen bg-[#F7F7F5] text-[#1A1A1A] font-sans overflow-hidden flex flex-col selection:bg-[#093D45] selection:text-white"
        >
            {/* ─── FONDOS & EFECTOS (Clean Tech) ─── */}
            {/* Caustics: ahora muy sutiles, simulando un reflejo técnico claro */}
            <div
                ref={causticsRef}
                className="absolute inset-0 opacity-[0.03] bg-[url('/assets/hero/ocean-caustics-light-overlay.webp')] bg-cover bg-center pointer-events-none z-0"
            />
            {/* Grid: Cuadrícula milimétrica técnica */}
            <div
                ref={gridRef}
                className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"
            />


            {/* ─── LAYOUT PRINCIPAL DEL HERO ─── */}
            <div className="relative z-10 w-full max-w-[1400px] mx-auto px-8 lg:px-16 flex-grow flex items-center mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full">

                    {/* COLUMNA IZQUIERDA: Textos */}
                    <div className="lg:col-span-6 flex flex-col items-start relative z-20">

                        {/* Eyebrow / Etiqueta Técnica */}
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-8 h-[1px] bg-[#1A1A1A]/20"></div>
                            <p ref={labelRef} className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#1A1A1A]/60 font-bold">
                                Coastal Intelligence Platform
                            </p>
                        </div>

                        {/* Título Principal */}
                        <h1 ref={titleRef} className="text-5xl md:text-7xl lg:text-[5.5rem] font-serif leading-[0.95] tracking-tight mb-8 text-[#1A1A1A]">
                            Flood Risk <br />
                            Intelligence <br />
                            <span className="italic text-[#093D45]">for Coastal Cities</span>
                        </h1>

                        {/* Subtítulo */}
                        <p ref={subtitleRef} className="text-base md:text-lg text-[#1A1A1A]/70 leading-relaxed max-w-md font-light">
                            Monitoring mangrove ecosystems and flood vulnerability in Greater Guayaquil, Ecuador.
                        </p>
                    </div>

                    {/* COLUMNA DERECHA: Render Visual (La Isla) */}
                    <div className="lg:col-span-6 relative h-[50vh] lg:h-[80vh] w-full flex items-center justify-center pointer-events-none">

                        {/* Contenedor centralizado para GSAP */}
                        <div
                            ref={islandRef}
                            className="absolute top-1/3 left-1/2 w-full max-w-[600px] lg:max-w-[700px] flex justify-center items-center"
                        >
                            <img
                                ref={islandImgRef}
                                src="/assets/hero/mangrove-ecosystem-island.webp"
                                alt="Mangrove ecosystem island"
                                className="w-full h-auto object-contain drop-shadow-2xl filter contrast-[1.05]"
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                            />
                        </div>

                        {/* Elementos decorativos Clean Tech alrededor de la imagen */}
                        <div className="absolute top-[10%] right-[5%] bg-white/60 backdrop-blur-md px-3 py-1.5 border border-black/5 rounded-sm shadow-sm text-[9px] font-mono tracking-widest text-[#1A1A1A]/50">
                            LAT: -2.1961° S
                        </div>
                        <div className="absolute bottom-[10%] left-[10%] bg-white/60 backdrop-blur-md px-3 py-1.5 border border-black/5 rounded-sm shadow-sm text-[9px] font-mono tracking-widest text-[#1A1A1A]/50">
                            LON: -79.8862° W
                        </div>
                    </div>

                </div>
            </div>

            {/* ─── CTA CENTRAL INFERIOR ─── */}
            <div className="absolute bottom-0 left-0 w-full flex justify-center z-40 pointer-events-none">
                {/* El contenedor interior recobra los eventos del ratón y enmascara el desbordamiento de animación */}
                <div className="pointer-events-auto overflow-hidden p-2">
                    <button
                        ref={ctaRef}
                        type="button"
                        onClick={handleExplore}
                        onMouseEnter={handleMouseEnterCta}
                        onMouseLeave={handleMouseLeaveCta}
                        className="group flex items-center gap-4 bg-[#093D45] hover:bg-[#0D5560] text-white transition-colors duration-300 px-8 py-4 rounded-full shadow-lg hover:shadow-xl"
                    >
                        {/* Aumentado a w-[110px] y text-center para centrar el tipeo en el botón */}
                        <span className="text-[11px] font-bold tracking-widest uppercase font-mono w-[110px] text-center inline-block">
                            {ctaText}<span className="animate-pulse">_</span>
                        </span>
                        <span className="w-px h-4 bg-white/30"></span>
                        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 transform group-hover:translate-y-1 transition-transform">
                            <path d="M8 10L12 14L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Degradado sutil en la parte inferior para fusionarse con la siguiente sección */}
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#F7F7F5] to-transparent pointer-events-none z-30" />
        </section >
    );
}
