import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Initializes clean scroll-reveal animations.
 * Each `.reveal` element fades in + slides up when entering viewport.
 * Elements with `.stagger-children` animate children sequentially.
 */
export function initScrollReveal(): () => void {
  const reveals = gsap.utils.toArray<HTMLElement>('.reveal');

  reveals.forEach((el) => {
    gsap.set(el, { opacity: 0, y: 40 });

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
        });
      },
    });
  });

  // Staggered children
  const staggerContainers = gsap.utils.toArray<HTMLElement>('.stagger-children');
  staggerContainers.forEach((container) => {
    const children = container.children;
    gsap.set(children, { opacity: 0, y: 30 });

    ScrollTrigger.create({
      trigger: container,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(children, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out',
        });
      },
    });
  });

  return () => {
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
}
