# Сайт «Техностейдж»

Статический сайт без сборки: `index.html`, `styles.css`, `script.js`, картинки и видео в `media/`.
Открыть локально: двойной клик по `index.html`.

Шрифты (Onest, Unbounded, JetBrains Mono, лицензия SIL OFL) лежат в `fonts/` и подключаются через `fonts.css`. Внешних запросов к Google нет.

## Что заменить перед публикацией

Всё правится в `index.html`.

### Контакты (раздел `#contact`)
Почта, телефон, Telegram и MAX стоят в двух местах: блок `#contact` в `index.html` и блок `#join` в `training.html`. Меняйте в обоих.

### Цифры (раздел `#proof`, блок `.stats`)
Число в атрибуте `data-count` анимируется, `data-suffix` добавляется после него, подпись в `<span>`:
```html
<div><b data-count="60" data-suffix="%">0</b><span>экономии человекотруда</span></div>
```

### Кнопка «Обучение» (шапка)
Сейчас ведёт на `#`. Замените `href` на нужный адрес в двух местах: в шапке (`.btn-edu`) и в мобильном меню (`.mnav`).

### Партнёр в шапке
Логотип «Татнефти» лежит в `media/tatneft.svg` и используется в шапке и в блоке «О нас».

### Фото и видео «в полях» (блок `.gallery`)
Положите файлы в `media/` и замените содержимое слота:
```html
<!-- большой слот: видео без звука, в цикле -->
<figure class="slot wide">
  <video src="media/field.mp4" poster="media/field.jpg" autoplay muted loop playsinline></video>
</figure>

<!-- обычный слот: фото -->
<figure class="slot"><img src="media/photo1.jpg" alt="Что на фото" loading="lazy"></figure>
```
Рекомендации: фото до 1600 px по длинной стороне (JPG/WebP, до 300 КБ), видео H.264 до 5 МБ и 15–20 секунд.

## Публикация на GitHub Pages
1. Залейте файлы в репозиторий (например, `tehnostage.github.io` или любой другой).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Свой домен: Settings → Pages → Custom domain.
