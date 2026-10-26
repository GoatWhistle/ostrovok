export const palettes = {
  clean: { name: 'Чистый вектор', title: 'Сочи, без лишнего', subtitle: 'Чёткая география. Спокойные объёмы. Факты на первом плане.', land: '#f1f0e8', water: '#b7d9e8', sand: '#eee2bb', park: '#d2dfc0', road: '#ffffff', casing: '#d8d7ce', buildings: '#d4d8d5', outline: '#8faaa8', hotel: '#b0ea55', route: '#1546db', flavor: 'light', sky: '#e9f0ee' },
  toy: { name: 'Игрушечный городок', title: 'Маленький большой отпуск', subtitle: 'Тёплые домики, объёмные деревья и море из игры.', land: '#f5e5c4', water: '#64c9d0', sand: '#ffe1a1', park: '#b5d18a', road: '#fff7df', casing: '#c8a987', buildings: '#f0c99b', outline: '#645952', hotel: '#eb826a', route: '#3152bc', flavor: 'light', sky: '#c8e5e5' },
  iso: { name: 'Изометрическая стратегия', title: 'Видеть весь район', subtitle: 'Высота, классы зданий и тени от выбранного часа.', land: '#d7dec7', water: '#598d9f', sand: '#d6c793', park: '#8ba96f', road: '#ddd8c4', casing: '#738273', buildings: '#d5d5bc', outline: '#546d65', hotel: '#e3b35e', route: '#f8e8a2', flavor: 'light', sky: '#a5bfc1' },
  sunset: { name: 'Закатный пейзаж', title: 'Когда город стихает', subtitle: 'Ступени рельефа, горизонтали и тёплый свет над морем.', land: '#e5b48c', water: '#5e7887', sand: '#f0cda3', park: '#9c9c79', road: '#f3d8b3', casing: '#be997f', buildings: '#725d70', outline: '#58465f', hotel: '#f3b06e', route: '#ffe1a8', flavor: 'light', sky: '#eec0a1' },
  neon: { name: 'Ночной неон', title: 'После заката', subtitle: 'Светящиеся окна, ночные улицы и короткий путь к бару.', land: '#111b2d', water: '#0a2943', sand: '#233d52', park: '#203d3b', road: '#305271', casing: '#172b45', buildings: '#26374d', outline: '#426382', hotel: '#76d8d0', route: '#f6a2d4', flavor: 'black', sky: '#0a1223' },
}

export function classColor(key, palette) {
  if (['hotel'].includes(key)) return palette.hotel
  if (['forest','wood','park','garden','grass','scrub','tree'].includes(key)) return palette.park
  if (key==='water') return palette.water
  if (key==='beach') return palette.sand
  if (['retail','office'].includes(key)) return palette===palettes.toy ? '#9cbfce' : palette.buildings
  if (['school','hospital','worship'].includes(key)) return palette===palettes.toy ? '#d6a2a2' : palette.buildings
  return palette.buildings
}
