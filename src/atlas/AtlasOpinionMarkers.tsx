import { useEffect, useRef } from 'react';
import { Marker, type Map as LibreMap } from 'maplibre-gl';
import type { AtlasOpinionPlace } from './opinions';

interface Props {
  map: LibreMap | null;
  places: readonly AtlasOpinionPlace[];
  selectedId?: string;
  onSelect: (place: AtlasOpinionPlace) => void;
}

/** Native geographic markers remain keyboard accessible and follow the map camera. */
export function AtlasOpinionMarkers({ map, places, selectedId, onSelect }: Props) {
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!map) return;
    const markers = places.map(place => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `at-opinion-marker${selectedId === place.id ? ' is-selected' : ''}`;
      button.setAttribute('aria-label', `Комментарии агентов: ${place.name} (${place.comments.length})`);
      button.setAttribute('aria-pressed', String(selectedId === place.id));
      button.title = `${place.name} · мнения агентов`;
      // Static icon markup; all data content is written as text.
      button.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 7h8M6 11h5" stroke="currentColor" stroke-width="1.4"/></svg>';
      const count = document.createElement('span');
      count.textContent = String(place.comments.length);
      button.append(count);
      button.addEventListener('click', event => { event.stopPropagation(); select.current(place); });
      button.addEventListener('pointerdown', event => event.stopPropagation());
      const marker = new Marker({ element: button, anchor: 'bottom', offset: [0, -8], pitchAlignment: 'viewport' }).setLngLat(place.position).addTo(map);
      return { marker, button, place };
    });
    const declutter = () => {
      const occupied: Array<{ x: number; y: number }> = [];
      const bounds = map.getContainer();
      for (const { button, place } of [...markers].sort((a, b) => Number(b.place.id === selectedId) - Number(a.place.id === selectedId))) {
        const point = map.project(place.position);
        const visible = point.x >= 0 && point.y >= 0 && point.x <= bounds.clientWidth && point.y <= bounds.clientHeight
          && !occupied.some(other => Math.abs(other.x - point.x) < 56 && Math.abs(other.y - point.y) < 42);
        button.hidden = !visible;
        if (visible) occupied.push(point);
      }
    };
    declutter();
    map.on('move', declutter);
    map.on('resize', declutter);
    return () => {
      map.off('move', declutter);
      map.off('resize', declutter);
      markers.forEach(({ marker }) => marker.remove());
    };
  }, [map, places, selectedId]);
  return null;
}
