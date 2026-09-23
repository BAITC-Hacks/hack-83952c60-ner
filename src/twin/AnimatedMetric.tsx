import React, { useEffect, useRef, useState } from 'react';
import { getLanguage } from '../i18n';

export default function AnimatedMetric({ value, animate, digits = 1 }: { value: number; animate: boolean; digits?: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    if (!animate || typeof requestAnimationFrame === 'undefined') {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const from = previous.current;
    let start: number | undefined;
    let frame = 0;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / 600);
      previous.current = from + (value - from) * (1 - (1 - progress) ** 3);
      setDisplay(previous.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);
  const format = (n: number) => n.toLocaleString(getLanguage(), { maximumFractionDigits: digits });
  return <span aria-label={format(value)}><span aria-hidden="true">{format(display)}</span></span>;
}
