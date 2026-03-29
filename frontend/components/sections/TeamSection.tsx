import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useT } from '@/lib/i18n/LanguageContext';

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// ICONOS Y COMPONENTES VISUALES
// ============================================================================

const SpaceRocketIcon = () => (
    <div className="relative w-14 h-14">
        <img
            src="/assets/team/cohete.png"
            alt="Rocket"
            className="w-full h-full object-contain"
        />
        {/* Glow sutil alrededor del cohete */}
        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full -z-10 animate-pulse"></div>
    </div>
);

const PlusIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={`w-4 h-4 ${className || ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

// ============================================================================
// BASE DE DATOS DEL EQUIPO
// ============================================================================

const teamData = [
    {
        id: 1,
        name: "Enna Lozano",
        role: "Programmer",
        fullRole: "Programmer, Speaker",
        image: "/assets/team/member-1.webp",
        bio1: "I am a very perseverant person currently studying Electronic Engineering and Automation. I am 21 years old and passionate about learning and growing both academically and personally.",
        bio2: " In addition to my technical interests, I deeply enjoy dancing, which allows me to express creativity and balance my life. I look forward to continuing to learn and finding ways to combine my professional goals with the things I love most.",
        bio3: "As a member of IAS, I actively foster technological development based on both hardware and software.",
        linkedin: "#"
    },
    {
        id: 2,
        name: "Carlos Espinoza",
        role: "Programmer",
        fullRole: "Lead Researcher ",
        image: "/assets/team/member-2.webp",
        bio1: "As an electronics and automation student with a passion for technology and innovation, Carlos believes in engineering’s potential to transform industrial processes and improve efficiency in the modern world, seeking solutions that integrate cutting-edge hardware and software.",
        bio2: "During his studies at ESPOL, he has focused on developing automation projects that make a real difference. After facing various challenges throughout his academic career, he has specialized in continuous learning and the practical application of complex theories to solve everyday technical problems.",
        bio3: "Carlos aspires to contribute to large-scale projects, distinguishing himself through his analytical skills and his commitment to academic and professional excellence in the field of engineering in Ecuador.",
        linkedin: "#"
    },
    {
        id: 3,
        name: "Guillermo Veliz",
        role: "Programmer",
        fullRole: "Project Leader",
        image: "/assets/team/member-3.webp",
        bio1: "Guillermo is an electronics and automation engineering student at ESPOL. He is leading the development of this project.",
        bio2: "His vision is to create an open-source digital ecosystem where developers from around the world can contribute to the preservation of the coastal environment.",
        bio3: "",
        linkedin: "#"
    },
    {
        id: 4,
        name: "Isaac Pruna",
        role: "Researcher",
        fullRole: "Researcher · ESPOL",
        image: "/assets/team/member-4.webp",
        bio1: "I am a student of Electronics and Automation Engineering at ESPOL, with a background in control systems, electronics, and industrial automation. I am interested in developing technological solutions that improve system performance and facilitate decision-making in industrial environments.",
        bio2: "I have a focus on energy efficiency and process optimization, using data analysis tools and analytical thinking. I seek to contribute to projects that reduce energy consumption, improve operational efficiency, and promote sustainable practices in industry.",
        bio3: "I complement my technical training with leadership, organizational, and teamwork skills, actively participating in student initiatives and academic projects. I adapt easily to new challenges and collaborative environments, contributing with responsibility and proactivity.",
        linkedin: "#"
    }
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function TeamSection() {
    const { t } = useT();
    const [selectedMember, setSelectedMember] = useState<typeof teamData[0] | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const xTo = useRef<any>(null);
    const yTo = useRef<any>(null);

    useGSAP(() => {
        gsap.fromTo('.team-anim-header',
            { y: 50, opacity: 0, filter: 'blur(10px)' },
            {
                y: 0, opacity: 1, filter: 'blur(0px)',
                duration: 1.2,
                ease: 'power3.out',
                stagger: 0.15,
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top 75%'
                }
            }
        );

        gsap.fromTo('.team-anim-card',
            { y: 100, scale: 0.95, opacity: 0 },
            {
                y: 0, scale: 1, opacity: 1,
                duration: 1.5,
                ease: 'power4.out',
                stagger: 0.2,
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top 65%'
                }
            }
        );

        if (cursorRef.current) {
            gsap.set(cursorRef.current, { scale: 0, opacity: 0, rotation: -45, xPercent: -50, yPercent: -50 });

            xTo.current = gsap.quickTo(cursorRef.current, 'x', { duration: 0.1, ease: 'power3' });
            yTo.current = gsap.quickTo(cursorRef.current, 'y', { duration: 0.1, ease: 'power3' });
        }
    }, { scope: containerRef });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (xTo.current && yTo.current) {
                xTo.current(e.clientX);
                yTo.current(e.clientY);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        if (selectedMember) {
            document.body.style.overflow = 'hidden';
            gsap.to(cursorRef.current, { scale: 0, opacity: 0, rotation: -45, duration: 0.2, ease: "power2.in", overwrite: "auto" });
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [selectedMember]);

    const handleCardEnter = () => {
        if (selectedMember) return;
        gsap.to(cursorRef.current, { scale: 1, opacity: 1, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.4)", overwrite: "auto" });
    };

    const handleCardLeave = () => {
        gsap.to(cursorRef.current, { scale: 0, opacity: 0, rotation: -45, duration: 0.2, ease: "power2.in", overwrite: "auto" });
    };

    return (
        <section id="team" ref={containerRef} className="team-section relative min-h-screen bg-wetland-mist text-ocean-dark font-sans selection:bg-sat-cyan/20 selection:text-ocean-dark pb-24">
            <style dangerouslySetInnerHTML={{
                __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@500&display=swap');
        
        .font-grotesk { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        .hide-cursor * { cursor: none !important; }
      `}} />

            <div
                ref={cursorRef}
                className="fixed top-0 left-0 pointer-events-none z-[60] text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)]"
            >
                <div>
                    <SpaceRocketIcon />
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-24 gap-12">
                    <h1 className="team-anim-header text-5xl md:text-7xl font-grotesk font-medium tracking-tighter w-full md:w-1/2">
                        {t.team.heading}
                    </h1>

                    <div className="team-anim-header hidden md:flex flex-col items-center justify-center text-neutral-400 font-mono text-[10px] tracking-widest absolute left-1/2 -translate-x-1/2 mt-4">
                        <span>006 /</span>
                        <span>TEAM</span>
                    </div>

                    <div className="team-anim-header w-full md:w-[40%] text-base md:text-lg font-inter text-neutral-700 leading-relaxed font-light">
                        <p>
                            {t.team.description}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                    {teamData.map((member) => (
                        <div
                            key={member.id}
                            className="team-anim-card group relative h-[380px] md:h-[480px] lg:h-[540px] rounded-sm overflow-hidden hide-cursor bg-neutral-100 cursor-none"
                            onMouseEnter={handleCardEnter}
                            onMouseLeave={handleCardLeave}
                            onClick={() => setSelectedMember(member)}
                        >
                            <img
                                src={member.image}
                                alt={member.name}
                                className="absolute inset-0 block w-full h-full min-w-full min-h-full object-cover object-center brightness-[0.92] contrast-[1.05] saturate-[1.2] transition-transform duration-1000 group-hover:scale-105 group-hover:brightness-[1] group-hover:saturate-[1.3]"
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-mangrove/90 via-estuary/20 to-transparent opacity-80 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-100"></div>

                            <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-10 transition-transform duration-500 group-hover:translate-y-[-10px]">
                                <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-sm w-max font-mono text-[10px] tracking-widest uppercase font-medium">
                                    {member.name}
                                </div>
                                <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-sm w-max font-mono text-[10px] tracking-widest uppercase font-medium">
                                    {member.role}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedMember && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
                    <div
                        className="absolute inset-0 bg-white/40 backdrop-blur-xl transition-opacity duration-500 cursor-pointer"
                        onClick={() => setSelectedMember(null)}
                    ></div>

                    <div className="relative z-10 w-full max-w-6xl h-[90vh] md:h-[85vh] bg-white rounded-md shadow-[0_30px_60px_rgba(0,0,0,0.15)] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                        <button
                            onClick={() => setSelectedMember(null)}
                            className="absolute top-6 right-6 z-20 w-10 h-10 bg-neutral-100 hover:bg-neutral-200 rounded-full flex items-center justify-center transition-colors"
                        >
                            <PlusIcon className="transform rotate-45 text-black" />
                        </button>

                        <div className="w-full md:w-[45%] h-[40vh] md:h-full relative overflow-hidden bg-neutral-100">
                            <img
                                src={selectedMember.image}
                                alt={selectedMember.name}
                                className="absolute inset-0 block w-full h-full min-w-full min-h-full object-cover object-center brightness-[0.92] contrast-[1.05] saturate-[1.2]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-50"></div>
                        </div>

                        <div className="w-full md:w-[55%] h-full overflow-y-auto p-8 md:p-16 flex flex-col justify-center hide-scrollbar">
                            <div className="bg-neutral-200 text-neutral-600 px-3 py-1.5 rounded-sm w-max font-mono text-[10px] tracking-widest uppercase font-bold mb-8">
                                {selectedMember.role}
                            </div>

                            <h2 className="text-5xl md:text-7xl font-grotesk tracking-tighter mb-4 text-black">
                                {selectedMember.name}
                            </h2>
                            <p className="text-sm md:text-base font-inter text-neutral-500 mb-10 pb-10 border-b border-neutral-200">
                                {selectedMember.fullRole}
                            </p>

                            <div className="space-y-6 font-inter text-neutral-700 text-sm md:text-base leading-relaxed font-light mb-12">
                                <p>{selectedMember.bio1}</p>
                                <p>{selectedMember.bio2}</p>
                                <p>{selectedMember.bio3}</p>
                            </div>

                            <a
                                href={selectedMember.linkedin}
                                className="group flex items-center w-max bg-sat-cyan/20 hover:bg-sat-cyan/30 text-ocean-dark transition-colors rounded-sm overflow-hidden"
                            >
                                <span className="px-5 py-3 font-mono text-[10px] uppercase tracking-widest font-bold text-ocean-dark">
                                    {t.team.linkedinLabel}
                                </span>
                                <span className="px-4 py-3 border-l border-ocean-dark/10 flex items-center justify-center group-hover:bg-ocean-dark/5 transition-colors text-ocean-dark">
                                    <PlusIcon />
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
