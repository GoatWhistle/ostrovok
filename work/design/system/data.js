export const CHARACTERISTICS = [
  { key: "sea", icon: "sea", hue: "--hue-sea", ru: "Море", en: "Sea", token: "distance_to_sea" },
  { key: "sunset", icon: "sunset", hue: "--hue-sunset", ru: "Закат из окна", en: "Sunset view", token: "sunset_view" },
  { key: "quiet", icon: "quiet", hue: "--hue-quiet", ru: "Тихо", en: "Quiet", token: "noise_level" },
  { key: "nightlife", icon: "nightlife", hue: "--hue-nightlife", ru: "Бары рядом", en: "Bars nearby", token: "bars_nearby" },
  { key: "dark", icon: "blackout", hue: "--hue-dark", ru: "Блэкаут", en: "Blackout", token: "blackout_curtains" },
  { key: "pets", icon: "pets", hue: "--hue-pets", ru: "Животные", en: "Pets", token: "pets_policy" },
  { key: "height", icon: "height", hue: "--hue-height", ru: "Этаж", en: "Floor", token: "building_height" },
  { key: "walk", icon: "walk", hue: "--hue-walk", ru: "До моря пешком", en: "Walk to the sea", token: "walk_minutes" },
]

export const STATUSES = [
  { key: "confirmed", icon: "confirmed", badge: "success", token: "--status-success", ru: "Подтверждено", en: "Confirmed", meaning: "Факт подтвердил отельер или свежий расчёт совпал с запросом.", where: "Совпадение в карточке, ответ отельера, итог в кабинете" },
  { key: "rejected", icon: "rejected", badge: "danger", token: "--status-danger", ru: "Отклонено", en: "Rejected", meaning: "Факт противоречит запросу или отельер ответил «нет».", where: "Несовпадение, отказ отельера, ошибка действия" },
  { key: "partial", icon: "partial", badge: "warning", token: "--status-warning", ru: "Частично", en: "Partly", meaning: "Совпадает с условием: только с 8-го этажа, только летом.", where: "Совпадение с квалификатором" },
  { key: "pending", icon: "pending", badge: "info", token: "--status-info", ru: "Считается", en: "Calculating", meaning: "Факт досчитывается по требованию, результат придёт в течение 5 секунд.", where: "Поле pending в ответе поиска" },
  { key: "conflict", icon: "conflict", badge: "conflict", token: "--status-conflict", ru: "Конфликт", en: "Conflict", meaning: "Источники расходятся. Побеждает отельер, потом свежий расчёт, потом теги карты.", where: "Факт с несколькими значениями" },
  { key: "stale", icon: "stale", badge: "stale", token: "--text-muted", ru: "Устарело", en: "Outdated", meaning: "Срок годности факта прошёл, уверенность снижена вдвое.", where: "Факт после valid_until" },
  { key: "unknown", icon: "unknown", badge: "neutral", token: "--status-neutral", ru: "Нет данных", en: "No data", meaning: "Мы не знаем. Это не «нет», а повод спросить отельера.", where: "Пустое значение характеристики" },
  { key: "fact", icon: "map", badge: "fact", token: "--surface-highlight", ru: "Факт на карте", en: "Fact on map", meaning: "Найденное доказательство: здание, маршрут, зона видимости.", where: "Подсветка на карте и в тексте" },
]

export const SCALES = [
  { name: "Кобальт", note: "действия, ссылки, выбранное", prefix: "cobalt", main: 600, steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: "Лайм", note: "факты и их доказательства", prefix: "lime", main: 400, steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: "Нейтральные", note: "бумага, текст, линии", prefix: "neutral", main: 50, steps: [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 925, 950, 1000] },
  { name: "Зелёный", main: 600, note: "подтверждено", prefix: "green", steps: [50, 100, 300, 400, 500, 600, 700, 900] },
  { name: "Красный", main: 600, note: "отклонено, ошибка", prefix: "red", steps: [50, 100, 300, 400, 500, 600, 700, 900] },
  { name: "Янтарный", main: 500, note: "частично, предупреждение", prefix: "amber", steps: [50, 100, 300, 400, 500, 600, 700, 900] },
  { name: "Фиолетовый", main: 600, note: "конфликт источников", prefix: "violet", steps: [50, 100, 300, 400, 500, 600, 700, 900] },
]

