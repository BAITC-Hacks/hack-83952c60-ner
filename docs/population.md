# Пульс города и мысли агентов

Готовый TypeScript/React/Node.js модуль для «Аким на 5 часов». По уточнению пользователя сохранены все исходные числа районов: **1 550 000 жителей и 1 550 частиц**, каждая представляет 1 000 жителей. Создаются 60 игровых персонажей (10 на район), из которых 30 входят в постоянную фокус-группу (5 на район). Новых зависимостей нет.

## Файлы и разделение ответственности

| Слой | Реализация | Частота работы |
| --- | --- | --- |
| Агрегаты районов, мосты | `src/population/data.ts` | Загрузка сценария |
| 4 матрицы миграции 6×6 | `src/population/migration.ts` | Смена периода/маршрутов |
| 60 персон и 30 представителей | `src/population/agents.ts` | Один раз, воспроизводимый seed |
| Математический пульс | `src/population/pulse.ts` | Изменение метрик, обычно 1 Гц |
| Состояния и стресс персонажей | `src/population/simulation.ts` | 1 Гц игрового времени |
| Отбор затронутых жителей | `src/population/selection.ts` | Принятие решения |
| Canvas, геометрия, очереди | `ParticleSwarm.ts`, `swarmGeometry.ts` | `requestAnimationFrame` |
| React-компоненты | `PopulationCanvas.tsx`, `PopulationPanel.tsx` | Данные/интерфейс; без React в цикле кадров |
| LLM, системный промпт, кеш | `server/citizenVoices.ts` | Только явный запрос реакции |
| HTTP | `POST /api/population/voices` в `server/app.ts` | По событию |

Типы находятся в `src/population/types.ts`. Браузерный вход — `src/population/index.ts`; Node-код импортирует нужные файлы напрямую. Серверный SDK и ключ не экспортируются в браузер. Основные экраны существующего симулятора не изменены; панель готова для встраивания.

## Запуск и примеры JSON

```sh
npm run dev
# Демо: http://127.0.0.1:3000/examples/population.html
npx tsx scripts/population-example.ts
npx tsx scripts/benchmark-population.ts
npm run typecheck
npm test -- tests/population-core.test.ts tests/population-swarm.test.ts tests/population-canvas.test.tsx tests/population-voices.test.ts tests/population-integration.test.ts
```

Демо — дополнительная HTML-точка входа **для Vite dev**; обычная production-сборка использует прежний `index.html`. Для production вставьте `PopulationPanel` в нужный экран приложения. Скрипт примеров всегда работает без ключа и без сетевых вызовов.

Полные структуры уже записаны:

- [Шесть агрегатов районов](examples/population-districts.json).
- [60 персонажей](examples/population-agents.json) и [30 детализированных профилей фокус-группы](examples/population-focus-group.json).
- [Все потоки миграции](examples/population-migration.json).
- [Входной запрос](examples/population-input.json) и [рассчитанный снимок с ответом](examples/population-output.json).

Вход в HTTP API:

```json
{
  "decision": {
    "id": "nura-schools-001",
    "topic": "schools",
    "districtIds": ["nura"],
    "summary": "Добавить школьные места в Нуре, сократив поездки семей в другие районы.",
    "effect": "improve"
  },
  "selectedDistrict": "nura",
  "mode": "focus"
}
```

Пример **локального** ответа; `source: "llm"` выставляется только после проверенного ответа API:

```json
{
  "thoughts": [
    { "agentId": "nura-02", "quote": "Школы нужны рядом. Надеюсь, детей перестанем возить через весь город.", "source": "rules" },
    { "agentId": "nura-03", "quote": "Чат КСК уже обсуждает школы. Хочется конкретных сроков.", "source": "rules" },
    { "agentId": "nura-01", "quote": "Пусть школьное утро наконец обойдётся без гонки по мостам.", "source": "rules" }
  ]
}
```

`mode: "focus"` выбирает 3–4 представителей выбранного района, до 12 слов; `mode: "cohort"` — 3–5 из всей когорты, до 15 слов. Если непосредственно затронутых меньше трёх, возвращаются только они; если ни одного — `[]` без вызова API. Районы передаются через стабильные идентификаторы: `esil`, `saryarka`, `almaty`, `baikonur`, `nura`, `saraishyk`. Общегородское решение перечисляет все шесть районов. Для моста дополнительно задайте `bridgeIds: ["west"]`, `["central"]` или `["east"]`.

## Чистая математика

