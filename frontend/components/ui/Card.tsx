import clsx from 'clsx';
import type { HTMLAttributes, PropsWithChildren } from 'react';

interface CardProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
  className?: string;
  title?: string;
  subtitle?: string;
  animateTag?: string;
}

export function Card({ className, title, subtitle, animateTag, children, ...rest }: CardProps): JSX.Element {
  return (
    <section
      {...rest}
      data-animate-card={animateTag || undefined}
      className={clsx(
        'glass-card p-4 transition-all duration-300',
        className,
      )}
    >
      {title ? (
        <h3 className="font-sans text-sm font-semibold tracking-tight text-slate-100">{title}</h3>
      ) : null}
      {subtitle ? (
        <p className="mt-1 text-[11px] text-slate-400/90">{subtitle}</p>
      ) : null}
      {(title || subtitle) && children ? <div className="glow-line mt-3" /> : null}
      {children ? <div className={clsx(title || subtitle ? 'mt-3' : '')}>{children}</div> : null}
    </section>
  );
}
