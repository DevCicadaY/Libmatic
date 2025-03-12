// ==UserScript==
// @name         Libmatic
// @namespace    https://github.com/DevCicadaY/Libmatic
// @version      2.0
// @description  Автоматизация действий на LiveLib
// @author       DevCicadaY
// @match        https://www.livelib.ru
// @match        https://www.livelib.ru/reviews
// @match        https://www.livelib.ru/quotes
// @match        https://www.livelib.ru/stories
// @match        https://www.livelib.ru/lifehacks
// @match        https://www.livelib.ru/reader/*
// @match        https://www.livelib.ru/challenge/2025/info
// @match        https://www.livelib.ru/challenge/2025/reader/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Глобальные переменные для управления состоянием
    let refreshIntervalId = null;
    let isInitialized = false; // Флаг инициализации
    let openedProfiles = new Set(); // Множество для отслеживания открытых профилей
    let openedPages = new Set(); // Множество для отслеживания открытых страниц

    // Структура для хранения статистики
    const defaultStats = {
        friends: 0,
        likes: 0,
        lastUpdate: Date.now(),
        // Детальные оценки времени для каждого действия (в секундах)
        timeEstimates: {
            like: {
                find: 2.5,      // Поиск и движение к кнопке лайка
                click: 1.5,     // Клик и подтверждение
                total: 4        // Общее время на один лайк
            },
            friend: {
                openProfile: 3.5,    // Открытие профиля
                findButton: 2,       // Поиск кнопки "Добавить в друзья"
                click: 3.5,          // Клик и ожидание подтверждения
                closeTab: 1,         // Закрытие вкладки
                total: 10           // Общее время на добавление друга
            },
            page: {
                open: 2.5,           // Открытие новой страницы
                loadWait: 3.5,       // Ожидание загрузки
                scroll: 5,           // Прокрутка и сканирование страницы
                total: 11           // Общее время на обработку страницы
            }
        },
        savedTime: {
            likes: 0,
            friends: 0,
            pages: 0
        },
        visitedProfiles: new Set()
    };

    // Функция для сохранения статистики
    function savePageStats(pageUrl, stats) {
        const allStats = JSON.parse(localStorage.getItem('pageStats') || '{}');
        allStats[pageUrl] = {
            ...stats,
            lastUpdate: Date.now(),
            visitedProfiles: Array.from(stats.visitedProfiles || new Set()) // Преобразуем Set в массив для сохранения
        };
        localStorage.setItem('pageStats', JSON.stringify(allStats));
    }

    // Функция для загрузки статистики
    function loadPageStats(pageUrl) {
        const allStats = JSON.parse(localStorage.getItem('pageStats') || '{}');
        const savedStats = allStats[pageUrl] || {};

        // Создаем новый объект с дефолтными значениями
        const stats = {
            friends: savedStats.friends || 0,
            likes: savedStats.likes || 0,
            lastUpdate: savedStats.lastUpdate || Date.now(),
            timeEstimates: defaultStats.timeEstimates,
            savedTime: {
                likes: savedStats.savedTime?.likes || 0,
                friends: savedStats.savedTime?.friends || 0,
                pages: savedStats.savedTime?.pages || 0
            },
            visitedProfiles: new Set(savedStats.visitedProfiles || [])
        };

        return stats;
    }

    // Функция для форматирования времени
    function formatSavedTime(seconds) {
        if (seconds < 60) return `${seconds} сек`;
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes} мин ${secs} сек`;
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} ч ${minutes} мин`;
    }

    // Функция для получения состояния бота
    function getBotState() {
        return localStorage.getItem('botEnabled') === 'true';
    }

    // Функция для обновления состояния бота
    function updateBotState(enabled) {
        localStorage.setItem('botEnabled', enabled);

        // Обновляем индикатор на текущей странице
        const statusIndicator = document.querySelector('.bot-indicator');
        if (statusIndicator) {
            statusIndicator.className = `bot-indicator ${enabled ? 'enabled' : 'disabled'}`;
            const titleElement = statusIndicator.parentElement.querySelector('.info-title');
            if (titleElement) {
                titleElement.style.color = enabled ? '#4CAF50' : '#FF0000';
            }
        }

        // Отправляем событие для синхронизации между вкладками
        window.dispatchEvent(new CustomEvent('botStateChanged', { detail: { enabled } }));

        // Если бот включен, запускаем функциональность
        if (enabled) {
            if (!isInitialized) {
                init();
            }
            if (!refreshIntervalId) {
                refreshPage();
            }
        } else {
            // Если бот выключен, останавливаем все процессы
            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
                refreshIntervalId = null;
            }
        }

        // Показываем сообщение о состоянии
        addLogMessage(enabled ? 'Бот включен' : 'Бот отключен');
    }

    // Инициализация состояния при запуске скрипта
    function initBotState() {
        // Если состояние не установлено, устанавливаем по умолчанию как включенное
        if (localStorage.getItem('botEnabled') === null) {
            localStorage.setItem('botEnabled', 'true');
        }

        // Применяем текущее состояние
        const enabled = getBotState();
        const statusIndicator = document.querySelector('.bot-indicator');
        if (statusIndicator) {
            statusIndicator.className = `bot-indicator ${enabled ? 'enabled' : 'disabled'}`;
            const titleElement = statusIndicator.parentElement.querySelector('.info-title');
            if (titleElement) {
                titleElement.style.color = enabled ? '#4CAF50' : '#FF0000';
            }
        }

        // Если бот включен, запускаем функциональность
        if (enabled && !isInitialized) {
            init();
        }
    }

    // Основная функция инициализации
    function init() {
        if (isInitialized) return;
        isInitialized = true;

        // Проверяем состояние бота
        const botEnabled = getBotState();

        // Добавляем кнопку управления
        addChallengeButton();

        // Если бот выключен, не запускаем основную функциональность
        if (!botEnabled) {
            return;
        }

        // Функция проверки готовности страницы
        function checkPageReady() {
            return new Promise((resolve) => {
                // Проверяем наличие основных элементов на странице
                const interval = setInterval(() => {
                    let isReady = false;

                    // Проверяем разные элементы в зависимости от страницы
                    if (window.location.href === 'https://www.livelib.ru/' ||
                        window.location.href === 'https://www.livelib.ru') {
                        isReady = document.body !== null;
                    } else if (window.location.href.includes('livelib.ru')) {
                        isReady = true;
                    }

                    if (isReady) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 1000);

                // Прекращаем проверку через 30 секунд
                setTimeout(() => {
                    clearInterval(interval);
                    resolve();
                }, 30000);
            });
        }

        // Ждем загрузки страницы и затем выполняем действия
        checkPageReady().then(() => {
            // Добавляем случайную задержку от 3 до 5 секунд
            const randomDelay = Math.random() * 2000 + 3000;

            setTimeout(() => {
                // Добавляем кнопку на всех страницах
                addChallengeButton();

                // Если это страница вызова, сразу запускаем обработку профилей
                if (window.location.href === 'https://www.livelib.ru/challenge/2025/info') {
                    handleProfileLinks();
                }
                // Проверяем, что текущая страница не является страницей профиля
                else if (!window.location.href.startsWith('https://www.livelib.ru/reader/')) {
                    handleLikeButtons();
                    // Запускаем обработку профилей с дополнительной задержкой
                    if (!window.location.href.includes('/challenge/2025/info')) {
                        setTimeout(handleProfileLinks, 5000);
                    }
                }

                handleSubscriptionButtons();

                // Запускаем обновление страницы только если оно еще не запущено
                if (!refreshIntervalId) {
                    refreshPage();
                }
            }, randomDelay);
        });
    }

    // Имитация поведения человека с увеличенными случайными задержками и паузами
    function simulateHumanBehavior(action, index) {
        var delay = Math.random() * 5000 + 3000; // Случайная задержка от 3 до 8 секунд
        setTimeout(action, delay * index);
    }

    // Обработка кнопок "Мне нравится"
    function handleLikeButtons() {
        var likeButtons = document.querySelectorAll('a.sab__link.icon-like');
        likeButtons.forEach(function(button, index) {
            if (!button.classList.contains('sab__link--active')) {
                simulateHumanBehavior(function() {
                    button.click();
                    // Обновляем статистику после клика
                    setTimeout(() => {
                        const currentUrl = window.location.href;
                        const stats = loadPageStats(currentUrl);
                        stats.likes++;
                        stats.savedTime.likes += stats.timeEstimates.like.total;
                        savePageStats(currentUrl, stats);
                        updateCurrentPageStats();
                    }, 1000);
                }, index);
            }
        });
    }

    // Обработка ссылок на профили с корректным ожиданием закрытия предыдущего
    function handleProfileLinks() {
        // Определяем, на какой странице мы находимся
        const isChallengePage = window.location.href === 'https://www.livelib.ru/challenge/2025/info';
        const isMainPage = [
            'https://www.livelib.ru/reviews',
            'https://www.livelib.ru/quotes',
            'https://www.livelib.ru/stories',
            'https://www.livelib.ru/lifehacks'
        ].includes(window.location.href);

        if (!isMainPage && !isChallengePage) {
            return;
        }

        // Функция для обработки профилей на странице вызова
        function processChallengePage() {
            // Проверяем наличие контейнера с профилями напрямую
            const profileContainer = document.querySelector('.kv-friends__inner');
            if (profileContainer) {
                const profileLinks = profileContainer.querySelectorAll('.kv-friends__link:not(.slick-cloned)');

                if (profileLinks.length > 0) {
                    Array.from(profileLinks).forEach((link, index) => {
                        const href = link.getAttribute('href');
                        if (href && href.startsWith('/challenge/2025/reader/')) {
                            const fullUrl = `https://www.livelib.ru${href}`;
                            if (!openedProfiles.has(fullUrl)) {
                                setTimeout(() => {
                                    openedProfiles.add(fullUrl);
                                    openInBackground(fullUrl);
                                }, index * 100000); // 100 секунд между открытием профилей
                            }
                        }
                    });
                } else {
                    // Повторяем поиск через 5 секунд
                    setTimeout(processChallengePage, 5000);
                }
            } else {
                // Если контейнер не найден, повторяем попытку через 5 секунд
                setTimeout(processChallengePage, 5000);
            }
        }

        // Запускаем обработку профилей только если бот включен
        if (localStorage.getItem('botEnabled') !== 'false') {
            if (isChallengePage) {
                processChallengePage();
            } else {
                // Обработка профилей на основных страницах
                const elements = document.querySelectorAll('a.header-card-user__name');
                const profileLinks = Array.from(elements).filter(link => !openedProfiles.has(link.href));

                var currentIndex = 0;
                var openProfilesCount = 0;
                const MAX_OPEN_PROFILES = 1;

                function openNextProfile() {
                    if (currentIndex < profileLinks.length) {
                        if (openProfilesCount < MAX_OPEN_PROFILES) {
                            var link = profileLinks[currentIndex];
                            if (!openedProfiles.has(link.href)) {
                                openProfilesCount++;
                                openedProfiles.add(link.href);

                                openInBackground(link.href);
                                currentIndex++;

                                const minDelay = 60000; // 60 секунд
                                const maxDelay = 100000; // 100 секунд
                                const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
                                const seconds = Math.floor(nextDelay / 1000);

                                setTimeout(() => {
                                    openProfilesCount--;
                                    openNextProfile();
                                }, nextDelay);
                            } else {
                                currentIndex++;
                                openNextProfile();
                            }
                        }
                    }
                }

                openNextProfile();
            }
        }
    }

    // Функция открытия страницы в фоне
    function openInBackground(url) {
        try {
            if (!url || typeof url !== 'string') {
                return false;
            }

            // Загружаем актуальное состояние
            loadOpenedPages();

            // Проверяем, не открыта ли уже эта страница
            if (openedPages.has(url)) {
                return true;
            }

            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            const isMac = navigator.userAgent.toLowerCase().includes('mac') ||
                         (navigator.platform && navigator.platform.toLowerCase().includes('mac'));

            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                ctrlKey: !isMac,
                metaKey: isMac
            });

            document.body.appendChild(link);
            link.dispatchEvent(event);
            document.body.removeChild(link);

            // Добавляем URL в список открытых страниц и сохраняем
            openedPages.add(url);
            saveOpenedPages();

            // Обновляем tooltip
            const tooltip = document.querySelector('#pageStatusTooltip');
            if (tooltip) {
                tooltip.innerHTML = getPageStatus();
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    // Обработка кнопок "Подписан" и "Добавить в друзья"
    function handleSubscriptionButtons() {
        var subscribedButton = document.querySelector('a.btn-fill-empty.btn-wh.btn-darkgreen[title^="Удалить"]');
        const currentUrl = window.location.href;

        // Определяем, с какой страницы был открыт профиль
        const referrer = document.referrer;
        const parentPages = [
            'https://www.livelib.ru/reviews',
            'https://www.livelib.ru/quotes',
            'https://www.livelib.ru/stories',
            'https://www.livelib.ru/lifehacks',
            'https://www.livelib.ru/challenge/2025/info'
        ];

        // Находим родительскую страницу
        const parentPage = parentPages.find(page => referrer.startsWith(page)) || 'https://www.livelib.ru/challenge/2025/info';

        // Добавляем текущий профиль в список посещенных для родительской страницы
        if (currentUrl.includes('/reader/')) {
            const stats = loadPageStats(parentPage);
            stats.visitedProfiles.add(currentUrl);
            savePageStats(parentPage, stats);
        }

        if (subscribedButton) {
            // Обновляем статистику для родительской страницы
            const stats = loadPageStats(parentPage);
            stats.friends++;
            stats.savedTime.friends += stats.timeEstimates.friend.total;
            savePageStats(parentPage, stats);
            window.close();
            return;
        } else {
            var addFriendButton = document.querySelector('a.btn-fill.btn-darkgreen[title^="Добавить"]');
            if (addFriendButton) {
                addFriendButton.click();
                var attempts = 0;
                var maxAttempts = 5;

                var checkSubscribedInterval = setInterval(function() {
                    attempts++;

                    var newSubscribedButton = document.querySelector('a.btn-fill-empty.btn-wh.btn-darkgreen[title^="Удалить"]');
                    if (newSubscribedButton) {
                        clearInterval(checkSubscribedInterval);
                        // Обновляем статистику для родительской страницы
                        const stats = loadPageStats(parentPage);
                        stats.friends++;
                        stats.savedTime.friends += stats.timeEstimates.friend.total;
                        savePageStats(parentPage, stats);
                        window.close();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkSubscribedInterval);
                        window.close();
                    }
                }, 15000);
            }
        }
    }

    // Функция для обновления страницы каждые 30 минут
    function refreshPage() {
        if (refreshIntervalId) return; // Предотвращаем повторный запуск

        refreshIntervalId = setInterval(function() {
            if (localStorage.getItem('botEnabled') === 'false') {
                clearInterval(refreshIntervalId);
                refreshIntervalId = null;
                return;
            }
            window.location.reload();
        }, 1800000); // 30 минут = 1800000 миллисекунд
    }

    // Обработка ссылок на странице вызова с задержкой
    function handleChallengeLinks() {
        var challengeLinks = document.querySelectorAll('a.kv-friends__link');
        var currentIndex = 0;

        function openNextChallengeLink() {
            if (currentIndex < challengeLinks.length) {
                var link = challengeLinks[currentIndex];
                openInBackground(link.href);
                currentIndex++;

                // Добавляем случайную задержку от 20 до 80 секунд
                const minDelay = 20000; // 20 секунд
                const maxDelay = 80000; // 80 секунд
                const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
                setTimeout(openNextChallengeLink, randomDelay);
            }
        }

        openNextChallengeLink();
    }

    // Функция для добавления лога на страницу
    const addLogMessage = (message) => {
        let logElement = document.getElementById('addFriendLog');
        if (!logElement) {
            // Создаем основной контейнер
            logElement = document.createElement('div');
            logElement.id = 'addFriendLog';
            logElement.style.position = 'fixed';
            logElement.style.top = '20px';
            logElement.style.left = '20px';
            logElement.style.zIndex = '99999';
            logElement.style.transition = 'all 0.3s ease';
            logElement.style.cursor = 'pointer';

            // Добавляем стили анимации
            const styleSheet = document.createElement('style');
            styleSheet.textContent = `
                .bot-indicator {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    transition: all 0.3s ease;
                }
                .bot-indicator.enabled {
                    background-color: #4CAF50;
                    box-shadow: 0 0 15px #4CAF50;
                    animation: pulseGreen 2s infinite;
                }
                .bot-indicator.disabled {
                    background-color: #FF0000;
                    box-shadow: 0 0 15px #FF0000;
                    animation: pulseRed 2s infinite;
                }
                .info-container {
                    position: absolute;
                    left: 35px;
                    top: 0px;
                    background: linear-gradient(to right, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.8));
                    color: #fff;
                    padding: 10px 15px;
                    border-radius: 8px;
                    font-family: Arial, sans-serif;
                    font-size: 13px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(5px);
                    min-width: 200px;
                    opacity: 0;
                    transform: translateX(-10px);
                    transition: all 0.3s ease;
                }
                .info-title {
                    color: #4CAF50;
                    font-weight: bold;
                    margin-bottom: 5px;
                    font-size: 14px;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                }
                .info-message {
                    color: rgba(255, 255, 255, 0.9);
                    line-height: 1.4;
                }
                @keyframes pulseGreen {
                    0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
                    70% { box-shadow: 0 0 0 15px rgba(76, 175, 80, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
                }
                @keyframes pulseRed {
                    0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
                    70% { box-shadow: 0 0 0 15px rgba(255, 0, 0, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
                }
            `;
            document.head.appendChild(styleSheet);

            // Создаем индикатор
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'bot-indicator enabled';

            // Создаем контейнер для информации
            const infoContainer = document.createElement('div');
            infoContainer.className = 'info-container';

            // Создаем элементы для заголовка и сообщения
            const titleElement = document.createElement('div');
            titleElement.className = 'info-title';
            titleElement.textContent = 'LiveLib Бот';

            const messageElement = document.createElement('div');
            messageElement.className = 'info-message';

            infoContainer.appendChild(titleElement);
            infoContainer.appendChild(messageElement);

            // Функция обновления состояния
            const updateBotState = (enabled) => {
                statusIndicator.className = `bot-indicator ${enabled ? 'enabled' : 'disabled'}`;
                titleElement.style.color = enabled ? '#4CAF50' : '#FF0000';
            };

            // Слушаем изменения в localStorage
            window.addEventListener('storage', (e) => {
                if (e.key === 'botEnabled') {
                    updateBotState(e.newValue !== 'false');
                }
            });

            // Добавляем элементы в DOM
            logElement.appendChild(statusIndicator);
            logElement.appendChild(infoContainer);
            document.body.appendChild(logElement);
        }

        // Обновляем сообщение
        const infoContainer = logElement.querySelector('.info-container');
        const messageElement = logElement.querySelector('.info-message');
        if (message && !message.includes('Бот')) {
            messageElement.textContent = message;
            infoContainer.style.opacity = '1';
            infoContainer.style.transform = 'translateX(0)';

            setTimeout(() => {
                infoContainer.style.opacity = '0';
                infoContainer.style.transform = 'translateX(-10px)';
            }, 3000);
        }
    };

    // Функция для проверки, подписан ли уже пользователь
    const isAlreadySubscribed = () => {
        const subscribedText = document.querySelector('.kv-user__btn-add.disabled');
        const subscribedButton = document.querySelector('a.kv-user__btn-add');
        return subscribedText !== null || (subscribedButton && subscribedButton.textContent.trim() === 'Подписан');
    };

    // Функция для поиска и нажатия на кнопку "В друзья" или проверки "Подписан"
    const addFriendButtonClick = () => {
        // Проверка на подписку
        if (isAlreadySubscribed()) {
            window.close();
        }

        // Ищем все div с id, начинающимся на "friends-action"
        const friendDivs = document.querySelectorAll('div[id^="friends-action"]');

        // Перебираем все найденные div
        for (let div of friendDivs) {
            const button = div.querySelector('a.kv-user__btn-add');
            if (button) {
                const buttonText = button.textContent.trim();
                if (buttonText === 'В друзья') {
                    // Пробуем вызвать событие click
                    button.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    }));
                    // Ожидание с 5 попытками для подтверждения подписки
                    let attempts = 0;
                    const maxAttempts = 5;

                    function checkSubscription() {
                        if (attempts >= maxAttempts) {
                            window.close();
                            return;
                        }

                        attempts++;

                        if (isAlreadySubscribed()) {
                            window.close();
                        } else {
                            if (attempts < maxAttempts) {
                                setTimeout(checkSubscription, 5000);
                            } else {
                                window.close();
                            }
                        }
                    }

                    setTimeout(checkSubscription, 20000);
                    return;
                } else if (buttonText === 'Подписан') {
                    window.close();
                    return;
                }
            }
        }
    };

    // Даем странице время на загрузку, если требуется
    setTimeout(() => {
        if (localStorage.getItem('botEnabled') !== 'false') {
            addFriendButtonClick();
        }
    }, 2000);

    // Запуск основной функции инициализации
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initBotState();
            init();
        });
    } else {
        initBotState();
        init();
    }

    // Создаем и показываем индикатор сразу при загрузке скрипта
    addLogMessage();

    // Функция для открытия всех страниц
    function openAllPagesInNewWindow() {
        const pages = [
            'https://www.livelib.ru/reviews',
            'https://www.livelib.ru/quotes',
            'https://www.livelib.ru/stories',
            'https://www.livelib.ru/lifehacks',
            'https://www.livelib.ru/challenge/2025/info'
        ];

        let currentIndex = 0;

        function openNextPage() {
            if (currentIndex < pages.length) {
                const url = pages[currentIndex];
                openInBackground(url);
                currentIndex++;

                // Открываем следующую страницу через 30 секунд
                setTimeout(openNextPage, 30000);
            }
        }

        // Начинаем открывать страницы
        openNextPage();
    }

    // Функция добавления кнопок
    function addChallengeButton() {
        // Проверяем, что мы находимся на главной странице
        if (window.location.href !== 'https://www.livelib.ru/' &&
            window.location.href !== 'https://www.livelib.ru') {
            return;
        }

        // Создаем контейнер
        const dotContainer = document.createElement('div');
        dotContainer.style.position = 'fixed';
        dotContainer.style.bottom = '20px';
        dotContainer.style.right = '20px';
        dotContainer.style.zIndex = '99999';
        dotContainer.style.cursor = 'pointer';

        // Создаем точку
        const dot = document.createElement('div');
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = '#8e44ad';
        dot.style.boxShadow = '0 0 10px rgba(142, 68, 173, 0.7)';
        dot.style.transition = 'all 0.3s ease';
        dot.style.animation = 'pulse 2s infinite';
        dot.style.border = '2px solid rgba(255, 255, 255, 0.3)';

        // Создаем tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'pageStatusTooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.right = '25px';
        tooltip.style.bottom = '-3px';
        tooltip.style.backgroundColor = 'transparent';
        tooltip.style.color = 'white';
        tooltip.style.padding = '8px 12px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'all 0.3s ease';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '999999';
        tooltip.innerHTML = getPageStatus();

        // Добавляем стили анимации
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(142, 68, 173, 0.7);
                    transform: scale(1);
                }
                50% {
                    box-shadow: 0 0 10px 3px rgba(142, 68, 173, 0.5);
                    transform: scale(1.1);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(142, 68, 173, 0);
                    transform: scale(1);
                }
            }
        `;
        document.head.appendChild(style);

        // Эффекты при наведении
        dotContainer.addEventListener('mouseenter', () => {
            dot.style.transform = 'scale(1.2)';
            dot.style.boxShadow = '0 0 15px rgba(142, 68, 173, 0.9)';
            dot.style.backgroundColor = '#9b59b6';
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(0)';
            tooltip.innerHTML = getPageStatus(); // Используем getPageStatus() напрямую
        });

        dotContainer.addEventListener('mouseleave', () => {
            dot.style.transform = 'scale(1)';
            dot.style.boxShadow = '0 0 10px rgba(142, 68, 173, 0.7)';
            dot.style.backgroundColor = '#8e44ad';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(10px)';
        });

        // Добавляем переменные для отслеживания долгого нажатия
        let pressStartTime;
        let pressTimer;
        let resetProgress = 0;
        let resetAnimation;

        // Функция сброса статистики
        function resetStats() {
            localStorage.removeItem('pageStats');
            openedPages.clear();
            saveOpenedPages();
            const tooltip = document.querySelector('#pageStatusTooltip');
            if (tooltip) {
                tooltip.innerHTML = getPageStatus();
            }
            addLogMessage('Статистика сброшена');
            window.location.reload();
        }

        // Обработчик нажатий
        dotContainer.addEventListener('click', (event) => {
            // Левый клик - открываем страницы или включаем/отключаем бота
            if (event.button === 0) {
                if (event.shiftKey) {
                    // Если зажат Shift - переключаем состояние бота
                    const newState = !getBotState();
                    updateBotState(newState);

                    // Если бот включен, инициализируем функциональность
                    if (newState) {
                        init();
                    }
                    return;
                }

                // Проверяем, включен ли бот
                if (!getBotState()) {
                    return;
                }

                // Сначала проверяем статус вкладок
                checkTabsAndUpdateStatus();

                const pages = [
                    'https://www.livelib.ru/reviews',
                    'https://www.livelib.ru/quotes',
                    'https://www.livelib.ru/stories',
                    'https://www.livelib.ru/lifehacks',
                    'https://www.livelib.ru/challenge/2025/info'
                ];

                let currentIndex = 0;

                function openNextPage() {
                    if (currentIndex < pages.length) {
                        const url = pages[currentIndex];
                        if (url && typeof url === 'string' && url.startsWith('https://')) {
                            // Проверяем, не открыта ли уже страница
                            if (!openedPages.has(url)) {
                                openInBackground(url);
                            }
                        }

                        currentIndex++;
                        setTimeout(openNextPage, 30000);
                    }
                }

                openNextPage();
            }
        });

        // Обработчик правого клика для сброса статистики
        dotContainer.addEventListener('contextmenu', (event) => {
            event.preventDefault(); // Предотвращаем стандартное контекстное меню
            resetStats();
        });

        // Добавляем точку и tooltip в контейнер
        dotContainer.appendChild(dot);
        dotContainer.appendChild(tooltip);

        // Добавляем контейнер на страницу
        document.body.appendChild(dotContainer);
    }

    // Обновляем функцию getPageStatus для отображения открытых страниц
    function getPageStatus() {
        const pages = [
            'https://www.livelib.ru/reviews',
            'https://www.livelib.ru/quotes',
            'https://www.livelib.ru/stories',
            'https://www.livelib.ru/lifehacks',
            'https://www.livelib.ru/challenge/2025/info'
        ];

        const pageNames = {
            '/reviews': 'Отзывы',
            '/quotes': 'Цитаты',
            '/stories': 'Истории',
            '/lifehacks': 'Лайфхаки',
            '/challenge/2025/info': 'Вызов'
        };

        loadOpenedPages();

        let totalLikes = 0;
        let totalFriends = 0;
        let totalTime = 0;
        let visitedProfilesCount = 0;

        // Подсчитываем общую статистику
        pages.forEach(page => {
            const stats = loadPageStats(page);
            if (stats.likes > 0) totalLikes += stats.likes;
            if (stats.friends > 0) totalFriends += stats.friends;
            if (stats.visitedProfiles) visitedProfilesCount = Math.max(visitedProfilesCount, stats.visitedProfiles.size);
            const pageSavedTime = (stats.savedTime.likes || 0) + (stats.savedTime.friends || 0) + (stats.savedTime.pages || 0);
            totalTime += pageSavedTime;
        });

        // Стили для контейнера
        let status = `
            <div style="
                background: linear-gradient(135deg, rgba(25,25,35,0.95), rgba(15,15,25,0.95));
                padding: 18px;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                min-width: 280px;
                backdrop-filter: blur(10px);
            ">
        `;

        // Заголовок статуса страниц
        status += `
            <div style="
                font-weight: 600;
                margin-bottom: 12px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 15px;
            ">
                <span style="font-size: 16px;">📊</span>
                <span style="
                    background: linear-gradient(90deg, #fff, #a587bd);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">Статус страниц</span>
            </div>
        `;

        // Статус страниц
        status += '<div style="margin-bottom: 15px;">';
        pages.forEach(page => {
            const path = new URL(page).pathname;
            const isOpened = openedPages.has(page);
            const name = pageNames[path];
            const icon = isOpened ? '✅' : '⏳';

            status += `
                <div style="
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    margin: 6px 0;
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                    font-size: 13px;
                    color: #fff;
                ">
                    <span style="min-width: 24px; font-size: 15px;">${icon}</span>
                    <span style="
                        font-weight: 500;
                        background: linear-gradient(90deg, #fff, #a587bd);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    ">${name}</span>
                </div>
            `;
        });
        status += '</div>';

        // Общая статистика
        status += `
            <div style="
                background: rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 15px;
            ">
                <div style="
                    font-weight: 600;
                    margin-bottom: 12px;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span style="font-size: 16px;">📈</span>
                    <span style="
                        background: linear-gradient(90deg, #fff, #a587bd);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    ">Общая статистика</span>
                </div>
        `;

        if (totalLikes > 0) status += `
            <div style="margin: 8px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px;">👍</span>
                <span style="flex: 1; color: #ff9999;">Лайков:</span>
                <span style="
                    font-weight: 600;
                    background: linear-gradient(90deg, #ff9999, #ff6666);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                ">${totalLikes}</span>
            </div>`;
        if (totalFriends > 0) status += `
            <div style="margin: 8px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px;">👥</span>
                <span style="flex: 1; color: #98ffb3;">Друзей:</span>
                <span style="
                    font-weight: 600;
                    background: linear-gradient(90deg, #98ffb3, #66ff8c);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                ">${totalFriends}</span>
            </div>`;
        if (visitedProfilesCount > 0) status += `
            <div style="margin: 8px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px;">👤</span>
                <span style="flex: 1; color: #99d6ff;">Профилей:</span>
                <span style="
                    font-weight: 600;
                    background: linear-gradient(90deg, #99d6ff, #66b3ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                ">${visitedProfilesCount}</span>
            </div>`;

        status += `
            <div style="margin: 8px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px;">⏱️</span>
                <span style="flex: 1; color: #ffd699;">Сэкономлено:</span>
                <span style="
                    font-weight: 600;
                    background: linear-gradient(90deg, #ffd699, #ffb366);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                ">${formatSavedTime(totalTime)}</span>
            </div>
        </div>`;

        // Управление
        status += `
            <div style="
                margin-top: 15px;
                background: rgba(142,68,173,0.2);
                border-radius: 12px;
                padding: 15px;
            ">
                <div style="
                    font-weight: 600;
                    margin-bottom: 12px;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span style="font-size: 16px;">🎮</span>
                    <span style="
                        background: linear-gradient(90deg, #fff, #a587bd);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    ">Управление</span>
                </div>
                <div style="
                    color: #fff;
                    font-size: 13px;
                    margin: 8px 0;
                    padding: 6px 10px;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.05);
                    background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05));
                ">
                    🖱️ Левый клик - открыть страницы
                </div>
                <div style="
                    color: #fff;
                    font-size: 13px;
                    margin: 8px 0;
                    padding: 6px 10px;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.05);
                    background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05));
                ">
                    ⇧ + 🖱️ Левый клик - вкл/откл бота
                </div>
                <div style="
                    color: #fff;
                    font-size: 13px;
                    margin: 8px 0;
                    padding: 6px 10px;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.05);
                    background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05));
                ">
                    🖱️ Правый клик - сброс статистики
                </div>
            </div>
        </div>`;

        return status;
    }

    // Функция для проверки, открыта ли страница в браузере
    function checkTabsAndUpdateStatus() {
        const pages = [
            'https://www.livelib.ru/reviews',
            'https://www.livelib.ru/quotes',
            'https://www.livelib.ru/stories',
            'https://www.livelib.ru/lifehacks',
            'https://www.livelib.ru/challenge/2025/info'
        ];

        // Очищаем текущий статус
        openedPages.clear();

        // Проверяем каждую страницу
        pages.forEach(pageUrl => {
            // Отправляем сообщение всем вкладкам
            window.postMessage({
                type: 'CHECK_TAB',
                url: pageUrl
            }, '*');
        });

        // Обновляем tooltip
        const tooltip = document.querySelector('#pageStatusTooltip');
        if (tooltip) {
            tooltip.innerHTML = getPageStatus();
        }
    }

    // Слушаем сообщения от других вкладок
    window.addEventListener('message', function(event) {
        if (event.data.type === 'CHECK_TAB') {
            // Если это наша вкладка, отвечаем
            if (window.location.href === event.data.url) {
                openedPages.add(event.data.url);
                const tooltip = document.querySelector('#pageStatusTooltip');
                if (tooltip) {
                    tooltip.innerHTML = getPageStatus();
                }
            }
        }
    });

    // Добавляем периодическую проверку статуса вкладок
    setInterval(checkTabsAndUpdateStatus, 5000); // Проверяем каждые 5 секунд

    // Слушаем изменения в localStorage
    window.addEventListener('storage', (e) => {
        if (e.key === 'openedPages') {
            loadOpenedPages();
            const tooltip = document.querySelector('#pageStatusTooltip');
            if (tooltip) {
                tooltip.innerHTML = getPageStatus();
            }
        }
    });

    // Обновляем обработчик закрытия вкладки
    window.addEventListener('beforeunload', () => {
        // Если это одна из отслеживаемых страниц, удаляем её из списка
        if (openedPages.has(window.location.href)) {
            openedPages.delete(window.location.href);
            saveOpenedPages();
        }
    });

    // Проверяем при загрузке страницы, является ли она одной из отслеживаемых
    window.addEventListener('load', () => {
        const currentUrl = window.location.href;
        if (currentUrl.match(/\/(reviews|quotes|stories|lifehacks|challenge\/2025\/info)$/)) {
            openedPages.add(currentUrl);
            saveOpenedPages();
        }
    });

    // Добавляем периодическое обновление статистики
    setInterval(updateCurrentPageStats, 30000); // Обновляем каждые 30 секунд

    // Функция для сохранения состояния открытых страниц
    function saveOpenedPages() {
        try {
            localStorage.setItem('openedPages', JSON.stringify(Array.from(openedPages)));
        } catch (e) {
            openedPages = new Set();
        }
    }

    // Функция для загрузки состояния открытых страниц
    function loadOpenedPages() {
        try {
            const saved = localStorage.getItem('openedPages');
            if (saved) {
                openedPages = new Set(JSON.parse(saved));
            }
        } catch (e) {
            openedPages = new Set();
        }
    }

    // Загружаем состояние при старте
    loadOpenedPages();

    // Обновляем функцию updateCurrentPageStats
    function updateCurrentPageStats() {
        const currentUrl = window.location.href;
        const stats = loadPageStats(currentUrl);
        const oldLikes = stats.likes || 0;
        const oldFriends = stats.friends || 0;

        // Подсчет лайков
        if (currentUrl.includes('/reviews') || currentUrl.includes('/quotes') ||
            currentUrl.includes('/stories') || currentUrl.includes('/lifehacks')) {
            const likeButtons = document.querySelectorAll('a.sab__link.icon-like.sab__link--active');
            stats.likes = likeButtons.length;
            // Считаем сэкономленное время только для новых лайков
            const newLikes = stats.likes - oldLikes;
            if (newLikes > 0) {
                stats.savedTime.likes += newLikes * stats.timeEstimates.like.total;
            }
        }

        // Подсчет друзей и времени на обработку страницы
        if (currentUrl.includes('/reader/')) {
            const subscribedButtons = document.querySelectorAll('a.btn-fill-empty.btn-wh.btn-darkgreen[title^="Удалить"]');
            if (subscribedButtons.length > 0 && oldFriends === 0) {
                stats.friends++;
                stats.savedTime.friends += stats.timeEstimates.friend.total;
            }
        }

        // Добавляем время обработки страницы при первом открытии
        if (!stats.savedTime.pages) {
            stats.savedTime.pages = stats.timeEstimates.page.total;
        }

        savePageStats(currentUrl, stats);
    }

    // Добавляем стили для анимированного заголовка
    const style = document.createElement('style');
    style.textContent = `
        @keyframes scanline {
            0% {
                transform: translateY(-100%);
            }
            100% {
                transform: translateY(100%);
            }
        }

        @keyframes flicker {
            0% { opacity: 0.8; }
            5% { opacity: 0.85; }
            10% { opacity: 0.9; }
            15% { opacity: 0.85; }
            20% { opacity: 0.95; }
            25% { opacity: 0.85; }
            30% { opacity: 0.9; }
            35% { opacity: 0.95; }
            40% { opacity: 0.85; }
            45% { opacity: 0.9; }
            50% { opacity: 0.95; }
            55% { opacity: 0.85; }
            60% { opacity: 0.9; }
            65% { opacity: 0.9; }
            70% { opacity: 0.85; }
            75% { opacity: 0.95; }
            80% { opacity: 0.85; }
            85% { opacity: 0.9; }
            90% { opacity: 0.95; }
            95% { opacity: 0.85; }
            100% { opacity: 0.9; }
        }

        @keyframes glitch {
            0% {
                clip-path: polygon(0 2%, 100% 2%, 100% 5%, 0 5%);
                transform: translate(-10px);
                text-shadow: -2px 0 #00ff00, 2px 2px #ff0000;
            }
            2% {
                clip-path: polygon(0 15%, 100% 15%, 100% 15%, 0 15%);
                transform: translate(10px);
                text-shadow: 2px -2px #00ff00, -2px 2px #ff0000;
            }
            4% {
                clip-path: polygon(0 10%, 100% 10%, 100% 20%, 0 20%);
                transform: translate(-10px);
                text-shadow: 2px 0 #ff0000, -2px -2px #00ff00;
            }
            6% {
                clip-path: polygon(0 1%, 100% 1%, 100% 2%, 0 2%);
                transform: translate(10px);
                text-shadow: -2px 0 #00ff00, 2px 2px #0000ff;
            }
            8% {
                clip-path: polygon(0 33%, 100% 33%, 100% 33%, 0 33%);
                transform: translate(-10px);
            }
            10% {
                clip-path: polygon(0 44%, 100% 44%, 100% 44%, 0 44%);
                transform: translate(10px);
            }
            12% {
                clip-path: polygon(0 50%, 100% 50%, 100% 20%, 0 20%);
                transform: translate(-10px);
            }
            14% {
                clip-path: polygon(0 70%, 100% 70%, 100% 70%, 0 70%);
                transform: translate(10px);
            }
            16% {
                clip-path: polygon(0 80%, 100% 80%, 100% 80%, 0 80%);
                transform: translate(-10px);
            }
            18% {
                clip-path: polygon(0 50%, 100% 50%, 100% 55%, 0 55%);
                transform: translate(10px);
            }
            20% {
                clip-path: polygon(0 70%, 100% 70%, 100% 80%, 0 80%);
                transform: translate(-10px);
            }
            100% {
                clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
                transform: translate(0);
                text-shadow: -2px 0 #00ff00, 2px 2px #ff0000;
            }
        }

        .libmatic-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg,
                rgba(2, 13, 25, 0.97),
                rgba(7, 25, 39, 0.98)
            );
            z-index: 999998;
            animation: fadeIn 0.5s ease-out;
            overflow: hidden;
        }

        .libmatic-overlay::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background:
                repeating-linear-gradient(
                    0deg,
                    rgba(255, 140, 0, 0.03),
                    rgba(255, 140, 0, 0.03) 1px,
                    transparent 1px,
                    transparent 2px
                );
            pointer-events: none;
            animation: scanline 12s linear infinite;
            opacity: 0.5;
        }

        .libmatic-overlay::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(
                circle at 50% 50%,
                rgba(0, 229, 255, 0.1) 0%,
                rgba(2, 13, 25, 0.7) 100%
            );
            pointer-events: none;
        }

        @keyframes holographicShift {
            0% {
                filter: hue-rotate(0deg) brightness(1);
                transform: translate(-50%, -50%) scale(1);
            }
            25% {
                filter: hue-rotate(5deg) brightness(1.2);
                transform: translate(-50%, -50%) scale(1.02);
            }
            50% {
                filter: hue-rotate(-5deg) brightness(0.9);
                transform: translate(-50%, -50%) scale(0.98);
            }
            75% {
                filter: hue-rotate(3deg) brightness(1.1);
                transform: translate(-50%, -50%) scale(1.01);
            }
            100% {
                filter: hue-rotate(0deg) brightness(1);
                transform: translate(-50%, -50%) scale(1);
            }
        }

        .libmatic-title, .devcicada-title {
            position: fixed;
            left: 50%;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 900;
            background-size: 300% 300%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            z-index: 999999;
            text-align: center;
            letter-spacing: 12px;
            text-transform: uppercase;
        }

        .libmatic-title {
            top: 40%;
            transform: translate(-50%, -50%);
            font-size: 130px;
            background: linear-gradient(
                90deg,
                #ff6b00,
                #00e5ff,
                #ff6b00
            );
            animation: glitchBg 4s ease infinite,
                       glitch 3s infinite,
                       holographicShift 8s infinite;
            text-shadow:
                0 0 40px rgba(0, 229, 255, 0.8),
                0 0 60px rgba(0, 229, 255, 0.6),
                0 0 80px rgba(0, 229, 255, 0.4),
                0 0 100px rgba(255, 107, 0, 0.4);
        }

        .devcicada-title {
            top: 60%;
            transform: translate(-50%, -50%);
            font-size: 100px;
            background: linear-gradient(
                90deg,
                #00ff88,
                #00ffee,
                #00ff88
            );
            animation: glitchBg 4s ease infinite,
                       glitch 2.5s infinite 0.5s,
                       holographicShift 8s infinite 1s;
            text-shadow:
                0 0 40px rgba(0, 255, 136, 0.8),
                0 0 60px rgba(0, 255, 136, 0.6),
                0 0 80px rgba(0, 255, 136, 0.4),
                0 0 100px rgba(0, 255, 238, 0.4);
        }

        .libmatic-title::before,
        .libmatic-title::after,
        .devcicada-title::before,
        .devcicada-title::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: inherit;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            opacity: 0.5;
        }

        .libmatic-title::before {
            left: 2px;
            text-shadow: -2px 0 #00e5ff;
            animation: glitch 2.5s infinite reverse;
        }

        .libmatic-title::after {
            left: -2px;
            text-shadow: 2px 0 #ff6b00;
            animation: glitch 3.5s infinite;
        }

        .devcicada-title::before {
            left: 2px;
            text-shadow: -2px 0 #00ff88;
            animation: glitch 3s infinite reverse 0.5s;
        }

        .devcicada-title::after {
            left: -2px;
            text-shadow: 2px 0 #00ffee;
            animation: glitch 2s infinite 0.5s;
        }

        .circuit-lines {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999997;
            opacity: 0.07;
            background:
                linear-gradient(90deg, #00e5ff 0.5px, transparent 0.5px) 0 0 / 100px 100px,
                linear-gradient(0deg, #ff6b00 0.5px, transparent 0.5px) 0 0 / 100px 100px;
            animation: circuitPulse 8s infinite;
        }

        @keyframes circuitPulse {
            0% { opacity: 0.07; }
            50% { opacity: 0.12; }
            100% { opacity: 0.07; }
        }

        @keyframes glitchBg {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
    `;
    document.head.appendChild(style);

    // Функция для создания звукового эффекта в стиле Blade Runner
    function createGlitchSound() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const masterGain = audioContext.createGain();
        // Уменьшаем общую громкость
        masterGain.gain.setValueAtTime(0.4, audioContext.currentTime);
        masterGain.connect(audioContext.destination);

        // Создаем ревербератор с более длинным хвостом
        const convolver = audioContext.createConvolver();
        const reverbGain = audioContext.createGain();
        reverbGain.gain.setValueAtTime(0.3, audioContext.currentTime);

        // Создаем длинный импульс для ревербератора в стиле Blade Runner
        const reverbLength = 4;
        const decayTime = 4;
        const sampleRate = audioContext.sampleRate;
        const impulseBuffer = audioContext.createBuffer(2, sampleRate * reverbLength, sampleRate);

        for (let channel = 0; channel < impulseBuffer.numberOfChannels; channel++) {
            const impulseData = impulseBuffer.getChannelData(channel);
            for (let i = 0; i < impulseBuffer.length; i++) {
                impulseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseBuffer.length, decayTime);
            }
        }

        convolver.buffer = impulseBuffer;
        convolver.connect(reverbGain);
        reverbGain.connect(masterGain);

        // Создаем эмуляцию CS-80 с плавным стартом
        const createCS80Voice = (frequency, detune = 0, startDelay = 0) => {
            const osc1 = audioContext.createOscillator();
            const osc2 = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.frequency.setValueAtTime(frequency, audioContext.currentTime + startDelay);
            osc2.frequency.setValueAtTime(frequency * 1.01, audioContext.currentTime + startDelay);
            osc1.detune.setValueAtTime(detune, audioContext.currentTime + startDelay);
            osc2.detune.setValueAtTime(detune - 5, audioContext.currentTime + startDelay);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(100, audioContext.currentTime + startDelay);
            filter.frequency.linearRampToValueAtTime(2000, audioContext.currentTime + startDelay + 2);
            filter.frequency.linearRampToValueAtTime(100, audioContext.currentTime + startDelay + 6);
            filter.Q.setValueAtTime(6, audioContext.currentTime + startDelay);

            gain.gain.setValueAtTime(0, audioContext.currentTime + startDelay);
            gain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + startDelay + 1);
            gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + startDelay + 4);
            gain.gain.linearRampToValueAtTime(0.001, audioContext.currentTime + startDelay + 8);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            gain.connect(convolver);

            return { osc1, osc2, gain, filter };
        };

        // Создаем основную тему Blade Runner (Love Theme) с измененными задержками
        const bladeRunnerChords = [
            [220.00, 277.18, 329.63], // Am
            [195.99, 246.94, 311.13], // G
            [174.61, 220.00, 277.18], // F
            [164.81, 207.65, 261.63]  // E
        ];

        // Создаем атмосферные пэды с плавными переходами
        const pads = bladeRunnerChords.map((chord, i) => {
            const startDelay = i * 2;
            const voices = chord.map(freq => createCS80Voice(freq, 0, startDelay));

            // Запускаем осцилляторы сразу с нулевой громкостью
            voices.forEach(v => {
                v.osc1.start(audioContext.currentTime + startDelay);
                v.osc2.start(audioContext.currentTime + startDelay);
                // Плавно останавливаем
                v.osc1.stop(audioContext.currentTime + startDelay + 8);
                v.osc2.stop(audioContext.currentTime + startDelay + 8);
            });

            return voices;
        });

        // Создаем характерный басовый пульс Blade Runner с плавным стартом
        const createBassLine = () => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(55, audioContext.currentTime);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, audioContext.currentTime);
            filter.Q.setValueAtTime(8, audioContext.currentTime);

            gain.gain.setValueAtTime(0, audioContext.currentTime);

            // Создаем более плавный пульсирующий ритм
            const pulseRate = 0.8;
            for(let i = 0; i < 10; i++) {
                const startTime = audioContext.currentTime + i * pulseRate;
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.2, startTime + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + pulseRate * 0.7);
            }

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            gain.connect(convolver);

            return { osc, gain };
        };

        // Создаем атмосферный шум с плавной модуляцией
        const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 8, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSource = audioContext.createBufferSource();
        const noiseFilter = audioContext.createBiquadFilter();
        const noiseGain = audioContext.createGain();

        noiseSource.buffer = noiseBuffer;
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(400, audioContext.currentTime);
        noiseFilter.Q.setValueAtTime(1, audioContext.currentTime);

        // Более плавная модуляция фильтра шума
        noiseFilter.frequency.linearRampToValueAtTime(1000, audioContext.currentTime + 2);
        noiseFilter.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 4);
        noiseFilter.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 6);
        noiseFilter.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 8);

        // Плавное появление и исчезновение шума
        noiseGain.gain.setValueAtTime(0, audioContext.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0.02, audioContext.currentTime + 1);
        noiseGain.gain.linearRampToValueAtTime(0.015, audioContext.currentTime + 4);
        noiseGain.gain.linearRampToValueAtTime(0.001, audioContext.currentTime + 8);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        noiseGain.connect(convolver);

        // Запускаем все источники звука
        noiseSource.start();
        const bassLine = createBassLine();
        bassLine.osc.start();

        // Плавно останавливаем все источники
        noiseSource.stop(audioContext.currentTime + 8);
        bassLine.osc.stop(audioContext.currentTime + 8);
    }

    // Функция для добавления заголовков
    function addLibmaticTitle() {
        if (window.location.href === 'https://www.livelib.ru/' ||
            window.location.href === 'https://www.livelib.ru') {

            // Создаем затемненный фон
            const overlay = document.createElement('div');
            overlay.className = 'libmatic-overlay';
            document.body.appendChild(overlay);

            // Добавляем фон с линиями схем
            const circuitLines = document.createElement('div');
            circuitLines.className = 'circuit-lines';
            document.body.appendChild(circuitLines);

            // Создаем заголовок Libmatic
            const title = document.createElement('div');
            title.className = 'libmatic-title';
            title.setAttribute('data-text', 'Libmatic');
            title.textContent = 'Libmatic';
            document.body.appendChild(title);

            // Создаем заголовок DevCicadaY
            const devTitle = document.createElement('div');
            devTitle.className = 'devcicada-title';
            devTitle.setAttribute('data-text', 'DevCicadaY');
            devTitle.textContent = 'DevCicadaY';
            document.body.appendChild(devTitle);

            // Воспроизводим звук сразу при появлении элементов
            createGlitchSound();

            // Плавное исчезновение через 8 секунд
            setTimeout(() => {
                overlay.style.animation = 'fadeIn 2s ease-out reverse';
                title.style.animation = 'fadeIn 2s ease-out reverse';
                devTitle.style.animation = 'fadeIn 2s ease-out reverse';
                circuitLines.style.animation = 'fadeIn 2s ease-out reverse';

                setTimeout(() => {
                    overlay.remove();
                    title.remove();
                    devTitle.remove();
                    circuitLines.remove();
                }, 2000);
            }, 8000);
        }
    }

    // Добавляем заголовок при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addLibmaticTitle);
    } else {
        addLibmaticTitle();
    }
})();