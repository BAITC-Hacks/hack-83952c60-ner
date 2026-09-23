import { CityEvent } from '../engine/types';

export const CITY_EVENTS: CityEvent[] = [
  {
    id: 'blizzard',
    titleRu: 'Аномальный буран и степная метель',
    descriptionRu: 'На столицу обрушился снежный шторм с порывами ветра до 28 м/с. Возникает критическая нагрузка на снегоуборочную технику и заторы на дорогах.',
    cityWideImpacts: { T1: -8, T2: -6 },
    severity: 'medium',
  },
  {
    id: 'heating_pipe_break',
    titleRu: 'Аварийный прорыв магистрали теплотрассы',
    descriptionRu: 'В 30-градусный мороз произошел гидроудар на старых сетях правого берега (Алматы / Байконур).',
    indicatorImpacts: {
      almaty: { C1: -12, C2: -6 },
      baikonur: { C1: -8 },
    },
    severity: 'high',
  },
  {
    id: 'smog_inversion',
    titleRu: 'Температурная инверсия и безветренный смог',
    descriptionRu: 'Штиль в Сарыарке и прилегающих районах привел к резкой концентрации печных выбросов PM2.5.',
    indicatorImpacts: {
      saryarka: { E2: -10 },
      esil: { E2: -4 },
    },
    severity: 'medium',
  },
  {
    id: 'demographic_boom',
    titleRu: 'Резкий миграционный приток в новостройки Нуры',
    descriptionRu: 'Сдача новых жилых комплексов в районе Нура без опережающей соцструктуры обострила дефицит школ и поликлиник.',
    indicatorImpacts: {
      nura: { S1: -6, S2: -5 },
    },
    severity: 'medium',
  },
];
