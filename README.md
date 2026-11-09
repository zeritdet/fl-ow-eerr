# Gent Flowers — Pages CMS

Ten pakiet jest dopasowany do przesłanego projektu Gent Flowers (HTML/CSS/JS), a nie jest ogólnym szablonem.

## Co można edytować w Pages CMS
- Logo oraz wszystkie zdjęcia: hero, kolekcje, bukiety, sekcja O nas.
- Teksty po polsku i angielsku.
- Kolory strony (wartości HEX).
- Linki menu i przyciski.
- Kolekcje i produkty: dodawanie/usuwanie pozycji, zdjęcia, ceny, opisy i warianty kolorów.
- Dodatkowe bloki tekstowe, zdjęciowe i CTA.
- Zachowane są oryginalny układ, style, font Karla oraz interakcje katalogu (widoki, modal, koszyk).

## Instalacja
1. Utwórz repozytorium GitHub, np. `gent-flowers`.
2. Wgraj do głównego katalogu repozytorium wszystkie pliki z tego pakietu:
   - `.pages.yml`
   - `index.html`
   - `data/site.json`
   - `js/cms.js`
   - `css/cms.css`
   - `media/` (folder na nowe zdjęcia)
   - `gent-flowers-logo.png`
   - `Karla-VariableFont_wght.ttf`
3. Otwórz https://app.pagescms.org/ i zaloguj się przez GitHub.
4. Установи Pages CMS GitHub App для репозитория и выбери репозиторий `gent-flowers`.
5. Pages CMS прочитает `.pages.yml`. Открой запись «Gent Flowers — treść strony».
6. Замени тестовые фотографии/тексты, нажми Save.
7. Включи GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root).

## Важные замечания
- Сайт читает данные из `data/site.json`; CMS меняет этот JSON и загружает изображения в `media/`.
- В исходном макете фотографии были внешними Unsplash-ссылками. Их можно оставить или заменить загрузками в CMS.
- `media.output` настроен как `/media`. Для GitHub Pages с адресом вида `username.github.io/repo/` может понадобиться собственный домен или изменение путей на относительные; проверьте путь после первой публикации.
- Это статический сайт: админка не управляет произвольным CSS-кодом. Она управляет цветами через заданные CSS-переменные и контентом через предусмотренные поля/блоки.
- Проверь сайт через локальный сервер (например VS Code Live Server), не открывай index.html напрямую через file://.
- Перед заменой старого проекта сохрани резервную копию.

## Состав
- `.pages.yml` — схема редактора Pages CMS.
- `data/site.json` — исходные тексты, изображения, продукты и настройки.
- `js/cms.js` — вывод данных CMS и поведение интерфейса.
- `css/cms.css` — CSS-переменные и стили дополнительных блоков.
- `index.html` — исходный макет Gent Flowers с подключённым CMS-адаптером.