export const SEMANTIC = [
  { group: "Поверхности", items: [["--surface-base", "--text-primary"], ["--surface-raised", "--text-primary"], ["--surface-sunken", "--text-primary"], ["--surface-overlay", "--text-primary"], ["--surface-inverse", "--text-inverse"], ["--surface-selected", "--text-accent"], ["--surface-highlight", "--text-on-highlight"]] },
  { group: "Текст", text: true, items: ["--text-primary", "--text-secondary", "--text-muted", "--text-disabled", "--text-accent", "--text-link", "--status-success-text", "--status-danger-text", "--status-warning-text", "--status-conflict-text", "--status-info-text"] },
  { group: "Действия", items: [["--action-primary", "--text-on-action"], ["--action-primary-hover", "--text-on-action"], ["--action-secondary", "--action-secondary-text"], ["--action-fact", "--neutral-950"], ["--action-danger", "--text-on-action"]] },
  { group: "Статусы, фон и текст", items: [["--status-success-surface", "--status-success-text"], ["--status-danger-surface", "--status-danger-text"], ["--status-warning-surface", "--status-warning-text"], ["--status-conflict-surface", "--status-conflict-text"], ["--status-info-surface", "--status-info-text"], ["--status-neutral-surface", "--status-neutral-text"]] },
  { group: "Линии и фокус", items: ["--border-subtle", "--border-default", "--border-strong", ["--focus-ring", "--text-on-action"]] },
]

export const TYPE_SCALE = [
  { token: "display", use: "обложка, превью ссылки", sample: "factmap", weight: "--weight-black", tracking: "--tracking-display" },
  { token: "heading-lg", use: "заголовок экрана", sample: "Отели, где тихо и видно закат", weight: "--weight-black", tracking: "--tracking-heading" },
  { token: "heading", use: "значение факта, диалог", sample: "Вид на закат с 4-го этажа", weight: "--weight-bold", tracking: "--tracking-heading" },
  { token: "subheading", use: "название отеля, карточка", sample: "Отель «Чайка», Центральный район", weight: "--weight-bold" },
  { token: "body", use: "описание, ответ", sample: "Западный фасад смотрит на море, рельеф и соседние дома не закрывают горизонт с октября по март." },
  { token: "body-sm", use: "интерфейс по умолчанию", sample: "До пляжа 6 минут пешком, спуск 18 метров, без лестниц." },
  { token: "label", use: "кнопка, поле, чип", sample: "Сортировка: по совпадению", weight: "--weight-semibold" },
  { token: "caption", use: "мета, происхождение", sample: "Посчитано 24.10.2026 по данным OSM" },
  { token: "micro", use: "группа в списке", sample: "ХАРАКТЕРИСТИКИ", weight: "--weight-semibold", tracking: "--tracking-caps" },
]

export const SPACES = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96]

export const RADII = [
  { token: "--radius-xs", use: "чекбокс, тег, kbd" },
  { token: "--radius-sm", use: "компактная кнопка, метка, опция" },
  { token: "--radius-md", use: "кнопка, поле, выпадающий список" },
  { token: "--radius-lg", use: "карточка, факт, панель" },
  { token: "--radius-xl", use: "поиск, диалог, лист" },
  { token: "--radius-pill", use: "чип, кластер, переключатель" },
]

export const ELEVATION = [
  { token: "--shadow-ring", use: "карточки на странице: только линия" },
  { token: "--shadow-raised", use: "ползунок переключателя" },
  { token: "--shadow-float", use: "поиск, контролы карты, легенда" },
  { token: "--shadow-overlay", use: "списки, меню, диалог, тост" },
  { token: "--shadow-pin", use: "метки отелей на карте" },
]

export const CURVES = [
  { token: "--ease-out", bez: [0.23, 1, 0.32, 1], use: "Вход, отклик, наведение. По умолчанию." },
  { token: "--ease-in-out", bez: [0.77, 0, 0.175, 1], use: "Перемещение по экрану, маршрут, смена темы." },
  { token: "--ease-drawer", bez: [0.32, 0.72, 0, 1], use: "Нижний лист и боковая панель." },
  { token: "--ease-fold", bez: [0.65, 0, 0.35, 1], use: "Складывание карты в знаке и загрузчике." },
]

export const DURATIONS = [
  ["--dur-instant", "отклик на наведение"],
  ["--dur-press", "нажатие"],
  ["--dur-fast-exit", "исчезновение мелкого"],
  ["--dur-fast", "смена содержимого"],
  ["--dur-exit", "закрытие слоя"],
  ["--dur-base", "открытие слоя"],
  ["--dur-panel", "панель, индикатор, тост"],
  ["--dur-slow", "нижний лист, метки"],
  ["--dur-reveal", "смена темы"],
  ["--dur-fold", "раскрытие знака"],
  ["--dur-draw", "отрисовка маршрута"],
]

export const HOTELS = ["Чайка", "Магнолия", "Ривьера", "Морская звезда", "Кипарис", "Бриз", "Лазурь", "Олимп", "Камелия", "Горный воздух", "Причал", "Сосновый бор", "Пальма", "Белый парус", "Тихая бухта", "Жемчуг", "Эдельвейс", "Маяк у моря"]