```ts
import { generateAgents } from '../src/population/agents';
import { DISTRICTS_DATA } from '../src/population/data';
import { createMigrationMatrix, estimateTrafficLoad } from '../src/population/migration';
import { calculateCityPulse } from '../src/population/pulse';

const agents = generateAgents(42);
const trafficLoad = estimateTrafficLoad(createMigrationMatrix(8), 8);
const macro = calculateCityPulse(DISTRICTS_DATA, trafficLoad);
const full = calculateCityPulse(agents, { hour: 8, districts: DISTRICTS_DATA, trafficLoad });
// macro.stressIndex === full.stressIndex; full дополнительно содержит средние по персонам.
```

Сценарная формула, `clamp(x) = min(1, max(0, x))`:

```text
B = 100 × Σ(flowPerHour × clamp(delayMinutes / 45)) / Σ(flowPerHour)
S_d = 100 × clamp((schoolDemand - schoolPlaces) / schoolDemand / 0.5)
H_d = 100 × clamp((heatTargetC - heatSupplyC) / 25)
I_d = 0.45 × B + 0.35 × S_d + 0.20 × H_d
stressIndex = round(Σ(population_d × I_d) / Σ(population_d))
```

При нулевой школьной потребности `S_d = 0`, при отсутствии потока `B = 0`. Температура — **подача теплосети**, не воздух в квартире. 45 минут, 50% дефицита и 25°C недогрева — настраиваемая игровая калибровка, не нормативы. Общий мостовой компонент используется во всех районах; точная районная экспозиция мостам потребовала бы отдельной матрицы наблюдений. Дефицит детсадов хранится в агрегатах, но в запрошенную трёхкомпонентную формулу не включён.

Индекс округляется до целого **перед** выбором статуса: 0–30 — зелёный «Город дышит спокойно»; 31–70 — жёлтый «Повышенное напряжение»; 71–100 — красный пульсирующий «Инфраструктурный инфаркт». CSS учитывает `prefers-reduced-motion`.

`averageAgentStress` — среднее по переданным персонам. `populationWeightedAgentStress` — среднее районных средних с весами реального населения; равные группы по 10 человек не делают районы равновесными. `districts[].averageStress` равен `null`, когда нет наблюдений. Если представлены не все районы, взвешенное среднее относится только к представленному населению; это не оценка отсутствующих районов. Инфраструктурный индекс и мнение когорты возвращаются отдельно и не складываются дважды.

`hour` — местное **игровое время** Астаны, не часовой пояс сервера. Ночь до 06:00 и с 23:00 — «Город спит»; 06:00–10:00 при перегрузке — «Утренний коллапс»; 16:00–20:00 — «Вечерний час пик»; иначе — «Рабочий ритм». В макро-сигнатуре времени нет: состояние по умолчанию «Рабочий ритм».

`stepCitizens(agents, metrics, elapsedGameSeconds)` возвращает новые объекты без мутации исходных. Стресс плавно приближается к инфраструктурному уровню с постоянной времени 900 игровых секунд. LLM не участвует в этом расчёте. Объявленное решение само по себе не меняет инфраструктурные показатели: фактические эффекты передаёт основной игровой движок.

## Миграция и рой

Четыре явные матрицы `PURPOSE_DESTINATION_WEIGHTS` имеют строки проживания и столбцы назначения в порядке `DISTRICT_IDS`. Цели: работа, школы, СТО/рынки, отдых. Метод наибольших остатков распределяет целые тысячи без создания/потери населения. На утреннем срезе сумма каждой исходящей районной строки равна населению района. Вечером рабочие, школьные и рыночные направления разворачиваются домой; сумма по исходящему району вечером поэтому не обязана совпадать с числом его жителей.

Все 1 550 частиц — представительные потоки, а не утверждение, что всё население одновременно едет. В расчёте пропускной способности применяется доля активности: 0,8% ночью, 18% утром, 16% вечером и 6% в остальное время. Все коэффициенты, мощности мостов и координаты синтетические; только районные численности взяты из задания.

Рой хранит небольшой массив `Particle` и фиксированные typed arrays. Общие маршруты кешируются; сплайны заранее пересэмплированы по длине дуги, мосты пересекаются по прямому пролёту. Межрайонные потоки направлены от `from` к `to`: по достижении конца маркер плавно гаснет и повторяет поток от начала. Это цикл визуального потока, а не возвращение того же человека. Внутрирайонные потоки ходят по замкнутым петлям.

Узкий мост при `loadRatio > 1` и участки Нуры при `districtLoad.nura > 1.4` получают множитель скорости `0.15`; заторможенные частицы краснеют. Ограничение дистанции до лидера распространяет очередь вверх по маршруту. Между разными маршрутами нет полноценной микроскопической модели столкновений: это агрегированная визуализация пропускной способности.

Canvas использует готовые спрайты свечения и фон, лимит DPR, ограничение `deltaTime`, паузу скрытой вкладки, отключение анимации при reduced motion, освобождение RAF/обработчиков/ResizeObserver. Число частиц не уменьшается на мобильных. React-обёртка сравнивает содержимое потоков, поэтому свежий эквивалентный JSON-снимок не сбрасывает очередь.

