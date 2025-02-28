// ==UserScript==
// @name         Автоматическое добавление друзей на LiveLib (из ленты рецензий)
// @namespace    https://github.com/DevCicadaY/Libmatic
// @version      0.1
// @description  Скрипт для автоматического добавления пользователей в друзья на LiveLib
// @author       DevCicadaY
// @match        https://www.livelib.ru/reviews*
// @match        https://www.livelib.ru/reader/*
// @match        https://www.livelib.ru/readers*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let count = 0; // Счетчик открытых страниц

    // Функция для генерации случайных задержек
    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Функция для случайной паузы
    function waitRandom(min, max) {
        const delay = getRandomDelay(min, max);
        updateTimer(delay);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    // Обновление времени на таймере
    function updateTimer(time) {
        let remainingTime = time;
        const timerDisplay = document.getElementById('timer');
        const interval = setInterval(() => {
            if (remainingTime <= 0) {
                clearInterval(interval);
                return;
            }
            remainingTime -= 1000;
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            timerDisplay.textContent = `Осталось: ${minutes} мин ${seconds} сек`;
        }, 1000);
    }

    // Функция для обновления страницы каждые 30 минут
    function refreshPage() {
        // Элемент для отображения оставшегося времени
        const countdownElement = document.createElement('div');
        countdownElement.style.position = 'fixed';
        countdownElement.style.bottom = '10px';
        countdownElement.style.left = '10px'; // Изменено на left для левого угла
        countdownElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        countdownElement.style.color = 'white';
        countdownElement.style.padding = '10px';
        countdownElement.style.borderRadius = '5px';
        document.body.appendChild(countdownElement);

        let remainingTime = 1800000; // 30 минут в миллисекундах

        // Функция для обновления оставшегося времени
        function updateCountdown() {
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            countdownElement.textContent = `Оставшееся время: ${minutes}мин ${seconds}сек`;

            remainingTime -= 1000;

            if (remainingTime <= 0) {
                window.location.reload(); // Обновляем страницу
            }
        }

        // Обновляем счетчик каждую секунду
        setInterval(updateCountdown, 1000);

        // Запускаем обновление страницы через 30 минут
        setInterval(function() {
            window.location.reload();
        }, 1800000); // Интервал в 30 минут
    }

    // Запускаем обновление страницы, если находимся на странице с обзорами
    if (window.location.href.match(/https:\/\/www\.livelib\.ru\/reviews/)) {
        refreshPage();
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

    async function clickButton(button) {
        await waitRandom(15000, 90000); // Задержка перед нажатием (15–90 сек)

        // Создаём ссылку
        const link = document.createElement('a');
        link.href = button.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);

        // Имитация клика с "модификатором" (в реальности не работает)
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            ctrlKey: navigator.platform.includes('Mac') ? false : true, // Ctrl для Windows/Linux
            metaKey: navigator.platform.includes('Mac') ? true : false // Cmd для Mac
        });

        link.dispatchEvent(event); // Запускаем клик
        document.body.removeChild(link); // Удаляем ссылку после клика

        count++;
        showNotification(`✅ Открыта страница: ${button.href}`);
        showNotification(`Открыто: ${count} страниц`);
    }

    // Функция для открытия всех страниц пользователей
    async function openUserPages() {
        const userLinks = document.querySelectorAll('a.header-card-user__name');

        if (userLinks.length > 0) {
            showNotification(`🔍 Найдено ${userLinks.length} ссылок на профили пользователей.`);

            for (const link of userLinks) {
                await clickButton(link);
                const randomBreak = getRandomDelay(10000, 30000); // Пауза от 10 до 30 секунд после каждого клика
                await waitRandom(randomBreak, randomBreak);
            }

            // Перерыв между открытиями страниц
            const breakTime = getRandomDelay(20 * 60 * 1000, 50 * 60 * 1000); // Перерыв от 20 до 50 минут
            showNotification(`🛑 Перерыв на ${breakTime / 60000} минут...`);
            setTimeout(openUserPages, breakTime);
        } else {
            const retryDelay = getRandomDelay(30 * 60 * 1000, 90 * 60 * 1000); // Ожидание 30-90 минут
            showNotification(`😴 Нет ссылок, проверим через ${retryDelay / 60000} минут...`);
            setTimeout(openUserPages, retryDelay);
        }
    }

    // Функция для проверки доступности кнопки и кликания по ней (добавление в друзья)
    function clickAddFriendButton() {
        const buttons = document.querySelectorAll('a.btn-fill.btn-darkgreen[onclick*="ll_friend"]');
        let buttonClicked = false;

        buttons.forEach(function(button) {
            if (button && !button.disabled) {
                button.click(); // Кликаем по кнопке, если она доступна
                console.log('Кнопка нажата');
                buttonClicked = true;
            } else {
                console.log('Кнопка недоступна');
            }
        });

        return buttonClicked; // Возвращаем флаг, был ли клик по кнопке
    }

    // Для страницы пользователя (профиля), только клик по кнопке "Добавить в друзья"
    if (window.location.href.match(/https:\/\/www\.livelib\.ru\/reader\//)) {
        setTimeout(function() {
            var buttonClicked = clickAddFriendButton(); // Кликаем по кнопке

            // Если кнопка не была найдена, сразу закрываем страницу
            if (!document.querySelectorAll('a.btn-fill.btn-darkgreen[onclick*="ll_friend"]').length) {
                console.log('Кнопка не найдена, закрытие страницы');
                window.close(); // Закрыть вкладку
            }

            // Если кнопка была нажата, ждем 30 секунд перед закрытием
            if (buttonClicked) {
                console.log('Ожидание 30 секунд перед закрытием страницы');
                setTimeout(function() {
                    console.log('Закрытие страницы');
                    window.close(); // Закрыть вкладку
                }, 30000); // Ждем 30 секунд
            }
        }, 15000); // Ожидаем 15 секунд перед выполнением
    }

    // Для страницы со списком читателей (если доступна пагинация)
    else if (window.location.href.match(/https:\/\/www\.livelib\.ru\/readers/)) {
        function scrollAndClick() {
            var buttonClicked = clickAddFriendButton(); // Кликаем по кнопке на текущей странице

            if (!document.querySelectorAll('a.btn-fill.btn-darkgreen[onclick*="ll_friend"]').length) {
                console.log('Кнопка не найдена, закрытие страницы');
                window.close(); // Закрыть вкладку
            }

            if (buttonClicked) {
                console.log('Ожидание 30 секунд перед закрытием страницы');
                setTimeout(function() {
                    console.log('Закрытие страницы');
                    window.close(); // Закрыть вкладку
                }, 30000); // Ждем 30 секунд
            }

            window.scrollTo(0, document.body.scrollHeight);

            var nextButton = document.querySelector('a.pagination__next');
            if (nextButton && !nextButton.disabled) {
                nextButton.click(); // Кликаем на кнопку "Следующая страница"
                console.log('Переход на следующую страницу');
                setTimeout(scrollAndClick, 3000); // После 3 секунд возвращаемся и снова ищем кнопки
            } else {
                console.log('Нет следующей страницы');
                setTimeout(function() {
                    console.log('Закрытие страницы');
                    window.close(); // Закрыть вкладку, если пагинации больше нет
                }, 30000); // Ждем 30 секунд перед закрытием
            }
        }

        setTimeout(function() {
            scrollAndClick();
        }, 15000); // Даем 15 секунд на ожидание
    }

    // Запуск функции открытия страниц пользователей, если мы на странице с обзорами
    if (window.location.href.match(/https:\/\/www\.livelib\.ru\/reviews/)) {
        // Создание блока уведомлений
        function createNotificationBlock() {
            const notificationDiv = document.createElement('div');
            notificationDiv.id = 'notification';
            notificationDiv.className = 'notification';
            notificationDiv.innerHTML = `
                <p id="notification-text">В процессе открытия страниц...</p>
                <p id="count">Открыто: <span id="counter">0</span> страниц</p>
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

        // Создание блока для таймера
        function createTimerBlock() {
            const timerDiv = document.createElement('div');
            timerDiv.id = 'timer-container';
            timerDiv.innerHTML = `
                <h3>Ожидание следующего обновления</h3>
                <p id="timer">Осталось: 0 мин 0 сек</p>
            `;
            document.body.appendChild(timerDiv);

            const timerStyle = document.createElement('style');
            timerStyle.innerHTML = `
                #timer-container {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 15px;
                    border-radius: 12px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    z-index: 9999;
                    width: auto;
                    max-width: 300px;
                    text-align: center;
                }
                #timer-container p {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 0;
                }
            `;
            document.head.appendChild(timerStyle);
        }

        createNotificationBlock();
        createTimerBlock();
        openUserPages();
    }
})();