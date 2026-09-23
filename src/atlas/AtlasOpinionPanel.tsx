import { useEffect, useRef } from 'react';
import { MapPin, MessageCircle, X } from 'lucide-react';
import type { AtlasOpinionPlace } from './opinions';

const categoryNames = { education: 'Образование', health: 'Медицина', transport: 'Транспорт', public: 'Городское пространство' };
const sentimentNames = { positive: 'Поддерживает', neutral: 'Предлагает', negative: 'Беспокоится' };

export function AtlasOpinionPanel({ place, onClose }: { place: AtlasOpinionPlace; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    panel.current?.scrollTo?.(0, 0);
    close.current?.focus({ preventScroll: true });
  }, [place.id]);
  return <section ref={panel} className="at-opinions-panel" aria-label={`Мнения агентов: ${place.name}`} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header className="at-opinions-heading"><span><MessageCircle size={16} /> ГОЛОСА ГОРОДА</span><button ref={close} aria-label="Закрыть мнения агентов" onClick={onClose}><X size={17} /></button></header>
    <div className="at-opinions-place"><span><MapPin size={12} />{categoryNames[place.category]}</span><h2>{place.name}</h2><p>{place.comments.length} мнения виртуальных жителей</p></div>
    <div className="at-opinions-note"><span>СИМУЛЯЦИЯ</span>Реплики персонажей модели с учётом их интересов. Это не отзывы реальных посетителей.</div>
    <div className="at-opinion-comments">{place.comments.map(comment => <article className="at-opinion-comment" key={comment.id}>
      <header><span className={`at-agent-avatar is-${comment.sentiment}`} aria-hidden="true">{comment.agentName.split(' ').slice(0, 2).map(word => word[0]).join('')}</span><div><h3>{comment.agentName}</h3><p>{comment.profession} · {comment.districtName}</p></div></header>
      <div className="at-comment-meta"><span className={`at-comment-sentiment is-${comment.sentiment}`}>{sentimentNames[comment.sentiment]}</span><span>{comment.topic}</span></div>
      <p className="at-comment-text">{comment.text}</p>
      <footer><span>Напряжение агента</span><div className="at-agent-stress" role="meter" aria-label={`Напряжение: ${comment.agentName}`} aria-valuenow={comment.stress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${comment.stress}%` }} /></div><b>{comment.stress}%</b></footer>
    </article>)}</div>
  </section>;
}
