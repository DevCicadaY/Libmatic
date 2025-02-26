// ==UserScript==
// @name         Автоматическое добавление лайков на LiveLib
// @namespace    https://github.com/DevCicadaY/Libmatic
// @version      0.1
// @description  Скрипт для автоматического лайкания отзывов, цитат, историй и лайфхаков на LiveLib
// @author       DevCicadaY
// @match        https://www.livelib.ru/reviews*
// @match        https://www.livelib.ru/quotes*
// @match        https://www.livelib.ru/stories*
// @match        https://www.livelib.ru/lifehacks*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let likeCount = 0; // Счетчик лайков

    // Генерация случайной задержки
    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Ожидание случайного времени
    function waitRandom(min, max) {
        let delay = getRandomDelay(min, max);
        showNotification(`⏳ Ожидаем ${delay / 1000} сек...`);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    // Отображение уведомлений
    function showNotification(message) {
        const notification = document.getElementById('notification');
        const counter = document.getElementById('counter');
        const log = document.getElementById('log');
        const timestamp = new Date().toLocaleTimeString();

        log.innerHTML = `<p><strong>${timestamp}</strong> - ${message}</p>` + log.innerHTML;
        counter.textContent = likeCount;

        notification.classList.add('show');
    }

    // Нажатие кнопки лайка
    async function clickLikeButton(button) {
        await waitRandom(15000, 90000); // Задержка перед нажатием
        showNotification(`✅ Лайк поставлен: ${button.title}`);
        button.click();
        likeCount++;
        showNotification(`Поставлено лайков: ${likeCount}`);
    }

    // Подгрузка дополнительного контента
    async function loadMoreContent() {
        let loadMoreButton = document.querySelector('a.btn__show-more');

        if (loadMoreButton) {
            showNotification(`🔄 Нажимаем кнопку 'Показать ещё'...`);
            loadMoreButton.click();
            await waitRandom(8000, 15000); // Пауза перед подгрузкой
            likePosts();
        } else {
            showNotification(`😴 Нечего подгружать, проверим через несколько минут...`);
        }
    }

    // Лайкание постов
    async function likePosts() {
        let buttons = document.querySelectorAll('a.sab__link.popup-load-data.icon-like[title="Мне нравится"]');

        if (buttons.length > 0) {
            showNotification(`🔍 Найдено ${buttons.length} кнопок для лайков.`);

            for (let button of buttons) {
                if (!button.classList.contains('sab__link--active')) {
                    await clickLikeButton(button); // Лайкнуть, если еще не лайкнут
                } else {
                    showNotification(`💡 Уже лайкнуто: ${button.title}`);
                }
                let randomBreak = getRandomDelay(10000, 30000); // Пауза между кликами
                await waitRandom(randomBreak, randomBreak);
            }

            // Перерыв после лайков
            let breakTime = getRandomDelay(20 * 60 * 1000, 50 * 60 * 1000);
            showNotification(`🛑 Перерыв на ${breakTime / 60000} минут...`);
            setTimeout(likePosts, breakTime);
        } else {
            loadMoreContent();
        }
    }

    // Создание блока уведомлений
    function createNotificationUI() {
        const notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification';
        notificationDiv.className = 'notification';
        notificationDiv.innerHTML = `
            <p id="notification-text">В процессе лайканья...</p>
            <p id="count">Поставлено лайков: <span id="counter">0</span></p>
            <div id="log"></div>
        `;
        document.body.appendChild(notificationDiv);

        const style = document.createElement('style');
        style.innerHTML = `
            #notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                z-index: 9999;
                display: none;
                opacity: 0;
                transition: opacity 0.5s ease, transform 0.5s ease;
                width: auto;
                max-width: 500px;
                text-align: left;
            }

            #notification.show {
                display: block;
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            #notification p {
                margin: 0;
                font-size: 14px;
            }

            #count {
                font-weight: bold;
                font-size: 16px;
                margin-top: 8px;
            }

            #log {
                margin-top: 10px;
                max-height: 300px;
                overflow-y: auto;
                font-size: 12px;
                color: #ccc;
                border-top: 1px solid #444;
                padding-top: 10px;
            }

            #log p {
                margin-bottom: 5px;
            }
        `;
        document.head.appendChild(style);
    }

    // Запуск скрипта
    createNotificationUI();
    likePosts();
})();