import { gsap } from 'gsap';

/** Smooth fade-in with upward motion */
export function revealUp(element: HTMLElement, delay = 0): gsap.core.Tween {
  return gsap.fromTo(
    element,
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.8, delay, ease: 'power3.out' },
  );
}

/** Subtle scale reveal */
export function revealScale(element: HTMLElement, delay = 0): gsap.core.Tween {
  return gsap.fromTo(
    element,
    { opacity: 0, scale: 0.95 },
    { opacity: 1, scale: 1, duration: 0.7, delay, ease: 'power3.out' },
  );
}

/** Animate a number counter from 0 to target */
export function counterAnimate(
  element: HTMLElement,
  target: number,
  decimals = 0,
  duration = 2,
): gsap.core.Tween {
  const proxy = { value: 0 };
  return gsap.to(proxy, {
    value: target,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = proxy.value.toFixed(decimals);
    },
  });
}
