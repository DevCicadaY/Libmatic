// ==UserScript==
// @name         LiveLib: Авто-добавление друзей (Книжный вызов)
// @namespace    https://github.com/DevCicadaY/Libmatic
// @version      0.1
// @description  Автоматически добавляет участников Книжного вызова в друзья на LiveLib
// @author       DevCicadaY
// @match        https://www.livelib.ru/challenge/2025/reader/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Функция для добавления лога на страницу
    const addLogMessage = (message) => {
        let logElement = document.getElementById('addFriendLog');
        if (!logElement) {
            logElement = document.createElement('div');
            logElement.id = 'addFriendLog';
            logElement.style.position = 'fixed';
            logElement.style.top = '10px';
            logElement.style.left = '10px';
            logElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            logElement.style.color = 'white';
            logElement.style.padding = '10px';
            logElement.style.zIndex = '9999';
            document.body.appendChild(logElement);
        }
        logElement.innerHTML = message;
    };

    // Функция для проверки, подписан ли уже пользователь
    const isAlreadySubscribed = () => {
        const subscribedText = document.querySelector('.kv-user__btn-add.disabled');
        return subscribedText !== null;
    };

    // Функция для поиска и нажатия на кнопку "В друзья"
    const addFriendButtonClick = () => {
        // Проверка на подписку
        if (isAlreadySubscribed()) {
            addLogMessage('Вы уже подписаны. Закрытие вкладки...');
            window.close(); // Закрываем вкладку, если уже подписан
            return;
        }

        // Ищем все кнопки, которые могут быть кнопками "В друзья"
        const buttons = document.querySelectorAll('a');

        // Перебираем все найденные ссылки
        for (let button of buttons) {
            if (button.textContent.trim() === 'В друзья' && !button.classList.contains('disabled')) {
                // Пробуем вызвать событие click
                button.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
                addLogMessage('Кнопка "В друзья" нажата! Ожидание подтверждения...');
                // Ожидание 5 секунд для подтверждения подписки
                setTimeout(() => {
                    if (isAlreadySubscribed()) {
                        addLogMessage('Подписка успешно оформлена! Закрытие вкладки...');
                        window.close(); // Закрытие вкладки после успешной подписки
                    } else {
                        addLogMessage('Ошибка при подписке. Закрытие вкладки...');
                        window.close(); // Закрытие вкладки, если подписка не прошла
                    }
                }, 5000); // Ожидаем 5 секунд после нажатия кнопки
                return; // Прерываем выполнение после первого клика
            }
        }

        addLogMessage('Кнопка "В друзья" не найдена или она заблокирована. Закрытие вкладки...');
        window.close(); // Закрываем вкладку, если кнопка не найдена
    };

    // Даем странице время на загрузку, если требуется
    setTimeout(() => {
        addFriendButtonClick();
    }, 2000); // Подождать 2 секунды перед запуском функции
})();