Цель — 60 FPS, бюджет кадра 16,67 мс. `getDiagnostics()` / `onDiagnostics` показывают фактические FPS, CPU-время кадра и число частиц в заторе. Это проверяется на целевых устройствах; частота дисплея, GPU и фоновые вкладки влияют на результат. CPU-бенчмарк не включает отрисовку и не доказывает мобильные 60 FPS.

## Встраивание в React

```tsx
import { useMemo } from 'react';
import { PopulationPanel, createPopulationSnapshot } from '../src/population';

export function CityView() {
  const snapshot = useMemo(() => createPopulationSnapshot({ hour: 8, seed: 42 }), []);
  return <PopulationPanel snapshot={snapshot} selectedDistrict="nura" decision={{
    id: 'nura-school-1', topic: 'schools', districtIds: ['nura'],
    summary: 'Добавить школьные места в Нуре.', effect: 'improve',
  }} />;
}
```

Панель никогда не вызывает LLM в `useEffect` или RAF: только по нажатию кнопки. При смене решения/района старый ответ отменяется и не подменяет текущий. Для самостоятельного Canvas используйте `new ParticleSwarm(canvas, { flows, trafficLoad })`, затем `start()`, `setTrafficLoad(...)` и `destroy()` при размонтировании.

## Серверные мысли и экономия токенов

```ts
import { generateCitizenThoughts, generateVoiceOfCitizens,
  createCitizenVoiceService, CITIZEN_SYSTEM_PROMPT } from '../server/citizenVoices';
import { generateAgents } from '../src/population/agents';

// Запрошенные функции, только в Node:
const thoughts = await generateCitizenThoughts(generateAgents(42), decision);
const voices = await generateVoiceOfCitizens('nura', decision, process.env.OPENAI_API_KEY);

// Для приложения предпочтителен один экземпляр на сеанс или сервер:
const service = createCitizenVoiceService({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4.1-mini',
  cacheTtlMs: 300_000,
  maxRequestsPerMinute: 12,
});
const selected = await service.generateCitizenThoughts(generateAgents(42), decision);
```

Отбор сначала проверяет тему интереса и реальную экспозицию: район проживания/назначения, школьный маршрут, конкретный мост. Решение о школах Нуры берёт родителей школьников из Нуры или пользователей её школ; работа в Нуре сама по себе недостаточна. После этого Fisher–Yates выбирает случайную подгруппу без повторов.

Один синхронный запрос Chat Completions содержит общий системный промпт и компактный JSON выбранных персон. Это один запрос с несколькими персонами, **не** асинхронный OpenAI Batch API. По умолчанию: `gpt-4.1-mini`, `temperature: 0.8`, `max_completion_tokens: 600`, `maxRetries: 0`, таймаут 10 секунд. [Модель поддерживает Structured Outputs](https://developers.openai.com/api/docs/models/gpt-4.1-mini); строгий JSON задаётся через [response_format / JSON Schema](https://developers.openai.com/api/docs/guides/structured-outputs). Схема дополняется собственной проверкой количества, уникальных ID и длины каждой цитаты.

Готовый системный промпт — экспорт `CITIZEN_SYSTEM_PROMPT` в `server/citizenVoices.ts`. Он требует разные эмоциональные голоса, местный контекст и реакцию на **объявленный план**, не выдуманные уже наступившие результаты. Поля решения и биографий объявлены данными, а не инструкциями.

Кеш учитывает полное решение, семантику когорты и лимиты длины, а не только `id`. Выбор случайной подгруппы происходит после проверки кеша; параллельные одинаковые запросы объединяются. Значения по умолчанию: 128 записей, TTL 5 минут, до 12 реальных запросов/минуту, пауза 1,5 секунды, максимум один запрос одновременно. Эти лимиты действуют на экземпляр сервиса; HTTP-приложение создаёт один общий экземпляр. При отсутствии ключа, ошибке, невалидном ответе или лимите возвращаются короткие `source: "rules"` реплики без повторного API-вызова; такие ответы кешируются до 5 секунд.

HTTP использует `CITIZEN_OPENAI_API_KEY`, затем `OPENAI_API_KEY`; модель задаётся через `CITIZEN_MODEL`. Ключи NVIDIA/Brev из других модулей не передаются в OpenAI. Прямые convenience-функции используют явно переданный ключ либо `OPENAI_API_KEY`. `CitizenVoiceProvider` позволяет внедрить адаптер Claude/Gemini или тестовую заглушку без изменения отбора и проверки. Рабочий встроенный адаптер реализован для OpenAI; платный live-вызов при разработке не выполнялся.
