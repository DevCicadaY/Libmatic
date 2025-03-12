// ==UserScript==
// @name         Автоматическое добавление друзей на LiveLib
// @namespace    https://github.com/DevCicadaY/Libmatic
// @version      0.1
// @description  Скрипт для автоматического добавления пользователей в друзья на LiveLib
// @author       DevCicadaY
// @match        https://www.livelib.ru/readers*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Счетчик добавленных друзей
    let count = 0;

    // Функция для генерации случайных задержек
    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Функция для случайной паузы
    function waitRandom(min, max) {
        const delay = getRandomDelay(min, max);
        showNotification(`⏳ Ждем ${delay / 1000} сек...`);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    // Функция для отображения уведомлений
    function showNotification(message) {
        const notification = document.getElementById('notification');
        const counter = document.getElementById('counter');
        const log = document.getElementById('log');
        const timestamp = new Date().toLocaleTimeString();

        log.innerHTML = `<p><strong>${timestamp}</strong> - ${message}</p>` + log.innerHTML; // Добавляем сообщение в начало лога
        counter.textContent = count;

        notification.classList.add('show');
    }

    // Функция для клика по кнопке
    async function clickButton(button) {
        await waitRandom(15000, 90000); // Задержка перед нажатием: от 15 до 90 секунд
        showNotification(`✅ Нажали: ${button.title}`);
        button.click();
        count++;
        showNotification(`Добавлено: ${count} пользователей`);
    }

    // Функция для добавления друзей
    async function addFriends() {
        const buttons = document.querySelectorAll('a.btn-fill.btn-darkgreen[title^="Добавить"]');

        if (buttons.length > 0) {
            showNotification(`🔍 Найдено ${buttons.length} кнопок 'Добавить в друзья'.`);

            for (const button of buttons) {
                await clickButton(button);
                const randomBreak = getRandomDelay(10000, 30000); // Пауза от 10 до 30 секунд после каждого клика
                await waitRandom(randomBreak, randomBreak);
            }

            // Перерыв между добавлением друзей
            const breakTime = getRandomDelay(20 * 60 * 1000, 50 * 60 * 1000); // Перерыв от 20 до 50 минут
            showNotification(`🛑 Перерыв на ${breakTime / 60000} минут...`);
            setTimeout(addFriends, breakTime);
        } else {
            const showMoreButton = document.querySelector('#user-friends-more a.btn-fill-empty.btn-wh');
            if (showMoreButton) {
                showNotification("🔄 Нажимаем 'Показать ещё 25'...");
                showMoreButton.click();
                await waitRandom(8000, 15000); // Пауза перед подгрузкой
                addFriends();
            } else {
                const retryDelay = getRandomDelay(30 * 60 * 1000, 90 * 60 * 1000); // Ожидание 30-90 минут
                showNotification(`😴 Нечего добавлять, проверим через ${retryDelay / 60000} минут...`);
                setTimeout(addFriends, retryDelay);
            }
        }
    }

    // Функция для создания блока уведомлений
    function createNotificationBlock() {
        const notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification';
        notificationDiv.className = 'notification';
        notificationDiv.innerHTML = `
            <p id="notification-text">В процессе добавления в друзья...</p>
            <p id="count">Добавлено: <span id="counter">0</span> пользователей</p>
            <div id="log"></div>
        `;
        document.body.appendChild(notificationDiv);

        // CSS для уведомлений
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

    // Запуск основной функции
    createNotificationBlock();
    addFriends();
})();