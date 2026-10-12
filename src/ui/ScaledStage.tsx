import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders children on a fixed-size canvas (e.g. 1280×800) and scales it to fit
 * the container. The tablet and the Mac mirror use the same stage, so the
 * mirror is an exact, pixel-for-pixel copy of what guests see.
 */
export function ScaledStage({
  width,
  height,
  className,
  children,
}: {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      setScale(Math.min(w / width, h / height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div ref={outer} className={`stage-outer ${className ?? ''}`}>
      <div
        className="stage-inner"
        style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
