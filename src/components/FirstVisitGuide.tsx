import React from 'react';
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import { t, useLanguage } from '../i18n';
import { GUIDE_STEPS, GuideStep } from '../onboarding/useFirstVisitGuide';
import './FirstVisitGuide.css';

const steps = {
  district: { title: 'Выберите район', description: 'Укажите район в поле ниже. Меры для района будут направлены туда по умолчанию.' },
  problem: { title: 'Выберите проблему', description: 'Нажмите на один из трёх показателей ниже. Каталог покажет меры, которые его улучшают.' },
  measures: { title: 'Подберите пять мер', description: 'Добавьте пять совместимых мер в пределах 100 у.е. Чтобы дополнить план, нажмите «Показать все меры» или смените категорию.' },
  review: { title: 'Изучите результат', description: 'Сравните показатели до и после решений. Наведите курсор на график, коснитесь его или выделите клавишей Tab для короткой подсказки.' },
} as const;

interface Props {
  step: GuideStep;
  districtName: string;
  problemName: string | null;
  decisionCount: number;
  remainingBudget: number;
  valid: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function FirstVisitGuide({ step, districtName, problemName, decisionCount, remainingBudget, valid, onNext, onBack, onSkip }: Props) {
  useLanguage();
  const index = GUIDE_STEPS.indexOf(step);
  const canContinue = step === 'problem' ? Boolean(problemName) : step === 'measures' ? valid : true;
  const button = step === 'district' ? t('Продолжить с районом {0}', [districtName])
    : step === 'problem' ? t('К подбору мер')
      : step === 'measures' ? t('Посмотреть результат') : t('Завершить знакомство');
  return <section className="first-visit-guide" aria-labelledby="first-visit-guide-title" data-guide-step={step}>
    <div className="first-visit-guide__top">
      <span><Compass size={17} aria-hidden="true" />{t('Быстрый старт · шаг {0} из 4', [index + 1])}</span>
      <button type="button" className="first-visit-guide__skip" onClick={onSkip}>{t('Пропустить знакомство')}</button>
    </div>
    <ol className="first-visit-guide__steps" aria-label={t('Этапы знакомства')}>
      {GUIDE_STEPS.map((item, i) => <li key={item} aria-current={item === step ? 'step' : undefined} className={i < index ? 'is-complete' : ''}>
        <span className="first-visit-guide__number" aria-hidden="true">{i < index ? <Check size={12} /> : i + 1}</span>
        <span>{t(steps[item].title)}</span>
      </li>)}
    </ol>
    <div className="first-visit-guide__body">
      <div>
        <h2 id="first-visit-guide-title" tabIndex={-1}>{t(steps[step].title)}</h2>
        <p>{t(steps[step].description)}</p>
        {step === 'problem' && <p className="first-visit-guide__status" role="status">{problemName ? t('Выбрано: {0}', [problemName]) : t('Выберите показатель, чтобы продолжить.')}</p>}
        {step === 'measures' && <p className="first-visit-guide__status" role="status">{t('Выбрано {0} из 5 · Осталось {1} у.е.', [decisionCount, remainingBudget])}{!valid && ` · ${t('Для результата нужен допустимый набор из пяти мер.')}`}</p>}
      </div>
      <div className="first-visit-guide__actions">
        {index > 0 && <button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />{t('Назад')}</button>}
        <button type="button" className="btn-primary" onClick={onNext} disabled={!canContinue}>{button}{step === 'review' ? <Check size={15} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}</button>
      </div>
    </div>
  </section>;
}
