// ==UserScript==
// @name         LiveLib: Автооткрытие профилей (Книжный вызов)
// @namespace    https://github.com/DevCicadaY/Libmatic
// @version      0.1
// @description  Открывает профили участников Книжного вызова с задержкой 15 секунд + автоклик "Показать еще"
// @author       DevCicadaY
// @match        https://www.livelib.ru/challenge/2025/info
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let count = 0; // Счетчик открытых страниц
    let queue = []; // Очередь ссылок на открытие
    let opening = false; // Флаг, чтобы не открывать несколько ссылок одновременно

    // Создаем счетчик открытых страниц
    const counterDiv = document.createElement('div');
    counterDiv.style.position = 'fixed';
    counterDiv.style.top = '10px';
    counterDiv.style.right = '10px';
    counterDiv.style.padding = '10px';
    counterDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    counterDiv.style.color = '#fff';
    counterDiv.style.fontSize = '16px';
    counterDiv.style.borderRadius = '5px';
    counterDiv.style.zIndex = '9999';
    counterDiv.innerHTML = `Открыто страниц: 0`;
    document.body.appendChild(counterDiv);

    // Функция добавления ссылок в очередь
    function enqueueProfileLinks() {
        document.querySelectorAll('.kv-friends__link').forEach(link => {
            if (!link.dataset.queued) {
                link.dataset.queued = "true"; // Помечаем как добавленный в очередь
                queue.push(link.href);
            }
        });
    }

    // Функция открытия страницы в фоне
    function openInBackground(url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);

        // Имитация клика с "модификатором"
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            ctrlKey: navigator.platform.includes('Mac') ? false : true, // Ctrl для Windows/Linux
            metaKey: navigator.platform.includes('Mac') ? true : false // Cmd для Mac
        });

        link.dispatchEvent(event); // Запускаем клик
        document.body.removeChild(link); // Удаляем ссылку после клика
    }

    // Функция открытия профилей с случайным интервалом
    async function openProfiles() {
        if (opening) return; // Если уже идет процесс - выходим
        opening = true;

        // Создаем элемент для отображения таймера
        const timerDiv = document.createElement('div');
        timerDiv.style.position = 'fixed';
        timerDiv.style.top = '50px';
        timerDiv.style.right = '10px';
        timerDiv.style.padding = '10px';
        timerDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        timerDiv.style.color = '#fff';
        timerDiv.style.fontSize = '16px';
        timerDiv.style.borderRadius = '5px';
        timerDiv.style.zIndex = '9999';
        timerDiv.innerHTML = `Ожидаем: 0 секунд`;
        document.body.appendChild(timerDiv);

        while (queue.length > 0) {
            const link = queue.shift(); // Берем первую ссылку из очереди
            openInBackground(link); // Открываем в фоне

            count++;
            counterDiv.innerHTML = `Открыто страниц: ${count}`;

            // Генерация случайного интервала от 30 секунд до 3 минут (от 30000 до 180000 миллисекунд)
            const randomDelay = Math.floor(Math.random() * 150000) + 30000; // От 30 секунд до 3 минут

            // Выводим случайное значение в консоль
            console.log(`Задержка: ${randomDelay / 1000} секунд`);

            // Создаем таймер, который будет показывать оставшееся время
            let remainingTime = randomDelay / 1000; // Переводим в секунды
            timerDiv.innerHTML = `Ожидаем: ${remainingTime} секунд`;

            // Обновляем таймер каждую секунду
            const interval = setInterval(() => {
                remainingTime--;
                timerDiv.innerHTML = `Ожидаем: ${remainingTime} секунд`;
                if (remainingTime <= 0) {
                    clearInterval(interval); // Останавливаем таймер, когда время истечет
                }
            }, 1000);

            // Ждем случайный интервал
            await new Promise(resolve => setTimeout(resolve, randomDelay)); // Ждем случайный интервал
        }

        opening = false;
    }

    // Функция для клика по кнопке "Показать еще"
    function clickShowMoreButton() {
        const button = document.querySelector('.btn__show-more');
        if (button) {
            console.log('Нажатие на кнопку "Показать еще"');
            button.click();
        } else {
            console.log('Кнопка "Показать еще" не найдена, возможно, достигнут конец списка.');
        }
    }

    // Основной цикл: каждые случайные 5-15 минут проверяем кнопку и добавляем ссылки
    function mainLoop() {
        clickShowMoreButton(); // Нажимаем "Показать еще", если доступно
        enqueueProfileLinks(); // Добавляем новые профили в очередь
        if (!opening) { // Проверка, чтобы запускать открытие только если не происходит другого процесса
            openProfiles(); // Открываем профили по очереди
        }

        // Генерация случайного интервала от 5 до 15 минут
        const randomDelay = Math.floor(Math.random() * 600000) + 300000; // От 5 до 15 минут (в миллисекундах)

        // Создаем элемент для отображения задержки
        const delayDiv = document.createElement('div');
        delayDiv.style.position = 'fixed';
        delayDiv.style.top = '100px';
        delayDiv.style.right = '10px';
        delayDiv.style.padding = '10px';
        delayDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        delayDiv.style.color = '#fff';
        delayDiv.style.fontSize = '16px';
        delayDiv.style.borderRadius = '5px';
        delayDiv.style.zIndex = '9999';
        delayDiv.innerHTML = `Следующий запуск через: ${randomDelay / 1000 / 60} минут`;
        document.body.appendChild(delayDiv);

        // Обновляем оставшееся время каждую секунду
        let remainingTime = randomDelay / 1000; // Переводим в секунды
        const interval = setInterval(() => {
            remainingTime--;
            delayDiv.innerHTML = `Следующий запуск через: ${(remainingTime / 60).toFixed(1)} минут`;
            if (remainingTime <= 0) {
                clearInterval(interval); // Останавливаем таймер, когда время истечет
            }
        }, 1000);

        // Запускаем основной цикл через случайный интервал
        setTimeout(mainLoop, randomDelay); // Запускаем снова через случайный интервал
    }
    // Запускаем основной цикл
    mainLoop();
})();