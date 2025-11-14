import { Bot, Keyboard } from '@maxhub/max-bot-api';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла (для локальной разработки)
dotenv.config();

const BOT_TOKEN = process.env.MAX_BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('Ошибка: MAX_BOT_TOKEN не установлен в переменных окружения!');
    console.error('Создайте файл .env или установите переменную окружения MAX_BOT_TOKEN');
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const DB_DIR = path.resolve('./db');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

ensureDatabase();

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        state TEXT NOT NULL,
        current_module_id TEXT,
        completed_modules TEXT NOT NULL,
        quiz_progress TEXT,
        last_message_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
`);

try {
    db.exec(`ALTER TABLE users ADD COLUMN last_message_id TEXT`);
} catch (error) {}

const getUserStmt = db.prepare(
    'SELECT user_id, first_name, last_name, username, state, current_module_id, completed_modules, quiz_progress, last_message_id, created_at, updated_at FROM users WHERE user_id = ?'
);
const insertUserStmt = db.prepare(
    `INSERT INTO users (user_id, first_name, last_name, username, state, current_module_id, completed_modules, quiz_progress, last_message_id, created_at, updated_at)
     VALUES (@user_id, @first_name, @last_name, @username, @state, @current_module_id, @completed_modules, @quiz_progress, @last_message_id, @created_at, @updated_at)`
);
const updateUserStmt = db.prepare(
    `UPDATE users
     SET first_name = @first_name,
         last_name = @last_name,
         username = @username,
         state = @state,
         current_module_id = @current_module_id,
         completed_modules = @completed_modules,
         quiz_progress = @quiz_progress,
         last_message_id = @last_message_id,
         updated_at = @updated_at
     WHERE user_id = @user_id`
);

const MODULE_SELECT_PREFIX = 'module_select:';
const QUIZ_ANSWER_PREFIX = 'quiz_answer:';
const START_PRACTICE_PREFIX = 'start_practice:';
const RETRY_MODULE_PREFIX = 'retry_module:';
const NEXT_QUESTION_PREFIX = 'next_question:';

const articles = [{
        title: 'Двухфакторная аутентификация',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/multi-factor-authentication',
    },
    {
        title: 'Как остановить спам-звонки',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/how-to-stop-spam-calls',
    },
    {
        title: 'Родительский контроль',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/family-guide-to-parental-controls',
    },
    {
        title: 'Замедляет ли VPN интернет',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/does-vpn-slow-down-your-internet',
    },
    {
        title: 'Как хакеры получают пароли',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/how-do-hackers-get-passwords',
    },
    {
        title: 'Проверка здоровья жёсткого диска',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/how-to-check-hard-drive-health',
    },
    {
        title: 'eSIM для путешествий',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/how-to-use-esim-for-international-travel',
    },
    {
        title: 'Безопасность умного дома',
        url: 'https://www.kaspersky.ru/resource-center/preemptive-safety/smart-home-security',
    },
    {
        title: 'Вредоносные HTML-вложения',
        url: 'https://www.kaspersky.ru/resource-center/threats/malicious-html-attachments',
    },
    {
        title: 'Что такое смишинг',
        url: 'https://www.kaspersky.ru/resource-center/threats/what-is-smishing-and-how-to-defend-against-it',
    },
    {
        title: 'Топ мошеннических схем',
        url: 'https://www.kaspersky.ru/resource-center/threats/top-scams-how-to-avoid-becoming-a-victim',
    },
    {
        title: 'Что такое PLL и как удалить',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-pll-and-how-to-remove-it',
    },
    {
        title: 'Что такое квишинг',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-quishing',
    },
    {
        title: 'Парольная фраза',
        url: 'https://www.kaspersky.ru/resource-center/definitions/passphrase',
    },
    {
        title: 'Что такое криптомайнинг',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-crypto-mining',
    },
    {
        title: 'Безопасный веб-шлюз',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-secure-web-gateway',
    },
    {
        title: 'Клонированный фишинг',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-clone-phishing',
    },
    {
        title: 'Что такое вредоносное ПО',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-malware',
    },
    {
        title: 'Что такое eSIM',
        url: 'https://www.kaspersky.ru/resource-center/definitions/what-is-an-esim',
    },
    {
        title: 'Как остановить взлом телефона',
        url: 'https://www.kaspersky.ru/resource-center/threats/how-to-stop-phone-hacking',
    },
];

const modules = [{
        id: 'module1',
        icon: '📘',
        title: 'Информационная гигиена',
        summary: 'Как защищать личные данные и не попасться на фишинг.',
        theory: [
            '🔒 <b>Информационная гигиена</b>',
            '',
            '📋 <b>Что такое персональные данные?</b>',
            'Это любая информация о тебе: имя, фамилия, адрес, телефон, фото, документы (паспорт, водительские права), номер банковской карты. Всё это нужно беречь, как ключи от дома!',
            '',
            '🔑 <b>Пароли — твоя главная защита</b>',
            '• <b>Используй разные пароли</b> для каждого сайта. Если один взломают, остальные останутся в безопасности.',
            '• <b>Никому не сообщай пароли</b>, даже если звонят и представляются «администраторами» или «службой поддержки». Настоящие специалисты никогда не просят пароли!',
            '• <b>Надёжный пароль</b> — это минимум 12 символов, включая заглавные и строчные буквы, цифры и специальные символы (!@#$%^&*).',
            '• <b>Менеджер паролей*</b> — специальная программа, которая хранит все твои пароли в зашифрованном виде. Тебе нужно запомнить только один мастер-пароль. Примеры: Bitwarden, 1Password, LastPass.',
            '',
            '🛡️ <b>Двухфакторная аутентификация (2FA)*</b>',
            'Это дополнительная защита аккаунта. Помимо пароля, нужно ввести код из SMS или приложения. Даже если кто-то узнает твой пароль, без кода он не войдёт. Включай 2FA везде, где это возможно!',
            '',
            '🎣 <b>Фишинг* — что это?</b>',
            'Это способ обмана, когда мошенники притворяются знакомыми компаниями (банк, соцсети, магазины) и просят ввести пароль или перейти по ссылке. <b>Признаки фишинга:</b>',
            '• Орфографические ошибки в письме',
            '• Срочные требования («Срочно!», «Немедленно!»)',
            '• Подозрительные ссылки (проверяй адрес сайта!)',
            '• Просьбы сообщить пароль или код из SMS',
            '',
            '💾 <b>Резервное копирование*</b>',
            'Это сохранение копий важных файлов в безопасном месте (облако, внешний диск). Если что-то случится с телефоном или компьютером, данные не потеряются. Настраивай автоматическое копирование!',
            '',
            '🔄 <b>Обновления — это важно!</b>',
            'Регулярно обновляй приложения и операционную систему. Обновления часто закрывают уязвимости* (дыры в защите), которыми могут воспользоваться злоумышленники.',
            '',
            '<i>* Термины объяснены в тексте выше</i>',
        ],
        quiz: {
            passingScore: 8,
            questions: [{
                    question: 'Что относится к персональным данным?',
                    options: [
                        'Только паспортные данные и ИНН.',
                        'Любая информация, позволяющая идентифицировать человека.',
                        'Только номер телефона и e-mail.',
                    ],
                    correctIndex: 1,
                    explanation: 'Персональные данные — любая информация, по которой можно идентифицировать человека: ФИО, контакты, фото, адрес и т.д.',
                },
                {
                    question: 'Какой из паролей самый надёжный?',
                    options: ['Qwerty2024', 'Пароль123', 'M!nD7#R4pQz1'],
                    correctIndex: 2,
                    explanation: 'Надёжный пароль длинный (12+ символов), содержит буквы разных регистров, цифры и спецсимволы.',
                },
                {
                    question: 'Как нужно поступить, если пришло подозрительное письмо от «банка»?',
                    options: [
                        'Открыть вложение и проверить, что внутри.',
                        'Перезвонить по официальному номеру банка и уточнить, отправляли ли письмо.',
                        'Ответить на письмо и попросить подробности.',
                    ],
                    correctIndex: 1,
                    explanation: 'Никогда не открывайте подозрительные вложения. Лучше самостоятельно связаться с банком через проверенный канал.',
                },
                {
                    question: 'Что делать с аккаунтом, которым вы давно не пользуетесь?',
                    options: [
                        'Оставить как есть — он не опасен.',
                        'Регулярно менять пароль, даже если не используешь.',
                        'Удалить или деактивировать, чтобы снизить риск утечки данных.',
                    ],
                    correctIndex: 2,
                    explanation: 'Неиспользуемые аккаунты — лишняя точка входа для злоумышленников. Лучше удалять их или деактивировать.',
                },
                {
                    question: 'Какую дополнительную меру защиты стоит включить, помимо пароля?',
                    options: [
                        'Отправка пароля друзьям на случай взлома.',
                        'Двухфакторную аутентификацию (2FA).',
                        'Запись пароля на стикере рядом с компьютером.',
                    ],
                    correctIndex: 1,
                    explanation: '2FA значительно усложняет жизнь злоумышленникам, требуя дополнительное подтверждение входа.',
                },
                {
                    question: 'Что является признаком фишинга?',
                    options: [
                        'Сообщение содержит орфографические ошибки и срочные требования.',
                        'Письмо пришло с корпоративного адреса компании.',
                        'В сообщении нет ссылок или вложений.',
                    ],
                    correctIndex: 0,
                    explanation: 'Фишинговые письма часто содержат ошибки и призывы к срочным действиям, чтобы человек действовал без раздумий.',
                },
                {
                    question: 'Как безопасно хранить пароли?',
                    options: [
                        'В текстовом файле на рабочем столе.',
                        'Использовать менеджер паролей с мастер-паролем.',
                        'Запоминать все пароли наизусть, чтобы никто не узнал.',
                    ],
                    correctIndex: 1,
                    explanation: 'Менеджеры паролей помогают хранить длинные уникальные пароли и защищают их мастер-паролем.',
                },
                {
                    question: 'Как поступить с приложением, которое запрашивает слишком много разрешений?',
                    options: [
                        'Всё равно установить — разработчикам виднее.',
                        'Установить, но отключить оповещения.',
                        'Не устанавливать и поискать альтернативу с меньшими запросами.',
                    ],
                    correctIndex: 2,
                    explanation: 'Избыточные разрешения могут привести к утечке данных. Лучше выбрать безопасную альтернативу.',
                },
                {
                    question: 'Что делать, если в соцсетях прислали подозрительную ссылку от знакомого?',
                    options: [
                        'Сразу открыть — знакомому можно доверять.',
                        'Уточнить у знакомого другими каналами, отправлял ли он сообщение.',
                        'Перенаправить ссылку друзьям для проверки.',
                    ],
                    correctIndex: 1,
                    explanation: 'Аккаунт знакомого могли взломать. Всегда уточняйте по другому каналу, прежде чем переходить по ссылке.',
                },
                {
                    question: 'Какой способ авторизации предпочтительнее на новом сайте?',
                    options: [
                        'Через случайный сторонний сервис, чтобы было быстрее.',
                        'Через проверенный аккаунт с включённой 2FA.',
                        'Всегда через гостевой доступ без регистрации.',
                    ],
                    correctIndex: 1,
                    explanation: 'Авторизация через проверенный сервис с 2FA безопаснее, чем использование непонятных сторонних сервисов.',
                },
            ],
        },
    },
    {
        id: 'module2',
        icon: '🛡️',
        title: 'Безопасность в интернете',
        summary: 'Защита аккаунтов и распознавание мошенников.',
        theory: [
            '🛡️ <b>Безопасность в интернете</b>',
            '',
            '🔐 <b>Защита аккаунтов</b>',
            '• <b>Двухфакторная аутентификация (2FA)*</b> — обязательна для важных сервисов (банк, почта, соцсети). Даже если кто-то узнает пароль, без кода из SMS или приложения он не войдёт.',
            '• <b>Уникальные пароли</b> для каждого сервиса. Используй менеджер паролей* для хранения.',
            '• <b>Разделяй пароли</b> для рабочих и личных аккаунтов. Если взломают рабочий, личные останутся в безопасности.',
            '• <b>Проверяй активные сессии*</b> — регулярно смотри, какие устройства подключены к твоим аккаунтам. Незнакомые устройства — признак взлома!',
            '',
            '🌐 <b>Безопасный сёрфинг</b>',
            '• <b>Проверяй адрес сайта</b> перед вводом данных. Фишинговые сайты* часто маскируются: вместо "bank.ru" может быть "bankk.ru" или "bank-secure.ru".',
            '• <b>Сертификат SSL/TLS*</b> — смотри на замок 🔒 в адресной строке. Если его нет или он красный — не вводи данные!',
            '• <b>Не переходи по подозрительным ссылкам</b> даже от знакомых. Их аккаунты могли взломать, и мошенники рассылают вредоносные ссылки от их имени.',
            '• <b>Проверяй отправителя</b> — если письмо выглядит странно, уточни у знакомого другим способом (позвони, напиши в другом мессенджере).',
            '',
            '📱 <b>Безопасность устройств</b>',
            '• <b>Обновляй операционную систему</b> и приложения. Обновления закрывают уязвимости*, которыми пользуются злоумышленники.',
            '• <b>Публичный Wi‑Fi*</b> — опасен! Не заходи в важные аккаунты (банк, почта) через публичные сети. Если нужно — используй VPN* (виртуальная частная сеть).',
            '• <b>Установка приложений</b> — скачивай только из официальных магазинов (App Store, Google Play). Сторонние источники могут содержать вредоносное ПО*.',
            '',
            '🔒 <b>Защита данных</b>',
            '• <b>Шифрование*</b> — используй для важных файлов. Зашифрованные данные нельзя прочитать без пароля.',
            '• <b>Резервное копирование*</b> — сохраняй важные данные в облаке или на внешнем диске. Если устройство сломается, данные не потеряются.',
            '• <b>Удалённое управление</b> — настрой функцию «Найти устройство» на телефоне и компьютере. Если потеряешь — сможешь заблокировать и стереть данные.',
            '',
            '<i>* Термины объяснены в тексте выше</i>',
        ],
        quiz: {
            passingScore: 8,
            questions: [{
                    question: 'Какой признак говорит, что сайт может быть поддельным?',
                    options: [
                        'Адрес начинается с https:// и есть замок.',
                        'Название почти совпадает, но есть лишняя буква или символ.',
                        'На сайте есть раздел «Контакты».',
                    ],
                    correctIndex: 1,
                    explanation: 'Фишинговые сайты часто маскируются под настоящие, добавляя лишние символы или изменяя буквы.',
                },
                {
                    question: 'Что делать, если обнаружена подозрительная активность в аккаунте?',
                    options: [
                        'Игнорировать, если доступ пока не потерян.',
                        'Немедленно сменить пароль и выйти из всех устройств.',
                        'Написать об этом в соцсетях.',
                    ],
                    correctIndex: 1,
                    explanation: 'Смена пароля и завершение всех сессий помогут остановить злоумышленника и защитить аккаунт.',
                },
                {
                    question: 'Почему опасно использовать один и тот же пароль для разных сервисов?',
                    options: [
                        'Пароль легко забыть.',
                        'Если один сервис взломают, злоумышленник получит доступ ко всем остальным.',
                        'Так сложнее вводить пароль на телефоне.',
                    ],
                    correctIndex: 1,
                    explanation: 'Утечка в одном сервисе позволяет злоумышленникам попробовать тот же пароль на других ресурсах.',
                },
                {
                    question: 'Что делать, если в соцсетях пишет «служба поддержки» и просит код из SMS?',
                    options: [
                        'Отправить код, чтобы восстановить доступ быстрее.',
                        'Не сообщать код и обратиться через официальный канал поддержки.',
                        'Прислать им скриншот SMS вместо кода.',
                    ],
                    correctIndex: 1,
                    explanation: 'Настоящая поддержка никогда не запрашивает коды из SMS. Обращайтесь только по официальным каналам.',
                },
                {
                    question: 'Какой безопасный способ подключаться к публичному Wi‑Fi?',
                    options: [
                        'Использовать VPN и не заходить в важные аккаунты без необходимости.',
                        'Сразу вводить логины и пароли — сеть всё равно безопасна.',
                        'Отключить антивирус, чтобы не мешал соединению.',
                    ],
                    correctIndex: 0,
                    explanation: 'VPN шифрует трафик и снижает риск, но лучше избегать входов в важные сервисы в публичных сетях.',
                },
                {
                    question: 'Зачем нужно обновлять приложения и браузер?',
                    options: [
                        'Чтобы дизайн не устаревал.',
                        'Обновления закрывают уязвимости и повышают безопасность.',
                        'Без обновлений реклама хуже работает.',
                    ],
                    correctIndex: 1,
                    explanation: 'Обновления часто содержат исправления критических уязвимостей, которыми пользуются злоумышленники.',
                },
                {
                    question: 'Что такое «социальная инженерия»?',
                    options: [
                        'Метод обмана людей для получения доступа к информации.',
                        'Способ защиты личных данных.',
                        'Разработка удобного интерфейса сайта.',
                    ],
                    correctIndex: 0,
                    explanation: 'Социальная инженерия — это манипулирование людьми, чтобы они сами раскрыли конфиденциальные данные.',
                },
                {
                    question: 'Как безопасно передать важный документ коллеге?',
                    options: [
                        'Отправить в общий чат без шифрования.',
                        'Использовать зашифрованный архив с паролем, сообщив пароль по другому каналу.',
                        'Прикрепить к открытому посту и дать ссылку.',
                    ],
                    correctIndex: 1,
                    explanation: 'Зашифрованный архив с паролем и передача пароля другим способом повышают безопасность.',
                },
                {
                    question: 'Какая настройка браузера полезна для безопасности?',
                    options: [
                        'Отключить предупреждения о небезопасных сайтах.',
                        'Включить блокировку всплывающих окон и проверку ссылок.',
                        'Всегда запоминать пароли автоматически в браузере.',
                    ],
                    correctIndex: 1,
                    explanation: 'Блокировка всплывающих окон и проверка ссылок помогают избежать вредоносного контента.',
                },
                {
                    question: 'Что делать, если устройство потеряно или украдено?',
                    options: [
                        'Ничего, всё равно устройство застраховано.',
                        'Удалённо выйти из аккаунтов, сменить пароли и, если возможно, стереть данные.',
                        'Купить новое устройство и не волноваться.',
                    ],
                    correctIndex: 1,
                    explanation: 'Нужно немедленно защитить аккаунты и данные, удалённо стереть информацию при возможности.',
                },
            ],
        },
    },
    {
        id: 'module3',
        icon: '💳',
        title: 'Финансовая безопасность',
        summary: 'Безопасные платежи и признаки поддельных сайтов.',
        theory: [
            '💳 <b>Финансовая безопасность</b>',
            '',
            '🛒 <b>Безопасные покупки в интернете</b>',
            '• <b>Проверяй домен*</b> сайта перед оплатой. Официальный магазин имеет правильный адрес (например, "ozon.ru", а не "ozon-shop.ru").',
            '• <b>Сертификат SSL*</b> — обязательно должен быть замок 🔒 в адресной строке. Без него не вводи данные карты!',
            '• <b>Защищённые способы оплаты</b> — используй официальные платёжные системы (СБП, Яндекс.Касса, PayPal). Они защищают транзакцию* и позволяют оспорить платёж при мошенничестве.',
            '• <b>Двойное подтверждение</b> — включай подтверждение операций через SMS или приложение банка. Это защитит от несанкционированных платежей.',
            '',
            '🚫 <b>Признаки мошенничества</b>',
            '• <b>Фальшивые магазины</b> — слишком низкие цены (в 2-3 раза дешевле обычного), единственный способ оплаты — перевод физлицу, нет контактов или они не работают.',
            '• <b>Поддельные сайты банков</b> — просят ввести CVV-код*, PIN-код или коды из SMS. Настоящий банк этого никогда не делает!',
            '• <b>Подозрительные звонки</b> — «сотрудники банка» звонят и просят назвать данные карты. Это мошенники! Банк никогда не звонит с такими просьбами.',
            '• <b>Срочные требования</b> — «Срочно переведи деньги!», «Акция заканчивается через 5 минут!». Это приём мошенников, чтобы ты действовал без раздумий.',
            '',
            '💸 <b>Защита банковской карты</b>',
            '• <b>CVV/CVC-код*</b> — это 3 цифры на обратной стороне карты. Никому не сообщай их! Даже «сотрудникам банка» или «службе поддержки».',
            '• <b>Коды из SMS</b> — одноразовые коды для подтверждения операций. Никогда не сообщай их никому, даже если звонят и представляются банком.',
            '• <b>Уведомления банка</b> — подключи SMS или push-уведомления о всех операциях. Так ты сразу узнаешь о подозрительных списаниях.',
            '• <b>Лимиты на карте</b> — установи дневной лимит на снятие и переводы. Даже если карту скомпрометируют*, ущерб будет ограничен.',
            '',
            '📊 <b>Контроль финансов</b>',
            '• <b>Регулярно проверяй</b> выписки по карте и счёту. Если видишь подозрительные операции — сразу блокируй карту и звони в банк.',
            '• <b>Виртуальная карта*</b> — создай отдельную карту для онлайн-покупок с ограниченной суммой. Если данные утекут, основной счёт останется в безопасности.',
            '• <b>Не переводи деньги</b> на карты незнакомых людей, даже если обещают «быстрый заработок» или «инвестиции». Это мошенничество!',
            '',
            '🎁 <b>Благотворительность и сборы</b>',
            '• <b>Проверяй реквизиты</b> — перед переводом денег на благотворительность убедись, что реквизиты ведут на официальный счёт фонда.',
            '• <b>Официальные документы</b> — настоящие фонды имеют документы, регистрацию, публикуют отчёты. Проверь это перед переводом.',
            '• <b>Не доверяй репостам</b> — даже если знакомые репостнули сбор, проверь его самостоятельно. Аккаунты могут быть взломаны.',
            '',
            '<i>* Термины объяснены в тексте выше</i>',
        ],
        quiz: {
            passingScore: 8,
            questions: [{
                    question: 'Какой способ оплаты в интернет-магазине безопаснее всего?',
                    options: [
                        'Перевод на карту физлица по номеру телефона.',
                        'Оплата через официальный эквайринг или защищённый платёжный сервис.',
                        'Отправка наличных курьером.',
                    ],
                    correctIndex: 1,
                    explanation: 'Официальные платёжные системы защищают транзакцию и позволяют оспорить её при мошенничестве.',
                },
                {
                    question: 'Что делать, если банк просит назвать CVV-код карты по телефону?',
                    options: [
                        'Назвать, если звонит «сотрудник безопасности».',
                        'Немедленно завершить разговор и перезвонить по официальному номеру.',
                        'Отправить код в SMS для истории.',
                    ],
                    correctIndex: 1,
                    explanation: 'Сотрудники банка никогда не спрашивают CVV. Это явный признак мошенничества.',
                },
                {
                    question: 'Какие признаки у фальшивого интернет-магазина?',
                    options: [
                        'Подробное описание товаров и отзывы.',
                        'Контакты совпадают с данными официальных реестров.',
                        'Слишком низкие цены и единственный способ оплаты — перевод физлицу.',
                    ],
                    correctIndex: 2,
                    explanation: 'Нереально низкая цена и требования перевести деньги физлицу — типичный признак мошеннического магазина.',
                },
                {
                    question: 'Почему важно подключить уведомления о списаниях средств?',
                    options: [
                        'Чтобы видеть рекламу новых услуг.',
                        'Чтобы быстро заметить подозрительные операции и заблокировать карту.',
                        'Чтобы поделиться новостями с друзьями.',
                    ],
                    correctIndex: 1,
                    explanation: 'Мгновенные уведомления позволяют оперативно отреагировать и остановить мошенников.',
                },
                {
                    question: 'Как проверить надёжность благотворительного сбора в интернете?',
                    options: [
                        'Перевести небольшую сумму и посмотреть, что будет.',
                        'Убедиться, что реквизиты ведут на официальный счёт фонда, а история фонда подтверждается.',
                        'Довериться знакомым, которые репостнули сбор.',
                    ],
                    correctIndex: 1,
                    explanation: 'Всегда проверяйте реквизиты, официальные документы и отзывы о фонде, прежде чем переводить деньги.',
                },
                {
                    question: 'Что делать при подозрении на списание средств без согласия?',
                    options: [
                        'Подождать пару дней — возможно, операция отменится.',
                        'Сразу заблокировать карту и позвонить в банк.',
                        'Написать пост в соцсетях с просьбой помочь.',
                    ],
                    correctIndex: 1,
                    explanation: 'Нужно немедленно блокировать карту и связываться с банком, чтобы оспорить операцию.',
                },
                {
                    question: 'Зачем нужен виртуальный счёт или отдельная карта для онлайн-покупок?',
                    options: [
                        'Чтобы копить бонусы от магазинов.',
                        'Чтобы ограничить сумму и снизить риск, если данные утекут.',
                        'Чтобы платить анонимно.',
                    ],
                    correctIndex: 1,
                    explanation: 'Отдельный счёт ограничивает возможный ущерб при компрометации платёжных данных.',
                },
                {
                    question: 'Как поступить, если инвестор в мессенджере обещает быстрый заработок без рисков?',
                    options: [
                        'Вложить деньги — вдруг повезёт.',
                        'Игнорировать и заблокировать контакт.',
                        'Отправить свои данные для оформления договора.',
                    ],
                    correctIndex: 1,
                    explanation: 'Обещание «быстрых денег без рисков» — типичная схема мошенников. Не вступайте в разговор.',
                },
                {
                    question: 'Какая информация из банковской карты никогда не передаётся третьим лицам?',
                    options: [
                        'Номер карты и срок действия.',
                        'Имя владельца карты.',
                        'CVV/CVC код и одноразовые коды из SMS.',
                    ],
                    correctIndex: 2,
                    explanation: 'CVV и коды из SMS используются для подтверждения операций. Их нельзя сообщать никому.',
                },
                {
                    question: 'Что делать, если интернет-магазин просит установить «приложение для оплаты»?',
                    options: [
                        'Установить, чтобы ускорить оплату.',
                        'Отказаться и совершить оплату только через официальный сайт или банковское приложение.',
                        'Установить, но удалить после оплаты.',
                    ],
                    correctIndex: 1,
                    explanation: 'Настоящие магазины не заставляют устанавливать сторонние приложения. Это может быть вредоносное ПО.',
                },
            ],
        },
    },
];

bot.api.setMyCommands([
    { name: 'start', description: 'Начать обучение' },
    { name: 'help', description: 'Список команд и возможностей' },
    { name: 'modules', description: 'Выбрать модуль обучения' },
    { name: 'progress', description: 'Показать прогресс' },
    { name: 'articles', description: 'Полезные статьи по безопасности' },
    { name: 'generate_password', description: 'Сгенерировать безопасный пароль' },
    { name: 'restart', description: 'Сбросить прогресс' },
]);

bot.command('start', async(ctx) => {
    const userData = ensureUser(ctx);

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        const module = getModuleById(userData.quizProgress.moduleId);
        if (module) {
            await ctx.reply('Ты уже проходишь практику. Ответь на текущий вопрос с помощью кнопок ниже.');
            await sendQuizQuestion(ctx, module, userData);
            return;
        }
    }

    const lockedModule = getLockedModule(userData);
    if (lockedModule) {
        await ctx.reply('Сначала завершите текущий модуль, чтобы двигаться дальше.', {
            attachments: [buildRetryKeyboard(lockedModule)],
        });
        return;
    }

    resetUserState(userData);
    await sendWelcome(ctx, userData);
});

bot.command('help', async(ctx) => {
    const userData = ensureUser(ctx);
    await ctx.reply(
        '**Команды бота:**\n' +
        '• /start — приветствие и главное меню\n' +
        '• /modules — выбрать модуль\n' +
        '• /progress — посмотреть прогресс\n' +
        '• /articles — полезные статьи по безопасности\n' +
        '• /generate_password — сгенерировать безопасный пароль\n' +
        '• /restart — начать заново\n\n' +
        '_Используй кнопки ниже, чтобы учиться интерактивно!_', { format: 'markdown', attachments: [buildMainMenuKeyboard(userData)] }
    );
});

bot.command('modules', async(ctx) => {
    const userData = ensureUser(ctx);

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        const module = getModuleById(userData.quizProgress.moduleId);
        if (module) {
            await ctx.reply('Сначала заверши практику: выбери вариант ответа на текущий вопрос.');
            await sendQuizQuestion(ctx, module, userData);
        }
        return;
    }

    const lockedModule = getLockedModule(userData);
    if (!lockedModule) {
        resetUserState(userData);
    }

    await sendModuleMenu(ctx, userData, 'Выбери модуль обучения:');
});

bot.command('progress', async(ctx) => {
    const userData = ensureUser(ctx);
    await sendProgress(ctx, userData);
});

bot.command('restart', async(ctx) => {
    const userData = ensureUser(ctx);
    resetProgress(userData);
    await ctx.reply('🔁 Прогресс сброшен. Готов учиться с нуля!', {
        attachments: [buildMainMenuKeyboard(userData)],
    });
});

bot.command('articles', async(ctx) => {
    const userData = ensureUser(ctx);
    await sendArticlesMenu(ctx, userData);
});

bot.command('generate_password', async(ctx) => {
    const userData = ensureUser(ctx);
    const length = 16;
    const password = generateSecurePassword(length);

    await ctx.reply(
        '🔐 <b>Безопасный пароль сгенерирован!</b>\n\n' +
        `<code>${password}</code>\n\n` +
        '📋 <b>Характеристики:</b>\n' +
        `• Длина: ${length} символов\n` +
        '• Содержит заглавные и строчные буквы\n' +
        '• Содержит цифры\n' +
        '• Содержит специальные символы\n\n' +
        '⚠️ <b>Важно:</b> Скопируй пароль и сохрани его в безопасном месте (менеджер паролей). После использования удали это сообщение!', {
            format: 'html',
            attachments: [buildPasswordToolsKeyboard()],
        }
    );
});

bot.action(/module_select:.+/, async(ctx) => {
    const userData = ensureUser(ctx);
    const payload = getCallbackPayload(ctx);
    const moduleId = payload.replace(MODULE_SELECT_PREFIX, '');
    const module = getModuleById(moduleId);

    if (!module) {
        await ctx.reply('Не удалось найти модуль. Попробуй выбрать его заново.');
        return;
    }

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        if (userData.quizProgress.moduleId === module.id) {
            await ctx.reply('Ты уже проходишь практику этого модуля. Ответь на текущий вопрос.');
            await sendQuizQuestion(ctx, module, userData);
        } else {
            const activeModule = getModuleById(userData.quizProgress.moduleId);
            await ctx.reply(
                `Сначала завершай практику модуля "${activeModule ? activeModule.title : 'текущий'}".`,
                activeModule ? { attachments: [buildRetryKeyboard(activeModule)] } : undefined
            );
        }
        return;
    }

    const lockedModule = getLockedModule(userData);
    if (lockedModule && lockedModule.id !== module.id) {
        await ctx.reply(
            `Сначала набери проходной балл в модуле "${lockedModule.title}".`, { attachments: [buildRetryKeyboard(lockedModule)] }
        );
        return;
    }

    await startModuleTheory(ctx, module, userData);
});

bot.action(/start_practice:.+/, async(ctx) => {
    const userData = ensureUser(ctx);
    const payload = getCallbackPayload(ctx);
    const moduleId = payload.replace(START_PRACTICE_PREFIX, '');
    const module = getModuleById(moduleId);

    if (!module) {
        await ctx.reply('Не удалось найти модуль. Попробуй выбрать его снова через /modules.');
        return;
    }

    if (userData.state === 'in_quiz' && userData.quizProgress && userData.quizProgress.moduleId === module.id) {
        await sendQuizQuestion(ctx, module, userData);
        return;
    }

    const lockedModule = getLockedModule(userData);
    if (lockedModule && lockedModule.id !== module.id) {
        await ctx.reply(
            `Сначала заверши модуль "${lockedModule.title}", чтобы двигаться дальше.`, { attachments: [buildRetryKeyboard(lockedModule)] }
        );
        return;
    }

    await startModuleQuiz(ctx, module, userData);
});

bot.action(/retry_module:.+/, async(ctx) => {
    const userData = ensureUser(ctx);
    const payload = getCallbackPayload(ctx);
    const moduleId = payload.replace(RETRY_MODULE_PREFIX, '');
    const module = getModuleById(moduleId);

    if (!module) {
        await ctx.reply('Не удалось найти модуль. Попробуй выбрать его через /modules.');
        return;
    }

    await startModuleTheory(ctx, module, userData);
});

bot.action(/quiz_answer:.+/, async(ctx) => {
    const userData = ensureUser(ctx);
    const payload = getCallbackPayload(ctx);
    const [, moduleId, questionIndexRaw, answerIndexRaw] = payload.split(':');
    const module = getModuleById(moduleId);

    if (!module) {
        resetUserState(userData);
        await ctx.reply('Кажется, произошёл сбой. Попробуй начать модуль заново через /modules.');
        return;
    }

    const progress = userData.quizProgress;
    if (!progress || userData.state !== 'in_quiz' || progress.moduleId !== module.id) {
        await ctx.reply('Этот вопрос больше не активен. Используй актуальные кнопки под последним сообщением.');
        return;
    }

    const questionIndex = Number(questionIndexRaw);
    const answerIndex = Number(answerIndexRaw);

    if (Number.isNaN(questionIndex) || Number.isNaN(answerIndex)) {
        await ctx.reply('Не удалось обработать ответ. Попробуй выбрать вариант снова.');
        return;
    }

    if (questionIndex !== progress.questionIndex) {
        await ctx.reply('Этот вопрос уже пройден. Жди следующий и выбирай ответ из актуальных кнопок.');
        return;
    }

    const question = module.quiz.questions[questionIndex];
    if (!question) {
        await finalizeQuiz(ctx, module, userData);
        return;
    }

    const isCorrect = answerIndex === question.correctIndex;

    if (isCorrect) {
        progress.correctCount += 1;
    } else {
        progress.wrongAnswers.push({ questionIndex, selectedIndex: answerIndex });
    }

    progress.answers.push({ questionIndex, answerIndex, isCorrect });

    const feedbackText = isCorrect ?
        `✅ Верно! Отличная работа 💪` :
        `❌ Неверно. Правильный ответ — ${question.options[question.correctIndex]}.\n💡 ${question.explanation}`;

    const currentQuestionText = formatQuizQuestion(module, questionIndex);
    const updatedText = `${currentQuestionText}\n\n${feedbackText}`;

    progress.questionIndex += 1;
    saveUser(userData);

    const nextKeyboard = buildNextQuestionKeyboard(module, progress.questionIndex);

    try {
        if (userData.lastMessageId) {
            if (ctx.editMessage) {
                await ctx.editMessage({
                    text: updatedText,
                    format: 'markdown',
                    attachments: [nextKeyboard],
                });
            } else if (ctx.api && ctx.api.editMessage) {
                await ctx.api.editMessage(userData.lastMessageId, updatedText, {
                    format: 'markdown',
                    attachments: [nextKeyboard],
                });
            }
        }
    } catch (error) {}
});

bot.action(/next_question:.+/, async(ctx) => {
    const userData = ensureUser(ctx);
    const payload = getCallbackPayload(ctx);
    const moduleId = payload.replace(NEXT_QUESTION_PREFIX, '');
    const module = getModuleById(moduleId);

    if (!module) {
        resetUserState(userData);
        await ctx.reply('Кажется, произошёл сбой. Попробуй начать модуль заново через /modules.');
        return;
    }

    const progress = userData.quizProgress;
    if (!progress || userData.state !== 'in_quiz' || progress.moduleId !== module.id) {
        await ctx.reply('Этот вопрос больше не активен. Используй актуальные кнопки под последним сообщением.');
        return;
    }

    if (progress.questionIndex >= module.quiz.questions.length) {
        await finalizeQuiz(ctx, module, userData);
    } else {
        await sendQuizQuestion(ctx, module, userData);
    }
});

bot.action('modules_menu', async(ctx) => {
    const userData = ensureUser(ctx);

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        const module = getModuleById(userData.quizProgress.moduleId);
        if (module) {
            await ctx.reply('Сначала заверши практику: выбери вариант ответа на текущий вопрос.');
            await sendQuizQuestion(ctx, module, userData);
        }
        return;
    }

    const lockedModule = getLockedModule(userData);
    if (!lockedModule) {
        resetUserState(userData);
    }

    await sendModuleMenu(ctx, userData, 'Продолжим обучение? Выбери модуль:');
});

bot.action('show_progress', async(ctx) => {
    const userData = ensureUser(ctx);
    await sendProgress(ctx, userData, {
        textPrefix: '📊 Твой текущий прогресс:\n',
        attachments: [buildMainMenuKeyboard(userData)],
    });
});

bot.action('articles_menu', async(ctx) => {
    const userData = ensureUser(ctx);
    await sendArticlesMenu(ctx, userData);
});

bot.action('restart_learning', async(ctx) => {
    const userData = ensureUser(ctx);
    resetProgress(userData);
    await ctx.reply('🔁 Прогресс очищен. Можно начинать заново!', {
        attachments: [buildMainMenuKeyboard(userData)],
    });
});

bot.action('check_password_action', async(ctx) => {
    const userData = ensureUser(ctx);
    userData.state = 'awaiting_password_check';
    saveUser(userData);

    await ctx.reply(
        '🔍 <b>Проверка надёжности пароля</b>\n\n' +
        'Отправь пароль для проверки отдельным сообщением.\n\n' +
        '⚠️ <b>Важно:</b> После проверки удали это сообщение для безопасности!', {
            format: 'html',
            attachments: [buildPasswordToolsKeyboard()],
        }
    );
});

bot.action('generate_password_action', async(ctx) => {
    const length = 16;
    const password = generateSecurePassword(length);

    await ctx.reply(
        '🔐 <b>Безопасный пароль сгенерирован!</b>\n\n' +
        `<code>${password}</code>\n\n` +
        '📋 <b>Характеристики:</b>\n' +
        `• Длина: ${length} символов\n` +
        '• Содержит заглавные и строчные буквы\n' +
        '• Содержит цифры\n' +
        '• Содержит специальные символы\n\n' +
        '⚠️ <b>Важно:</b> Скопируй пароль и сохрани его в безопасном месте (менеджер паролей). После использования удали это сообщение!', {
            format: 'html',
            attachments: [buildPasswordToolsKeyboard()],
        }
    );
});

bot.hears('🚀 Начать обучение', async(ctx) => {
    const userData = ensureUser(ctx);

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        const module = getModuleById(userData.quizProgress.moduleId);
        if (module) {
            await ctx.reply('Сначала заверши практику: выбери вариант ответа на текущий вопрос.');
            await sendQuizQuestion(ctx, module, userData);
        }
        return;
    }

    const lockedModule = getLockedModule(userData);
    if (!lockedModule) {
        resetUserState(userData);
    }

    await sendModuleMenu(ctx, userData, 'Выбери модуль обучения:');
});

bot.hears('📊 Прогресс', async(ctx) => {
    const userData = ensureUser(ctx);
    await sendProgress(ctx, userData, {
        textPrefix: '📊 Твой текущий прогресс:\n',
        attachments: [buildMainMenuKeyboard(userData)],
    });
});

bot.hears('🔁 Сбросить прогресс', async(ctx) => {
    const userData = ensureUser(ctx);
    resetProgress(userData);
    await ctx.reply('🔁 Прогресс очищен. Можно начинать заново!', {
        attachments: [buildMainMenuKeyboard(userData)],
    });
});

bot.on('message', async(ctx) => {
    const userData = ensureUser(ctx);

    // Получаем текст сообщения из разных возможных мест
    let messageText = '';
    if (ctx.message && ctx.message.body && ctx.message.body.text) {
        messageText = ctx.message.body.text;
    } else if (ctx.update && ctx.update.message && ctx.update.message.body && ctx.update.message.body.text) {
        messageText = ctx.update.message.body.text;
    } else if (ctx.message && ctx.message.text) {
        messageText = ctx.message.text;
    }

    // Пропускаем команды
    if (messageText.startsWith('/')) {
        return;
    }

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        await ctx.reply('Сейчас мы проходим практику. Выбери вариант ответа с помощью кнопок под вопросом.');
        return;
    }

    if (userData.state === 'viewing_theory' && userData.currentModuleId) {
        await ctx.reply('Изучи теорию и нажми «🧩 Начать практику», чтобы перейти к заданиям.');
        return;
    }

    const lockedModule = getLockedModule(userData);
    if (lockedModule) {
        await ctx.reply(
            `Сначала завершите модуль "${lockedModule.title}" и наберите минимум ${lockedModule.quiz.passingScore} правильных ответов.`, { attachments: [buildRetryKeyboard(lockedModule)] }
        );
        return;
    }

    await ctx.reply('Используй команды или кнопки, чтобы продолжить обучение.', {
        attachments: [buildMainMenuKeyboard(userData)],
    });
});

bot.start();

function ensureUser(ctx) {
    const userId = getUserId(ctx);
    const profile = extractUserProfile(ctx);
    const existing = getUserStmt.get(userId);

    if (!existing) {
        const now = new Date().toISOString();
        const newUser = {
            userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            username: profile.username,
            state: 'awaiting_module_selection',
            currentModuleId: null,
            completedModules: [],
            quizProgress: null,
            lastMessageId: null,
        };
        insertUserStmt.run({
            user_id: newUser.userId,
            first_name: newUser.firstName || null,
            last_name: newUser.lastName || null,
            username: newUser.username || null,
            state: newUser.state,
            current_module_id: newUser.currentModuleId,
            completed_modules: JSON.stringify(newUser.completedModules),
            quiz_progress: null,
            last_message_id: null,
            created_at: now,
            updated_at: now,
        });
        return newUser;
    }

    const userData = {
        userId: existing.user_id,
        firstName: existing.first_name || '',
        lastName: existing.last_name || '',
        username: existing.username || '',
        state: existing.state,
        currentModuleId: existing.current_module_id || null,
        completedModules: parseJson(existing.completed_modules, []),
        quizProgress: existing.quiz_progress ? parseJson(existing.quiz_progress, null) : null,
        lastMessageId: existing.last_message_id || null,
    };

    let updated = false;
    if (profile.firstName && profile.firstName !== userData.firstName) {
        userData.firstName = profile.firstName;
        updated = true;
    }
    if (profile.lastName && profile.lastName !== userData.lastName) {
        userData.lastName = profile.lastName;
        updated = true;
    }
    if (profile.username && profile.username !== userData.username) {
        userData.username = profile.username;
        updated = true;
    }

    if (updated) {
        saveUser(userData);
    }

    return userData;
}

function getUserId(ctx) {
    if (!ctx) {
        throw new Error('Не удалось определить пользователя');
    }

    const candidates = [];

    if (ctx.from) {
        if (ctx.from.id !== undefined && ctx.from.id !== null) {
            candidates.push(ctx.from.id);
        }
        if (ctx.from.user_id !== undefined && ctx.from.user_id !== null) {
            candidates.push(ctx.from.user_id);
        }
    }

    if (ctx.chat) {
        if (ctx.chat.id !== undefined && ctx.chat.id !== null) {
            candidates.push(ctx.chat.id);
        }
        if (ctx.chat.chat_id !== undefined && ctx.chat.chat_id !== null) {
            candidates.push(ctx.chat.chat_id);
        }
        if (ctx.chat.user_id !== undefined && ctx.chat.user_id !== null) {
            candidates.push(ctx.chat.user_id);
        }
    }

    if (ctx.sender) {
        if (ctx.sender.id !== undefined && ctx.sender.id !== null) {
            candidates.push(ctx.sender.id);
        }
        if (ctx.sender.user_id !== undefined && ctx.sender.user_id !== null) {
            candidates.push(ctx.sender.user_id);
        }
    }

    if (ctx.message) {
        if (ctx.message.sender) {
            if (ctx.message.sender.id !== undefined && ctx.message.sender.id !== null) {
                candidates.push(ctx.message.sender.id);
            }
            if (ctx.message.sender.user_id !== undefined && ctx.message.sender.user_id !== null) {
                candidates.push(ctx.message.sender.user_id);
            }
        }
        if (ctx.message.chat) {
            if (ctx.message.chat.id !== undefined && ctx.message.chat.id !== null) {
                candidates.push(ctx.message.chat.id);
            }
            if (ctx.message.chat.chat_id !== undefined && ctx.message.chat.chat_id !== null) {
                candidates.push(ctx.message.chat.chat_id);
            }
        }
        if (ctx.message.recipient) {
            if (ctx.message.recipient.chat_id !== undefined && ctx.message.recipient.chat_id !== null) {
                candidates.push(ctx.message.recipient.chat_id);
            }
            if (ctx.message.recipient.user_id !== undefined && ctx.message.recipient.user_id !== null) {
                candidates.push(ctx.message.recipient.user_id);
            }
        }
    }

    if (ctx.update) {
        const update = ctx.update;
        if (update.sender) {
            if (update.sender.id !== undefined && update.sender.id !== null) {
                candidates.push(update.sender.id);
            }
            if (update.sender.user_id !== undefined && update.sender.user_id !== null) {
                candidates.push(update.sender.user_id);
            }
        }
        if (update.recipient) {
            if (update.recipient.chat_id !== undefined && update.recipient.chat_id !== null) {
                candidates.push(update.recipient.chat_id);
            }
            if (update.recipient.user_id !== undefined && update.recipient.user_id !== null) {
                candidates.push(update.recipient.user_id);
            }
        }
        if (update.message) {
            const updateMessage = update.message;
            if (updateMessage.sender) {
                if (updateMessage.sender.id !== undefined && updateMessage.sender.id !== null) {
                    candidates.push(updateMessage.sender.id);
                }
                if (updateMessage.sender.user_id !== undefined && updateMessage.sender.user_id !== null) {
                    candidates.push(updateMessage.sender.user_id);
                }
            }
            if (updateMessage.recipient) {
                if (
                    updateMessage.recipient.chat_id !== undefined &&
                    updateMessage.recipient.chat_id !== null
                ) {
                    candidates.push(updateMessage.recipient.chat_id);
                }
                if (
                    updateMessage.recipient.user_id !== undefined &&
                    updateMessage.recipient.user_id !== null
                ) {
                    candidates.push(updateMessage.recipient.user_id);
                }
            }
            if (updateMessage.chat) {
                if (updateMessage.chat.id !== undefined && updateMessage.chat.id !== null) {
                    candidates.push(updateMessage.chat.id);
                }
                if (updateMessage.chat.chat_id !== undefined && updateMessage.chat.chat_id !== null) {
                    candidates.push(updateMessage.chat.chat_id);
                }
            }
        }
    }

    const userId = candidates.find((value) => value !== undefined && value !== null);
    if (userId !== undefined) {
        return String(userId);
    }

    throw new Error('Не удалось определить пользователя');
}

function saveUser(userData) {
    const now = new Date().toISOString();
    updateUserStmt.run({
        user_id: userData.userId,
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
        username: userData.username || null,
        state: userData.state,
        current_module_id: userData.currentModuleId,
        completed_modules: JSON.stringify(userData.completedModules || []),
        quiz_progress: userData.quizProgress ? JSON.stringify(userData.quizProgress) : null,
        last_message_id: userData.lastMessageId || null,
        updated_at: now,
    });
}

function getModuleById(moduleId) {
    return modules.find((item) => item.id === moduleId) || null;
}

function getLockedModule(userData) {
    if (userData.state === 'awaiting_module_retry' && userData.currentModuleId) {
        return getModuleById(userData.currentModuleId);
    }
    return null;
}

function resetUserState(userData) {
    userData.state = 'awaiting_module_selection';
    userData.currentModuleId = null;
    userData.quizProgress = null;
    saveUser(userData);
}

function resetProgress(userData) {
    userData.completedModules = [];
    resetUserState(userData);
}

async function startModuleTheory(ctx, module, userData) {
    userData.currentModuleId = module.id;
    userData.state = 'viewing_theory';
    userData.quizProgress = null;
    userData.lastMessageId = null;
    saveUser(userData);

    await ctx.reply(formatTheory(module), { format: 'html' });
    await ctx.reply(
        'Когда будешь готов(а), переходи к практике.', { format: 'markdown', attachments: [buildTheoryKeyboard(module)] }
    );
}

async function startModuleQuiz(ctx, module, userData) {
    userData.state = 'in_quiz';
    userData.currentModuleId = module.id;
    userData.quizProgress = {
        moduleId: module.id,
        questionIndex: 0,
        correctCount: 0,
        answers: [],
        wrongAnswers: [],
    };
    userData.lastMessageId = null;
    saveUser(userData);

    await sendQuizQuestion(ctx, module, userData);
}

async function sendOrEditMessage(ctx, userData, text, options = {}) {
    try {
        if (userData.lastMessageId) {
            if (ctx.editMessage) {
                await ctx.editMessage({
                    text,
                    format: options.format || 'markdown',
                    attachments: options.attachments || [],
                });
            } else if (ctx.api && ctx.api.editMessage) {
                await ctx.api.editMessage(userData.lastMessageId, text, {
                    format: options.format || 'markdown',
                    attachments: options.attachments || [],
                });
            }
            return;
        }
    } catch (error) {}

    const result = await ctx.reply(text, {
        format: options.format || 'markdown',
        attachments: options.attachments || [],
    });

    if (result && result.mid) {
        userData.lastMessageId = result.mid;
        saveUser(userData);
    } else if (ctx.messageId) {
        userData.lastMessageId = ctx.messageId;
        saveUser(userData);
    }

    return result;
}

async function sendQuizQuestion(ctx, module, userData) {
    const progress = userData.quizProgress;
    if (!progress) {
        return;
    }

    const total = module.quiz.questions.length;
    if (progress.questionIndex >= total) {
        await finalizeQuiz(ctx, module, userData);
        return;
    }

    const text = formatQuizQuestion(module, progress.questionIndex);
    await sendOrEditMessage(ctx, userData, text, {
        format: 'markdown',
        attachments: [buildQuizKeyboard(module, progress.questionIndex)],
    });
}

async function finalizeQuiz(ctx, module, userData) {
    const progress = userData.quizProgress;
    if (!progress) {
        return;
    }

    const total = module.quiz.questions.length;
    const score = progress.correctCount;
    const passed = score >= module.quiz.passingScore;

    let summary =
        `🎯 Итоги модуля "${module.title}":\n` +
        `• Правильных ответов: ${score}/${total}\n` +
        `• Проходной балл: ${module.quiz.passingScore}/${total}`;

    if (passed) {
        summary += '\n\nОтличная работа! Ты можешь перейти к следующему модулю.';
    } else {
        summary += `\n\n❗ Нужно набрать минимум ${module.quiz.passingScore} правильных ответов.`;
    }

    if (progress.wrongAnswers.length > 0) {
        const mistakes = progress.wrongAnswers
            .map((item) => {
                const question = module.quiz.questions[item.questionIndex];
                const questionNumber = item.questionIndex + 1;
                const userAnswer = question.options[item.selectedIndex] || '—';
                const correctAnswer = question.options[question.correctIndex];
                return `${questionNumber}. ${question.question}\n• Твой ответ: ${userAnswer}\n• Правильно: ${correctAnswer}\n💡 ${question.explanation}`;
            })
            .join('\n\n');
        summary += `\n\nОшибки:\n${mistakes}`;
    }

    if (passed) {
        if (!userData.completedModules.includes(module.id)) {
            userData.completedModules.push(module.id);
        }
        userData.state = 'awaiting_module_selection';
        userData.currentModuleId = null;
        userData.quizProgress = null;
        saveUser(userData);

        try {
            if (userData.lastMessageId) {
                if (ctx.editMessage) {
                    await ctx.editMessage({
                        text: summary,
                        format: 'markdown',
                        attachments: [buildPostQuizKeyboard(userData, module)],
                    });
                } else if (ctx.api && ctx.api.editMessage) {
                    await ctx.api.editMessage(userData.lastMessageId, summary, {
                        format: 'markdown',
                        attachments: [buildPostQuizKeyboard(userData, module)],
                    });
                }
            } else {
                const result = await ctx.reply(summary, {
                    format: 'markdown',
                    attachments: [buildPostQuizKeyboard(userData, module)],
                });
                if (result && result.mid) {
                    userData.lastMessageId = result.mid;
                    saveUser(userData);
                }
            }
        } catch (error) {
            await ctx.reply(summary, {
                format: 'markdown',
                attachments: [buildPostQuizKeyboard(userData, module), buildMainMenuKeyboardRegular()],
            });
        }

        await sendProgress(ctx, userData, {
            textPrefix: '📊 Прогресс обновлён:\n',
            attachments: [buildMainMenuKeyboard(userData)],
        });
    } else {
        userData.state = 'awaiting_module_retry';
        userData.currentModuleId = module.id;
        userData.quizProgress = null;
        saveUser(userData);

        try {
            if (userData.lastMessageId) {
                if (ctx.editMessage) {
                    await ctx.editMessage({
                        text: summary,
                        format: 'markdown',
                        attachments: [buildRetryKeyboard(module)],
                    });
                } else if (ctx.api && ctx.api.editMessage) {
                    await ctx.api.editMessage(userData.lastMessageId, summary, {
                        format: 'markdown',
                        attachments: [buildRetryKeyboard(module)],
                    });
                }
            } else {
                const result = await ctx.reply(summary, {
                    format: 'markdown',
                    attachments: [buildRetryKeyboard(module), buildMainMenuKeyboardRegular()],
                });
                if (result && result.mid) {
                    userData.lastMessageId = result.mid;
                    saveUser(userData);
                }
            }
        } catch (error) {
            await ctx.reply(summary, {
                format: 'markdown',
                attachments: [buildRetryKeyboard(module), buildMainMenuKeyboardRegular()],
            });
        }
    }
}

async function sendWelcome(ctx, userData) {
    const lockedModule = getLockedModule(userData);
    const displayName = userData.firstName || 'друг';
    let message =
        `Привет, ${displayName}! 👋\n\n` +
        'Я — твой гид по цифровой гигиене. Помогу защитить тебя и близких в интернете.\n' +
        'Выбирай модуль, изучай теорию и закрепляй знания в практических заданиях.';

    if (lockedModule) {
        message += `\n\n⚠️ Заверши модуль "${lockedModule.title}", чтобы продолжить обучение.`;
    }

    await ctx.reply(message, {
        attachments: [buildMainMenuKeyboard(userData)],
        format: 'markdown',
    });
}

async function sendModuleMenu(ctx, userData, message) {
    const lockedModule = getLockedModule(userData);
    const list = modules
        .map((module, index) => {
            const completed = userData.completedModules.includes(module.id) ? ' ✅' : '';
            const locked = lockedModule && lockedModule.id !== module.id ? ' 🔒' : '';
            return `${index + 1}. ${module.icon} ${module.title}${completed || locked}\n_${module.summary}_`;
        })
        .join('\n\n');

    let text = `${message}\n\n${list}`;
    if (lockedModule) {
        text += `\n\n⚠️ Модуль "${lockedModule.title}" нужно завершить: набери минимум ${lockedModule.quiz.passingScore} из ${lockedModule.quiz.questions.length} правильных ответов.`;
    }

    await ctx.reply(text, {
        format: 'markdown',
        attachments: [buildModulesKeyboard(userData)],
    });
}

async function sendProgress(ctx, userData, options = {}) {
    const percent = calculateProgress(userData);
    const completedNames = userData.completedModules
        .map((moduleId) => {
            const module = getModuleById(moduleId);
            return module ? `• ${module.icon} ${module.title}` : null;
        })
        .filter(Boolean);

    const lockedModule = getLockedModule(userData);

    let body =
        `${options.textPrefix || '📊 Прогресс:\n'}` +
        `• Завершено модулей: ${userData.completedModules.length}/${modules.length}\n` +
        `• Прогресс: ${percent}%\n` +
        '• Проходной балл: 8 из 10 правильных ответов для каждого модуля\n';

    if (completedNames.length > 0) {
        body += '\nТы завершил(а):\n' + completedNames.join('\n');
    } else {
        body += '\nПройди хотя бы один модуль, чтобы увидеть подробный прогресс.';
    }

    if (lockedModule) {
        body += `\n\n⚠️ Сейчас нужно завершить модуль "${lockedModule.title}" (минимум ${lockedModule.quiz.passingScore}/${lockedModule.quiz.questions.length}).`;
    }

    const attachments = options.attachments || [];

    await ctx.reply(body, {
        format: 'markdown',
        attachments,
    });
}

function buildMainMenuKeyboard(userData) {
    const rows = [];

    if (userData.state === 'in_quiz' && userData.quizProgress) {
        rows.push([
            Keyboard.button.callback(
                '🧩 Продолжить',
                `${START_PRACTICE_PREFIX}${userData.quizProgress.moduleId}`
            ),
        ]);
    } else if (userData.state === 'awaiting_module_retry' && userData.currentModuleId) {
        rows.push([
            Keyboard.button.callback(
                '🧩 Завершить',
                `${START_PRACTICE_PREFIX}${userData.currentModuleId}`
            ),
        ]);
    }

    rows.push([
        Keyboard.button.callback('🚀 Начать обучение', 'modules_menu'),
        Keyboard.button.callback('📊 Прогресс', 'show_progress'),
    ]);
    rows.push([
        Keyboard.button.callback('📚 Статьи', 'articles_menu'),
        Keyboard.button.callback('🔐 Создать пароль', 'generate_password_action'),
    ]);
    rows.push([Keyboard.button.callback('🔁 Сбросить прогресс', 'restart_learning')]);

    return Keyboard.inlineKeyboard(rows);
}

function buildModulesKeyboard(userData) {
    const lockedModule = getLockedModule(userData);
    const buttons = modules.map((module) => {
        const completed = userData.completedModules.includes(module.id);
        const locked = lockedModule && lockedModule.id !== module.id;
        const suffix = completed ? ' ✅' : locked ? ' 🔒' : '';
        return Keyboard.button.callback(
            `${module.icon} ${module.title}${suffix}`,
            `${MODULE_SELECT_PREFIX}${module.id}`
        );
    });

    // Каждый модуль в отдельной строке
    const rows = buttons.map(button => [button]);

    rows.push([
        Keyboard.button.callback('📊 Мой прогресс', 'show_progress'),
        Keyboard.button.callback('🔁 Сбросить', 'restart_learning'),
    ]);

    return Keyboard.inlineKeyboard(rows);
}

function buildTheoryKeyboard(module) {
    return Keyboard.inlineKeyboard([
        [
            Keyboard.button.callback('🧩 Начать практику', `${START_PRACTICE_PREFIX}${module.id}`),
        ],
        [
            Keyboard.button.callback('📚 Список модулей', 'modules_menu'),
            Keyboard.button.callback('📊 Прогресс', 'show_progress'),
        ],
    ]);
}

function buildQuizKeyboard(module, questionIndex) {
    const question = module.quiz.questions[questionIndex];
    if (!question) {
        return Keyboard.inlineKeyboard([]);
    }

    const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    // Все кнопки в одну строку
    const buttons = question.options.map((option, idx) =>
        Keyboard.button.callback(
            emojiNumbers[idx] || `${idx + 1}`,
            `${QUIZ_ANSWER_PREFIX}${module.id}:${questionIndex}:${idx}`
        )
    );

    return Keyboard.inlineKeyboard([buttons]);
}

function buildPostQuizKeyboard(userData, module) {
    return Keyboard.inlineKeyboard([
        [
            Keyboard.button.callback('📚 Другие модули', 'modules_menu'),
            Keyboard.button.callback('📊 Прогресс', 'show_progress'),
        ],
        [
            Keyboard.button.callback('🔁 Ещё раз', `${MODULE_SELECT_PREFIX}${module.id}`),
        ],
    ]);
}

function buildRetryKeyboard(module) {
    return Keyboard.inlineKeyboard([
        [
            Keyboard.button.callback('🔄 Практика заново', `${START_PRACTICE_PREFIX}${module.id}`),
        ],
        [
            Keyboard.button.callback('📘 Теория', `${RETRY_MODULE_PREFIX}${module.id}`),
            Keyboard.button.callback('📊 Прогресс', 'show_progress'),
        ],
    ]);
}

function buildNextQuestionKeyboard(module, nextQuestionIndex) {
    const total = module.quiz.questions.length;
    if (nextQuestionIndex >= total) {
        return Keyboard.inlineKeyboard([
            [Keyboard.button.callback('📊 Посмотреть итоги', `${NEXT_QUESTION_PREFIX}${module.id}`)],
        ]);
    }
    return Keyboard.inlineKeyboard([
        [Keyboard.button.callback('➡️ Дальше', `${NEXT_QUESTION_PREFIX}${module.id}`)],
    ]);
}

function formatTheory(module) {
    return module.theory.join('\n');
}

function formatQuizQuestion(module, questionIndex) {
    const total = module.quiz.questions.length;
    const question = module.quiz.questions[questionIndex];
    if (!question) {
        return 'Вопрос не найден.';
    }

    const options = question.options
        .map((option, idx) => `${idx + 1}. ${option}`)
        .join('\n');

    let header = `🧩 *${module.title}*`;
    if (questionIndex === 0) {
        header += `\nТебе нужно набрать минимум ${module.quiz.passingScore} из ${total} правильных ответов.`;
    }
    header += `\nВопрос ${questionIndex + 1} из ${total}`;

    return (
        `${header}\n\n${question.question}\n\n${options}\n\n` +
        '_Выбери правильный ответ с помощью кнопок ниже._'
    );
}

function calculateProgress(userData) {
    if (!modules.length) {
        return 0;
    }
    return Math.round((userData.completedModules.length / modules.length) * 100);
}

async function sendArticlesMenu(ctx, userData) {
    const text =
        '📚 <b>Полезные статьи по безопасности</b>\n\n' +
        'Здесь собраны полезные материалы от экспертов по цифровой безопасности.\n' +
        'Выбери статью, чтобы открыть её в браузере:';

    await ctx.reply(text, {
        format: 'html',
        attachments: [buildArticlesKeyboard()],
    });
}

function buildArticlesKeyboard() {
    const rows = [];

    // Каждая статья в отдельной строке
    for (let i = 0; i < articles.length; i++) {
        rows.push([
            Keyboard.button.link(articles[i].title, articles[i].url),
        ]);
    }

    // Добавляем кнопку возврата в главное меню
    rows.push([
        Keyboard.button.callback('🏠 Главное меню', 'modules_menu'),
    ]);

    return Keyboard.inlineKeyboard(rows);
}

function getCallbackPayload(ctx) {
    if (!ctx) {
        return '';
    }

    if (ctx.update && ctx.update.callback) {
        const callback = ctx.update.callback;
        if (callback.payload !== undefined && callback.payload !== null) {
            return String(callback.payload);
        }
        if (callback.data !== undefined && callback.data !== null) {
            return String(callback.data);
        }
    }

    if (ctx.callback) {
        if (ctx.callback.payload !== undefined && ctx.callback.payload !== null) {
            return String(ctx.callback.payload);
        }
        if (ctx.callback.data !== undefined && ctx.callback.data !== null) {
            return String(ctx.callback.data);
        }
    }

    if (ctx.callbackQuery && ctx.callbackQuery.data !== undefined && ctx.callbackQuery.data !== null) {
        return String(ctx.callbackQuery.data);
    }

    return '';
}

function extractUserProfile(ctx) {
    const candidates = [];
    if (ctx && ctx.update && ctx.update.message && ctx.update.message.sender) {
        candidates.push(ctx.update.message.sender);
    }
    if (ctx && ctx.update && ctx.update.callback && ctx.update.callback.user) {
        candidates.push(ctx.update.callback.user);
    }
    if (ctx && ctx.from) {
        candidates.push(ctx.from);
    }
    if (ctx && ctx.sender) {
        candidates.push(ctx.sender);
    }

    let firstName = '';
    let lastName = '';
    let username = '';

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        if (!firstName) {
            firstName = candidate.first_name || candidate.name || candidate.firstName || '';
        }
        if (!lastName) {
            lastName = candidate.last_name || candidate.lastName || '';
        }
        if (!username) {
            username = candidate.username || '';
        }
        if (firstName && username) {
            break;
        }
    }

    return { firstName, lastName, username };
}

function parseJson(value, fallback) {
    if (typeof value !== 'string') {
        return fallback;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function ensureDatabase() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
}

function generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    // Гарантируем наличие всех типов символов
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Заполняем остальное случайными символами
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Перемешиваем символы для случайного порядка
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

function buildPasswordToolsKeyboard() {
    return Keyboard.inlineKeyboard([
        [
            Keyboard.button.callback('🔐 Создать ещё', 'generate_password_action'),
        ],
        [
            Keyboard.button.callback('🏠 Главное меню', 'modules_menu'),
        ],
    ]);
}