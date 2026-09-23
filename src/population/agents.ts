import { createSeededRandom, DISTRICTS_DATA, DISTRICT_IDS } from './data';
import { PURPOSE_DESTINATION_WEIGHTS, selectBridge } from './migration';
import type { CitizenAgent, CitizenRoute, DecisionTopic, DistrictId, TransportMode } from './types';

const NAMES: Readonly<Record<DistrictId, readonly string[]>> = {
  esil: ['Ерлан Сейтов', 'Айгерим Омарова', 'Данияр Исаев', 'Светлана Морозова', 'Аружан Касымова', 'Тимур Ахметов', 'Гульнара Есенова', 'Виктор Ким', 'Мадина Алиева', 'Руслан Беков'],
  saryarka: ['Нурлан Жумабаев', 'Анна Павлова', 'Азамат Тулеев', 'Зоя Петрова', 'Жанель Уразова', 'Самат Оспанов', 'Ольга Белова', 'Серик Нуров', 'Динара Садыкова', 'Илья Волков'],
  almaty: ['Марат Кенжебаев', 'Алия Турсунова', 'Алексей Васильев', 'Роза Сафарова', 'Адиль Мусин', 'Диас Оразов', 'Елена Соколова', 'Бауыржан Алимов', 'Сауле Исакова', 'Дамир Котов'],
  baikonur: ['Бекзат Рахимов', 'Мария Федорова', 'Арман Досов', 'Бибигуль Нуртаева', 'Ирина Орлова', 'Ерасыл Сагинов', 'Ляззат Токтарова', 'Андрей Ли', 'Асем Калиева', 'Санжар Амиров'],
  nura: ['Аскар Байжанов', 'Дана Муратова', 'Ринат Кабиров', 'Валентина Ершова', 'Нурай Сулейменова', 'Алихан Муханов', 'Камила Серикова', 'Павел Егоров', 'Назым Есенова', 'Ермек Касенов'],
  saraishyk: ['Канат Ибраев', 'Зарина Абдиева', 'Артем Назаров', 'Куляш Сейдахметова', 'Мирас Сапаров', 'Данияр Смагулов', 'Наталья Смирнова', 'Асет Нургалиев', 'Айдана Тлеубергенова', 'Максим Цой'],
};

interface Archetype {
  profession: string;
  age: number;
  childrenAges: number[];
  transport: TransportMode;
  interests: DecisionTopic[];
  speechStyle: string;
  detail: string;
}

const ARCHETYPES: readonly Archetype[] = [
  { profession: 'государственный служащий', age: 39, childrenAges: [7, 12], transport: 'car', interests: ['transport', 'schools', 'services'], speechStyle: 'Сдержанно, но с сухой иронией; ценит конкретные сроки.', detail: 'К девяти нужен в ведомстве; сначала отвозит младшего на занятия.' },
  { profession: 'мама в декрете', age: 32, childrenAges: [2, 8], transport: 'school', interests: ['schools', 'heating', 'transport'], speechStyle: 'Быстро и прямо, как в родительском чате, без канцелярита.', detail: 'По профессии бухгалтер. Ждёт место в саду, возит старшего в школу и считает семейный бюджет.' },
  { profession: 'таксист', age: 44, childrenAges: [10], transport: 'car', interests: ['transport', 'gas', 'schools'], speechStyle: 'Разговорно, с иронией водителя; сравнивает время с выручкой.', detail: 'Работает в утренние пики; простой на мосту уменьшает дневной доход.' },
  { profession: 'пенсионер', age: 71, childrenAges: [], transport: 'bus', interests: ['heating', 'transport', 'services'], speechStyle: 'Коротко, житейски; обсуждает батареи и чат КСК.', detail: 'Ездит в поликлинику и на рынок, проверяет батареи перед морозами.' },
  { profession: 'студент', age: 20, childrenAges: [], transport: 'bus', interests: ['transport', 'leisure', 'services'], speechStyle: 'Легко и остро, естественный городской сленг без карикатуры.', detail: 'Совмещает пары с подработкой; рассчитывает на автобус и тёплую остановку.' },
  { profession: 'владелец кофейни', age: 35, childrenAges: [6], transport: 'car', interests: ['services', 'transport', 'heating'], speechStyle: 'Предпринимательская ирония; замечает покупателей и коммунальные счета.', detail: 'Открывает кофейню до восьми, зависит от поставок и пешеходного потока.' },
  { profession: 'школьный учитель', age: 46, childrenAges: [14], transport: 'bus', interests: ['schools', 'transport', 'heating'], speechStyle: 'Спокойно, предметно; говорит о классах, сменах и детях.', detail: 'Ведёт две смены; после уроков помогает собственному подростку.' },
  { profession: 'мастер СТО', age: 41, childrenAges: [5, 11], transport: 'car', interests: ['gas', 'services', 'transport', 'schools'], speechStyle: 'Прямо и практично, с рабочим юмором.', detail: 'Ездит за запчастями на рынок, зимой часто помогает заглохшим машинам.' },
  { profession: 'медсестра', age: 29, childrenAges: [4], transport: 'bus', interests: ['transport', 'heating', 'services'], speechStyle: 'Устало, но доброжелательно; ценит надёжность транспорта.', detail: 'Работает посменно; после ночной смены забирает ребёнка из сада.' },
  { profession: 'курьер', age: 26, childrenAges: [], transport: 'car', interests: ['transport', 'gas', 'services'], speechStyle: 'Коротко и энергично; считает потерянные минуты.', detail: 'Возит заказы между берегами, доход зависит от числа доставок.' },
];

