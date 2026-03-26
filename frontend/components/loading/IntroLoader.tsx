import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface IntroLoaderProps {
    onComplete: () => void;
}

const CARDS = [
    { id: 1, name: 'mangrove-roots.webp', startX: 0, startY: 220, rot: -6, time: 1.0, finalX: '-34vw', finalY: '-30vh' },
    { id: 2, name: 'mangrove-leaf.webp', startX: 220, startY: 0, rot: 5, time: 1.35, finalX: '-36vw', finalY: '30vh' },
    { id: 3, name: 'coastal-wildlife.webp', startX: -220, startY: 0, rot: -3, time: 1.7, finalX: '0vw', finalY: '36vh' },
    { id: 4, name: 'mangrove-canopy-satellite.webp', startX: 0, startY: -220, rot: 4, time: 2.05, finalX: '34vw', finalY: '-30vh' },
    { id: 5, name: 'coastal-protection.webp', startX: 0, startY: 220, rot: -5, time: 2.4, finalX: '36vw', finalY: '30vh' },
];

export function IntroLoader({ onComplete }: IntroLoaderProps): JSX.Element {
    const loaderRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const logoWrapRef = useRef<HTMLDivElement | null>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
    const completedRef = useRef(false);

    useEffect(() => {
        const logoEl = logoWrapRef.current;
        const overlayEl = overlayRef.current;
        const cardEls = cardsRef.current.filter(Boolean) as HTMLDivElement[];

        if (!loaderRef.current || !logoEl || !overlayEl || cardEls.length !== CARDS.length) {
            return;
        }

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                defaults: { ease: 'power2.out' },
            });

            gsap.set(logoEl, {
                scale: 0.82,
                opacity: 0,
            });

            CARDS.forEach((card, i) => {
                gsap.set(cardEls[i], {
                    x: card.startX,
                    y: card.startY,
                    rotation: 0,
                    opacity: 0,
                    scale: 0.88,
                    zIndex: 20 + i,
                    force3D: true,
                });
            });

            tl.to(logoEl, {
                scale: 1,
                opacity: 1,
                duration: 0.75,
                ease: 'power3.out',
            }, 0);

            CARDS.forEach((card, i) => {
                if (i === 0) {
                    tl.to(logoEl, {
                        opacity: 0.14,
                        duration: 0.45,
                        ease: 'power2.inOut',
                    }, card.time);
                }

                tl.to(cardEls[i], {
                    x: 0,
                    y: 0,
                    rotation: card.rot,
                    opacity: 1,
                    scale: 1,
                    duration: 0.65,
                    ease: 'back.out(1.15)',
                }, card.time);
            });

            const disperseTime = 3.45;
            const disperseDuration = 1.2;
            const loaderEndTime = disperseTime + disperseDuration + 0.15;

            tl.to(logoEl, {
                opacity: 0,
                scale: 0.8,
                duration: 0.7,
                ease: 'power2.in',
            }, disperseTime);

            tl.to(overlayEl, {
                opacity: 0,
                duration: 0.95,
                ease: 'power2.inOut',
            }, disperseTime);

            CARDS.forEach((card, i) => {
                tl.to(cardEls[i], {
                    x: card.finalX,
                    y: card.finalY,
                    rotation: card.rot * 1.5,
                    scale: 0.5,
                    duration: disperseDuration,
                    ease: 'power3.inOut',
                }, disperseTime);
            });

            tl.call(() => {
                if (completedRef.current) return;
                completedRef.current = true;
                onComplete();
            }, [], loaderEndTime);
        }, loaderRef);

        return () => {
            ctx.revert();
        };
    }, [onComplete]);

    return (
        <div ref={loaderRef} className="intro-loader" aria-hidden="true">
            <div ref={overlayRef} className="intro-loader__overlay">
                <img
                    src="/assets/loading/background/scientific-grid.webp"
                    className="intro-loader__bg-img"
                    alt=""
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.4,
                        zIndex: 0,
                    }}
                />
                <div className="intro-loader__bg" />
                <div className="intro-loader__crosses" />
            </div>

            <div ref={logoWrapRef} className="intro-loader__logo-wrap">
                <img
                    src="/assets/loading/logo/mangrove-shield-symbol.svg"
                    className="intro-loader__logo"
                    alt="MangroveShield Intro Logo"
                />
            </div>

            <div className="intro-loader__cards">
                {CARDS.map((card, i) => (
                    <div
                        key={card.id}
                        ref={(el) => {
                            cardsRef.current[i] = el;
                        }}
                        className={`intro-loader__card intro-loader__card--${card.id}`}
                    >
                        <img
                            src={`/assets/loading/cards/${card.name}`}
                            className="intro-loader__card-image"
                            alt=""
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
