import { boot } from '../boot.js'
boot('clean').catch(error=>{console.error(error);document.querySelector('#loading').textContent='Карта не загрузилась. Обновите страницу.'})
