import React, { useRef } from 'react';
import '../workspace.css';

interface Props<T extends string> {
  idPrefix: string;
  label: string;
  items: readonly { id: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Controlled tabs; panels use `${idPrefix}-panel-${id}` and stay mounted. */
export function WorkspaceTabs<T extends string>({ idPrefix, label, items, value, onChange }: Props<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="workspace-tabs" role="tablist" aria-label={label}>
    {items.map((item, index) => <button
      type="button" role="tab" key={item.id} id={`${idPrefix}-tab-${item.id}`}
      aria-controls={`${idPrefix}-panel-${item.id}`} aria-selected={value === item.id}
      aria-labelledby={`${idPrefix}-label-${item.id}`} aria-describedby={item.description ? `${idPrefix}-hint-${item.id}` : undefined}
      tabIndex={value === item.id ? 0 : -1} ref={button => { buttons.current[index] = button; }}
      onClick={() => onChange(item.id)}
      onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % items.length
          : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(items[next].id);
        buttons.current[next]?.focus();
      }}
    ><span id={`${idPrefix}-label-${item.id}`}>{item.label}</span>{item.description && <small id={`${idPrefix}-hint-${item.id}`}>{item.description}</small>}</button>)}
  </div>;
}
