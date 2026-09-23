# Walkthrough: «Аким на 5 часов» — AI-симулятор управления городом

AI-симулятор управления городом Астана разработан в точном соответствии с техническим заданием хакатона и критериями оценки на **100 баллов**.

## Что было создано и реализовано

### 1. Математический движок симуляции (Engine)
- [types.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/engine/types.ts): Полная TypeScript-модель данных для 5 районов, 10 показателей, 14 мер, синергий, несовместимостей и сценариев.
- [districts.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/data/districts.ts): Базовые данные 5 районов Астаны (Есиль, Алматы, Сарыарка, Байконур, Нура) с точными долями населения и базовыми оценками.
- [indicators.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/data/indicators.ts): 10 показателей ($T_1 \dots C_2$) с утвержденными весами ($\sum w_k = 1.00$).
- [measures.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/data/measures.ts): 14 мер с условной стоимостью, типами (Район/Город), лагами внедрения $(8 - L)/8$, эффектами, синергиями и правилами несовместимости.
- [validator.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/engine/validator.ts): Автоматический контроль 8 правил ТЗ (бюджет 100 у.е., ровно 5 мер, $\le 2$ мер на направление, запрет дубликатов, проверка конфликтов).
- [simulator.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/engine/simulator.ts): Детерминированный расчет:
  - $I'_{dk} = \text{clip}(I_{dk} + \sum \text{effect} \cdot \frac{8-L}{8} + \text{synergies}, 0, 100)$
  - $D_d = \sum w_k I'_{dk}$
  - $D_{avg} = \sum \text{pop}_d D_d$
  - $\text{Score} = 0.7 \cdot D_{avg} + 0.3 \cdot \min(D_d) - 1.0 \cdot N_{crit}$
- [optimizer.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/engine/optimizer.ts): Алгоритм автоматического подбора выгодных замен с подсчетом точного прироста Score.

### 2. Agentic AI аналитик и советник
- [analyzer.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/ai/analyzer.ts): Глубокий агентный разбор компромиссов, сильных сторон, скрытых рисков и стиля управления Акима.
- [llmClient.ts](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/ai/llmClient.ts): Двухрежимный советник (высокоточный офлайн-агент + поддержка живого подключения OpenAI/Gemini).

### 3. Пользовательский интерфейс и 5 опциональных возможностей
- [Header.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/Header.tsx): Таймер смены Акима (5:00:00), кнопки пресетов («Эталон ТЗ», «Сброс»), вызов модальных окон.
- [ScoreDashboard.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/ScoreDashboard.tsx): Главное табло Astana Quality of Life Score с декомпозицией всех компонентов формулы.
- [BudgetBar.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/BudgetBar.tsx): Интерактивный прогресс-бар бюджета 100 у.е., слоты решений и покрытие направлений.
- [DistrictMap.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/DistrictMap.tsx): Векторная интерактивная карта районов с руслом реки Есиль, тепловой шкалой и карточкой инспектора района.
- [DecisionPanel.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/DecisionPanel.tsx): Каталог 14 мероприятий с подсветкой синергий и блокировкой конфликтов.
- [RadarAnalytics.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/RadarAnalytics.tsx): Сравнение всех 10 метрик «До / После» с маркером критической зоны ($<40$).
- [AIInsightCard.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/AIInsightCard.tsx): Исполнительный отчет AI-аналитика и диалоговое окно «Советник Акима».
- [OptimizerCard.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/OptimizerCard.tsx): Рекомендации AI-оптимизатора с кнопкой применения в 1 клик.
- [CompareModal.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/CompareModal.tsx): Лидерборд и сравнение сценариев нескольких команд (A/B анализ).
- [CrisisModal.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/CrisisModal.tsx): Моделирование непредвиденных городских кризисов (буран, авария на теплосетях, смог).
- [PresentationModal.tsx](file:///c:/Users/User/Documents/Codex/hack-83952c60-ner/src/components/PresentationModal.tsx): Автоматическая генерация готового презентационного слайда решения команды с печатью в PDF.

---

## Верификация и тестирование

### 1. Автоматические модульные тесты (Vitest)
Выполнено тестирование ядра:
```bash
npm test
```
Результат:
```
 ✓ tests/validator.test.ts (8 tests)
 ✓ tests/simulator.test.ts (3 tests)

 Test Files  2 passed (2)
      Tests  11 passed (11)
```
- **Базовый Score**: 52.56 ($N_{crit}=2$, $\min(D_d)=49.18$, $D_{avg}=56.86$).
- **Эталонный набор ТЗ** (`M7`+`M8`+`M10` в Нуре, `M12` город, `M5` в Сарыарке): стоимость 95 у.е., **Score = 56.54** ($+3.99$), $N_{crit}=0$, синергия `M10+M12` активна.
- **Самый дешевый набор** (`M9`+`M11`+`M10`+`M12`+`M4` за 61 у.е.): проверен и валиден.
- **Все 8 правил валидатора**: перерасход бюджета, повторы мер, лимит мер на направление, несовместимости `M1+M3`, `M4+M7`, `M5+M13` — протестированы и подтверждены.

### 2. Сборка проекта (Build)
```bash
npm run build
```
Результат: сборка прошла успешно за 5.85s, сформирован оптимизированный бандл в папке `dist/`.

### 3. Интерактивное тестирование в браузере (Browser Subagent)
В ходе проверки суб-агентом было записано демонстрационное видео:
- Начальное состояние: Score 56.54, бюджет 95/100, 5 слотов занято.
- Клик по району Сарыарка на карте: инспектор отобразил балл 56.30 (+1.65) и все 10 метрик.
- Модальное окно презентации: успешно открылось с полным отчетом Акимата и закрылось.
- Форс-мажор: активировано событие «Аномальный буран и степная метель» — Score снизился с 56.54 до 52.14 со штрафом -3.0 балла за просадки.
- Консоль браузера: **0 ошибок**.

---

## Инструкция по запуску

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск приложения в браузере
npm run dev

# 3. Запуск автоматических тестов
npm test
```
Приложение открывается по адресу: `http://localhost:3000/`.