const FOCUS_INDICES: Readonly<Record<DistrictId, readonly number[]>> = {
  esil: [0, 1, 4, 5, 8], saryarka: [1, 2, 3, 6, 7], almaty: [0, 2, 4, 5, 9],
  baikonur: [1, 2, 3, 5, 6], nura: [0, 1, 2, 3, 4], saraishyk: [0, 1, 2, 5, 7],
};

function route(from: DistrictId, to: DistrictId, purpose: CitizenRoute['purpose']): CitizenRoute {
  const bridgeId = selectBridge(from, to);
  return { from, to, purpose, ...(bridgeId ? { bridgeId } : {}) };
}

/** 60 подробных персон, по 10 на район; статистический вес хранится в макро-агрегатах.
 * Персоны — репрезентативные игровые архетипы, а не реальные люди. */
export function generateAgents(seed = 42): CitizenAgent[] {
  const random = createSeededRandom(seed);
  return DISTRICTS_DATA.flatMap((district, districtIndex) => ARCHETYPES.map((archetype, index) => {
    const draw = random();
    let cumulative = 0;
    let workDistrict = district.id;
    for (let i = 0; i < DISTRICT_IDS.length; i++) {
      cumulative += PURPOSE_DESTINATION_WEIGHTS.work[districtIndex][i];
      if (draw < cumulative) { workDistrict = DISTRICT_IDS[i]; break; }
    }
    const staysHome = index === 1 || index === 3;
    if (staysHome) workDistrict = district.id;
    const schoolChildren = archetype.childrenAges.some(age => age >= 6 && age <= 18);
    const schoolDistrict = district.id === 'nura' && index % 2 === 0 ? 'esil' : district.id;
    const routes: CitizenRoute[] = [];
    if (!staysHome) routes.push(route(district.id, workDistrict, index === 4 ? 'school' : 'work'));
    if (schoolChildren) routes.push(route(district.id, schoolDistrict, 'school'));
    if (index === 2 || index === 3 || index === 7 || index === 5) routes.push(route(district.id, index === 3 ? district.id : 'baikonur', 'market'));
    if (index === 4) routes.push(route(district.id, 'esil', 'leisure'));
    const districtPressure = district.id === 'nura' ? 20 : district.id === 'saryarka' ? 13 : district.id === 'saraishyk' ? 16 : 8;
    const stress = Math.min(100, Math.round(20 + districtPressure + random() * 35 + (schoolChildren ? 8 : 0)));
    const currentAction: CitizenAgent['currentAction'] = index === 3 ? 'стоит в очереди' : index === 1 ? 'дома' : schoolChildren && index <= 2 ? 'везёт детей в школу' : 'едет на работу';
    return {
      id: `${district.id}-${String(index + 1).padStart(2, '0')}`,
      name: NAMES[district.id][index], age: archetype.age + Math.floor(random() * 3),
      homeDistrict: district.id, workDistrict, profession: archetype.profession,
      hasChildren: archetype.childrenAges.length > 0, childrenAges: [...archetype.childrenAges], stress, currentAction,
      transport: archetype.transport, income: index === 3 || index === 4 || index === 9 ? 'low' : index === 0 || index === 5 ? 'high' : 'middle',
      interests: [...archetype.interests], routes,
      biography: `Живёт в районе ${district.name}. ${archetype.detail} Районный контекст: ${district.profile.toLowerCase()}.`,
      speechStyle: archetype.speechStyle, focusGroup: FOCUS_INDICES[district.id].includes(index),
    };
  }));
}

export function generateFocusGroup(seed = 42): CitizenAgent[] {
  return generateAgents(seed).filter(agent => agent.focusGroup);
}

export const FOCUS_GROUP: readonly CitizenAgent[] = generateFocusGroup();
