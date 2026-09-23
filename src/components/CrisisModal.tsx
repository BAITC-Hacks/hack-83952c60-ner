import { t, useLanguage } from '../i18n';
import React from 'react';
import { ShieldAlert, X, AlertTriangle, Flame, Wind, Users } from 'lucide-react';
import { CityEvent } from '../engine/types';
import { CITY_EVENTS } from '../data/events';

interface CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvents: CityEvent[];
  onToggleEvent: (event: CityEvent) => void;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({
  isOpen,
  onClose,
  activeEvents,
  onToggleEvent,
}) => {
  useLanguage();
  if (!isOpen) return null;

  const isEventActive = (id: string) => activeEvents.some((e) => e.id === id);

  const getEventIcon = (id: string) => {
    switch (id) {
      case 'blizzard':
        return <Wind size={20} color="var(--color-cyan)" />;
      case 'heating_pipe_break':
        return <Flame size={20} color="var(--color-rose)" />;
      case 'smog_inversion':
        return <AlertTriangle size={20} color="#f59e0b" />;
      default:
        return <Users size={20} color="var(--color-purple)" />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: '24px',
          background: 'var(--surface-modal)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="#f59e0b" />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {t("Городские форс-мажоры (Стресс-тестирование)")}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t("Проверьте устойчивость выбранного сценария к непредвиденным городским кризисам Астаны")}</p>
            </div>
          </div>
          <button
            aria-label={t('Закрыть')}
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {CITY_EVENTS.map((event) => {
            const active = isEventActive(event.id);
            return (
              <div
                key={event.id}
                style={{
                  padding: '14px',
                  background: active ? 'rgba(245, 158, 11, 0.1)' : 'var(--surface-subtle)',
                  border: active ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'var(--surface-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {getEventIcon(event.id)}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {t(event.titleRu)}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {t(event.descriptionRu)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onToggleEvent(event)}
                  className={active ? 'btn-primary' : 'btn-secondary'}
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.75rem',
                    flexShrink: 0,
                    background: active ? '#f59e0b' : undefined,
                    borderColor: active ? '#d97706' : undefined,
                    color: active ? '#17263c' : undefined,
                  }}
                >
                  {active ? t("Активен") : t("Смоделировать")}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'right' }}>
          <button onClick={onClose} className="btn-primary" style={{ padding: '8px 20px' }}>
            {t("Закрыть и посмотреть последствия")}</button>
        </div>
      </div>
    </div>
  );
};
