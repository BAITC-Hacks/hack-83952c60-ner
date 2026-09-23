import { DirectionId, IndicatorId, IndicatorMeta } from '../engine/types';

export interface DirectionMeta {
  id: DirectionId;
  nameRu: string;
  nameKz: string;
  weight: number;
  color: string;
  icon: string;
}

export const DIRECTIONS: Record<DirectionId, DirectionMeta> = {
  transport: {
    id: 'transport',
    nameRu: 'Транспорт',
    nameKz: 'Көлік',
    weight: 0.20,
    color: '#3B82F6', // Blue
    icon: 'Car',
  },
  ecology: {
    id: 'ecology',
    nameRu: 'Экология и озеленение',
    nameKz: 'Экология және көгалдандыру',
    weight: 0.20,
    color: '#10B981', // Emerald green
    icon: 'Trees',
  },
  social: {
    id: 'social',
    nameRu: 'Социальная инфраструктура',
    nameKz: 'Әлеуметтік инфрақұрылым',
    weight: 0.22,
    color: '#8B5CF6', // Purple
    icon: 'GraduationCap',
  },
  safety: {
    id: 'safety',
    nameRu: 'Безопасность',
    nameKz: 'Қауіпсіздік',
    weight: 0.18,
    color: '#F59E0B', // Amber
    icon: 'ShieldCheck',
  },
  services: {
    id: 'services',
    nameRu: 'Городские сервисы и ЖКХ',
    nameKz: 'Қалалық қызметтер мен ТКШ',
    weight: 0.20,
    color: '#EC4899', // Pink
    icon: 'Wrench',
  },
};

export const INDICATORS: Record<IndicatorId, IndicatorMeta> = {
  T1: {
    id: 'T1',
    direction: 'transport',
    nameRu: 'Разгрузка дорог',
    descriptionRu: 'Степень отсутствия заторов в часы пик',
    meaningRu: '100 = нет пробок в час пик, 0 = глухой затор на ключевых магистралях',
    weight: 0.10,
  },
  T2: {
    id: 'T2',
    direction: 'transport',
    nameRu: 'Доступность общ. транспорта',
    descriptionRu: 'Пешая доступность остановок и частота курсирования автобусов/LRT',
    meaningRu: '100 = все жители в 500 м от остановки с интервалом ≤10 мин',
    weight: 0.10,
  },
  E1: {
    id: 'E1',
    direction: 'ecology',
    nameRu: 'Озеленение',
    descriptionRu: 'Обеспеченность скверами, парками и защитными лесополосами',
    meaningRu: '100 = ≥20 м² благоустроенной зелени на жителя',
    weight: 0.09,
  },
  E2: {
    id: 'E2',
    direction: 'ecology',
    nameRu: 'Качество воздуха',
    descriptionRu: 'Чистота атмосферы, отсутствие зимнего смога и твердых частиц PM2.5',
    meaningRu: '100 = зимой AQI ≤50, 0 = хронический токсичный смог',
    weight: 0.11,
  },
  S1: {
    id: 'S1',
    direction: 'social',
    nameRu: 'Школы и детсады',
    descriptionRu: 'Укомплектованность местами без перегруженных трехсменных классов',
    meaningRu: '100 = 100% нормативной потребности, отсутствие 2-й и 3-й смен',
    weight: 0.11,
  },
  S2: {
    id: 'S2',
    direction: 'social',
    nameRu: 'Поликлиники и первичная медпомощь',
    descriptionRu: 'Доступность центров семейного здоровья и врачей общей практики',
    meaningRu: '100 = норматив охвата на каждого жителя выполнен полностью',
    weight: 0.11,
  },
  B1: {
    id: 'B1',
    direction: 'safety',
    nameRu: 'Безопасность улиц',
    descriptionRu: 'Освещение дворов, плотность камер Safe City и патрулирование',
    meaningRu: '100 = уличное освещение и камеры везде, нулевой криминал',
    weight: 0.09,
  },
  B2: {
    id: 'B2',
    direction: 'safety',
    nameRu: 'Безопасность дорожного движения',
    descriptionRu: 'Защищенные переходы, островки безопасности, снижение аварийности',
    meaningRu: '100 = минимум ДТП с пострадавшими (Vision Zero)',
    weight: 0.09,
  },
  C1: {
    id: 'C1',
    direction: 'services',
    nameRu: 'Надёжность ЖКХ',
    descriptionRu: 'Бесперебойность тепло-, водо- и электроснабжения в суровые морозы',
    meaningRu: '100 = 0 аварий на сетях отопления/водоснабжения за год',
    weight: 0.10,
  },
  C2: {
    id: 'C2',
    direction: 'services',
    nameRu: 'Скорость решения обращений',
    descriptionRu: 'Эффективность платформ iKomek 109 и районных служб',
    meaningRu: '100 = все обращения жителей закрываются регламентно в срок',
    weight: 0.10,
  },
};

export const INDICATOR_LIST = Object.values(INDICATORS);
export const DIRECTION_LIST = Object.values(DIRECTIONS);
