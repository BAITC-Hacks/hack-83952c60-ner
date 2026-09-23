import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ChartTooltip.css';

interface ChartTooltipProps {
  label: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

/** A chart remains visible; its short explanation is available by hover, focus or tap. */
export function ChartTooltip({ label, description, children, className = '' }: ChartTooltipProps) {
  const id = useId();
  const trigger = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touch = useRef<{ x: number; y: number; wasOpen: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const positionTooltip = useCallback(() => {
    if (!trigger.current || !tooltip.current) return;
    const target = trigger.current.getBoundingClientRect();
    const box = tooltip.current.getBoundingClientRect();
    const left = Math.max(12, Math.min(target.left + target.width / 2 - box.width / 2, window.innerWidth - box.width - 12));
    const top = target.top >= box.height + 20 ? target.top - box.height - 8 : Math.min(target.bottom + 8, window.innerHeight - box.height - 12);
    setPosition({ left, top: Math.max(12, top) });
  }, []);
  const clearHide = () => { clearTimeout(hideTimer.current); };
  const show = () => { clearHide(); setOpen(true); };
  const hideSoon = () => {
    clearHide();
    if (trigger.current?.contains(document.activeElement)) return;
    hideTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const close = () => { clearHide(); setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !tooltip.current?.contains(target)) close();
    };
    const viewportChanged = () => {
      const chart = trigger.current;
      if (chart?.contains(document.activeElement)) {
        const rect = chart.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
          && rect.top < window.innerHeight && rect.left < window.innerWidth;
        if (visible) { positionTooltip(); return; }
      }
      close();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', viewportChanged, true);
    window.addEventListener('resize', viewportChanged);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', viewportChanged, true);
      window.removeEventListener('resize', viewportChanged);
    };
  }, [open, positionTooltip]);

  useLayoutEffect(() => {
    if (open) positionTooltip();
  }, [open, description, positionTooltip]);

  return <>
    <div ref={trigger} className={`chart-tooltip-target ${className}`} role="group" tabIndex={0}
      aria-label={label} aria-describedby={open ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== 'touch') show(); }}
      onPointerLeave={event => { if (event.pointerType !== 'touch') hideSoon(); }}
      onFocus={show}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { clearHide(); setOpen(false); } }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); clearHide(); setOpen(value => !value); }
      }}
      onPointerDown={event => {
        if (event.pointerType === 'touch') touch.current = { x: event.clientX, y: event.clientY, wasOpen: open };
      }}
      onPointerUp={event => {
        const start = touch.current;
        touch.current = null;
        if (event.pointerType === 'touch' && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) {
          clearHide();
          setOpen(!start.wasOpen);
        }
      }}
      onPointerCancel={() => { touch.current = null; }}
    >{children}</div>
    {open && typeof document !== 'undefined' && createPortal(
      <div ref={tooltip} id={id} role="tooltip" className="chart-tooltip-bubble" style={position}
        onPointerEnter={clearHide} onPointerLeave={hideSoon}>{description}</div>,
      document.fullscreenElement ?? document.body,
    )}
  </>;
}
