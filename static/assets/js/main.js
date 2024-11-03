let allTables = [];  // Глобальная переменная для хранения всех столов
let allProducts = [];  // Глобальная переменная для хранения всех блюд
let currentTableNumber = null; // Глобальная переменная для сохранения текущего номера стола
let orderedItems = []; // Массив для хранения добавленных блюд
let currentProductNumber = null; // Глобальная переменная для хранения номера текущего продукта
let currentCategoryNumber = null; // Глобальная переменная для хранения номера текущей категории
let selectedOptions = new Set(); // Глобальная переменная для хранения выбранных опций
let socket; // Объявляем переменную для сокета

async function showModal(tableNumber) {
    currentTableNumber = tableNumber;
    const modal = document.getElementById('modal');
    const tableNumberElement = document.getElementById('table-number');

    // Устанавливаем номер стола в модальное окно
    tableNumberElement.innerHTML = `Table:&nbsp;${tableNumber}`;
    modal.style.display = 'flex';

    // Закрываем модальное окно при нажатии на крестик
    const closeModal = document.querySelector('#close');
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    try {
        // Получаем заказы для стола
        const response = await fetch(`/orders?table_number=${tableNumber}&status=open`);
        const orders = await response.json();
        
        const orderItemsDiv = document.getElementById("order-items");
        orderItemsDiv.innerHTML = ''; // Очищаем контейнер

        // Проверяем наличие открытых заказов
        if (orders.length === 0) {
            orderItemsDiv.textContent = 'List is empty'; // Если нет заказов, выводим сообщение
            return; // Завершаем выполнение функции
        }

        // Собираем все идентификаторы опций
        const optionIds = [];
        orders.forEach(order => {
            if (order.option_number) {
                const numbers = String(order.option_number).split(',').map(Number);
                optionIds.push(...numbers);
            }
        });

        // Запрос для получения названий опций
        const optionDetails = await fetchOptionsByIds(optionIds);

        orders.forEach(order => {
            const orderItem = document.createElement("div");
            orderItem.classList.add("order-item");
            const optionNumbers = order.option_number ? String(order.option_number).split(',') : [];
    
            // Получаем названия опций
            const optionNames = optionNumbers.map(num => optionDetails[num] || 'Нет').join(', ');
    
            orderItem.innerHTML = `
                <div class="order-btns">
                    <input type="number" value="1" min="1" class="quantity" />
                    <span class="remove-order" data-order-id="${order.id}" data-product-name="${order.product_name}">&times;</span>
                </div>
                <div class="order-container">
                    <span class="option-text">${order.product_name}</span>
                    <span class="option-text" style="width: 200px;">${optionNames || 'No option'}</span>
                    <span class="option-text">${order.option_text || 'No comment'}</span>
                </div>
            `;
    
            // Обработчик события для кнопки-крестика
            // В обработчике события для кнопки-крестика
            orderItem.querySelector('.remove-order').addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                showDeletePopup(orderId, orderItem); // Передаем orderItem для дальнейшего использования
});

    
            orderItemsDiv.appendChild(orderItem);
        });
    } catch (error) {
        console.error('Ошибка при проверке заказа:', error);
    }
}

// Пример использования функции при нажатии кнопки
document.getElementById('pop-up-prod-yes').onclick = () => {
    const orderId = document.querySelector('.remove-order').dataset.orderId; // Получаем ID заказа
    removeOrder(orderId);
};

async function removeOrder(orderId) {
    const popups = document.getElementById('pop-up-prod');
    try {
        const response = await fetch(`/remove_order/${orderId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error removing order');
        }

        const result = await response.json();
        console.log(result.message);

        // Находим элемент с классом order-item, который содержит удаляемый заказ
        const orderItem = document.querySelector(`.order-item .remove-order[data-order-id="${orderId}"]`);

        // Если элемент найден, скрываем родительский элемент order-item
        if (orderItem) {
            orderItem.closest('.order-item').style.display = 'none'; // Или используйте orderItem.closest('.order-item').remove();
        }

        popups.style.display = 'none'; // Закрываем попап после удаления

    } catch (error) {
        console.error('Ошибка при удалении заказа:', error.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const openedOrderNumber = document.getElementById("opened-order-number");

    // Скрыть элемент по умолчанию
    openedOrderNumber.style.display = "none";

    // Функция для получения заказов для выбранного стола
    function fetchOrdersForTable(tableNumber) {
        fetch(`/orders?table_number=${tableNumber}&status=open`)
    .then(response => response.json())
    .then(orders => {
        console.log(orders); // Добавьте это для проверки возвращаемых данных
        if (orders.length > 0) {
            const firstOrderTimestamp = orders[0].timestamp;
            const time = new Date(firstOrderTimestamp).toLocaleTimeString();
            openedOrderNumber.innerHTML = `Opened: <br> ${time}`;
            openedOrderNumber.style.display = "block"; // Показать элемент
        } else {
            openedOrderNumber.style.display = "none";
        }
    })
    .catch(error => {
        console.error("Ошибка при получении заказов:", error);
    });

    }

    // Пример вызова функции для получения заказов для стола 1
    const selectedTableNumber = currentTableNumber; // Здесь должно быть ваше логика выбора стола
    fetchOrdersForTable(selectedTableNumber);
});



function showDeletePopup(orderId, orderItem) {
    const popup = document.getElementById('pop-up-prod');
    const popupTable = document.getElementById('popup-prod-table');

    const productName = orderItem.querySelector('.option-text').textContent;
    popupTable.textContent = `Delete product "${productName}" from table ${currentTableNumber}?`;
    popup.style.display = 'flex';
    // Обработчик для кнопки "Back"
    document.getElementById('pop-up-prod-back').onclick = () => {
        popup.style.display = 'none'; // Закрываем попап
    };
}

function fetchOptionsByIds(optionIds) {
    if (optionIds.length === 0) {
        return Promise.resolve({});
    }

    // Формируем запрос к серверу для получения названий опций
    return fetch(`/options?ids=${optionIds.join(',')}`)
        .then(response => response.json())
        .then(options => {
            // Создаем объект для быстрого доступа к названиям опций по их ID
            return options.reduce((acc, option) => {
                acc[option.id] = option.option_details; // Предполагаем, что ответ содержит id и option_details
                return acc;
            }, {});
        });
}



document.getElementById('add-item').onclick = () => {
    const newModal = document.getElementById('modal-new-item');
    newModal.style.display = 'flex';

    loadCategories();  // Функция для загрузки категорий в новое окно
};


async function loadCategories() {
    try {
        const response = await fetch('/categories');  
        const categories = await response.json();

        const categoryContainer = document.getElementById('order-items-new');
        categoryContainer.innerHTML = '';

        categories.forEach(category => {
            const button = document.createElement('button');
            button.classList.add('category-button');
            button.textContent = category.category_name;

            button.addEventListener('click', () => {
                currentCategoryNumber = category.category_number; // Сохраняем номер категории
                console.log('Selected Category Number:', currentCategoryNumber); // Для отладки
                
                const newMealModal = document.getElementById('modal-meal-item');
                newMealModal.style.display = 'flex';

                const mealTitle = document.getElementById('table-number-meal');
                mealTitle.textContent = 'Choose meal';
            
                loadProductsByCategory(category.category_number);
            });
            
            categoryContainer.appendChild(button);
        });
    } catch (error) {
        console.error('Ошибка при загрузке категорий:', error);
    }
}


async function loadProductsByCategory(categoryNumber) {
    try {
        const response = await fetch(`/products?category_number=${categoryNumber}`);
        const products = await response.json();

        const productContainer = document.getElementById('meal-items-container');
        productContainer.innerHTML = '';

        products.forEach(product => {
            const button = document.createElement('button');
            button.classList.add('product-button');
            button.textContent = product.product_name_int;

            button.addEventListener('click', () => {
                currentProductNumber = product.product_number; // Сохраняем номер продукта
                console.log('Selected Product Number:', currentProductNumber); // Для отладки
                loadOptionsForProduct(product.option_group_number);
            });

            productContainer.appendChild(button);
        });
    } catch (error) {
        console.error('Ошибка при загрузке продуктов:', error);
    }
}



async function loadOptionsForProduct(optionGroupNumber) {
    try {
        const response = await fetch(`/product_options?option_group_number=${optionGroupNumber}`);
        const options = await response.json();

        console.log('Options received:', options); // Проверка полученных данных

        const optionContainer = document.getElementById('option-items-container');
        optionContainer.innerHTML = ''; // Очищаем контейнер

        // Используем глобальную переменную selectedOptions
        // Убедитесь, что selectedOptions объявлена глобально
        selectedOptions = new Set(); // Объявляем глобально, если еще не было сделано

        // Создаем и отображаем кнопки опций
        options.forEach(option => {
            const optionButton = document.createElement('button'); // Создаем кнопку
            optionButton.textContent = option.option_details; // Устанавливаем текст кнопки
            optionButton.className = 'option-button'; // Добавляем класс для стилизации

            // Обработчик для кнопки
            optionButton.addEventListener('click', () => {
                // Проверяем, выбрана ли опция
                if (selectedOptions.has(option.id)) {
                    selectedOptions.delete(option.id); // Убираем опцию из выбранных
                    optionButton.classList.remove('selected'); // Убираем выделение
                } else {
                    selectedOptions.add(option.id); // Добавляем опцию в выбранные
                    optionButton.classList.add('selected'); // Добавляем выделение
                }

                console.log(`Выбранные опции: ${Array.from(selectedOptions)}`); // Лог для проверки выбранных опций
            });

            optionContainer.appendChild(optionButton); // Добавляем кнопку в контейнер
        });

        // Создаем инпут для комментария
        const commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.placeholder = 'Add own text';
        commentInput.className = 'comment-input'; // Добавим класс для стилизации

        // Добавляем инпут комментария в контейнер
        optionContainer.appendChild(commentInput);

        const optionModal = document.getElementById('modal-option-item');
        optionModal.style.display = 'flex'; // Показываем модальное окно опций
    } catch (error) {
        console.error('Ошибка при загрузке опций:', error);
    }
}



document.getElementById('confirm-option').addEventListener('click', async () => {
    const productNumber = currentProductNumber; // Номер продукта
    const categoryNumber = currentCategoryNumber; // Номер категории
    const optionNumbers = Array.from(selectedOptions).join(','); // Преобразуем Set в строку
    console.log('Номера опций:', optionNumbers); // Лог для проверки
    const optionText = document.querySelector('.comment-input').value || ''; // Получаем текст комментария

    console.log('Выбранные опции перед отправкой:', Array.from(selectedOptions));

    const orderData = {
        product_number: productNumber,
        category_number: categoryNumber,
        option_number: optionNumbers,
        option_text: optionText,
        table_number: currentTableNumber,
        status: 'pending'
    };

    console.log('Данные для отправки:', orderData); // Проверка перед отправкой

    try {
        const response = await fetch('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        // Проверка на ошибки
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка при добавлении заказа:', errorText);
            return; // Завершаем выполнение, если произошла ошибка
        }

        const result = await response.json();
        console.log(result.message); // Сообщение о успешном добавлении
        // Закрываем модальное окно после успешного добавления
        const optionModal = document.getElementById('modal-option-item');
        const mealModal = document.getElementById('modal-meal-item')
        optionModal.style.display = 'none';
        mealModal.style.display = 'none';
    } catch (error) {
        console.error('Ошибка:', error);
    }
});



// Функция для отображения опций
function displayOptions(options) {
    const optionContainer = document.getElementById('option-container'); // Или ваш контейнер для опций

    // Очищаем контейнер перед добавлением новых опций
    optionContainer.innerHTML = '';

    options.forEach(option => {
        const optionButton = document.createElement('button');
        optionButton.textContent = option.option_details;
        optionButton.className = 'option-button';

        optionButton.addEventListener('click', () => {
            if (selectedOptions.has(option.id)) {
                selectedOptions.delete(option.id);
                optionButton.classList.remove('selected');
            } else {
                selectedOptions.add(option.id);
                optionButton.classList.add('selected');
            }

            console.log('Выбранные опции:', Array.from(selectedOptions)); // Лог для проверки
        });

        optionContainer.appendChild(optionButton);
    });
}

function addProductToOrder(product) {
    // Код для добавления продукта в заказ...
    loadOptionsByProduct(product.option_group_number); // Загружаем опции для выбранного блюда

    const optionModal = document.getElementById('modal-option-item');
    optionModal.style.display = 'flex'; // Показываем модальное окно опций
}

// Закрытие модального окна опций
//document.getElementById('close-option').addEventListener('click', () => {
  //  const optionModal = document.getElementById('modal-option-item');
    //optionModal.style.display = 'none';
//});


function showPrintModal() {
    const printModal = document.getElementById('print-modal');
    const printTableNumberElement = document.getElementById('print-table-number');
    const printMainContainer = document.getElementById('print-main-container');

    // Устанавливаем номер стола в заголовке
    printTableNumberElement.textContent = `Print order for the table: ${currentTableNumber}`;

    // Очищаем контейнер для блюд
    printMainContainer.innerHTML = '';

    // Отображаем все добавленные блюда
    orderedItems.forEach((item, index) => {
    const product = allProducts.find(p => p.product_name_int === item.product_number);
    const productName = product ? product.product_name_int : 'Unknown Product'; // Обработка случая, если продукт не найден

    const itemDiv = document.createElement('div');
    itemDiv.classList.add('print-item');
    itemDiv.textContent = `${index + 1}. ${productName}`;
    printMainContainer.appendChild(itemDiv);
});


    // Показываем модальное окно
    printModal.style.display = 'flex';
}


// Функция для загрузки данных с сервера
async function fetchTables() {
    try {
        const response = await fetch('http://192.168.0.103:5012/tables');
        const tables = await response.json();  // Преобразуем ответ в JSON
        allTables = tables;  // Сохраняем столы в глобальную переменную

        // Отображаем столы внутри (по умолчанию)
        displayTables('inside');
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
    }
}


// Функция для загрузки продуктов
async function loadProducts() {
    try {
        const response = await fetch('http://192.168.0.103:5012/products'); // URL для загрузки блюд
        const products = await response.json();  // Преобразуем ответ в JSON
        allProducts = products;  // Сохраняем продукты в глобальную переменную

        // Добавляем продукты в модальное окно
        const productSelect = document.querySelector('.product-select');
        allProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.product_name_int;  // Установка значения
            option.textContent = product.product_name_int;  // Отображение текста
            productSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке продуктов:', error);
    }
}

// Функция для отображения столов
async function displayTables(location) {
    const layout = document.getElementById('restaurant-layout');
    layout.innerHTML = ''; // Очищаем текущие столы

    const filteredTables = allTables.filter(table => table.location === location);

    if (filteredTables.length === 0) {
        layout.textContent = 'Нет доступных столов.';
        return;
    }

    try {
        // Получаем список столов с открытыми заказами
        const openTableNumbers = await getTablesWithOpenOrders();
        console.log('Столы с открытыми заказами:', openTableNumbers);

        // Создаем и отображаем столы
        filteredTables.forEach(table => {
            const tableDiv = document.createElement('div');
            tableDiv.classList.add('table');

            // Отображаем номер стола или Take Away
            tableDiv.textContent = table.table_number.toString().toLowerCase().startsWith('take away')
                ? `Take Away ${table.ta_number || ''}`
                : `${table.table_number}`;

            // Устанавливаем позиционирование стола
            tableDiv.style.width = `${table.width_percentage}%`;
            tableDiv.style.height = `${table.height_percentage}%`;
            tableDiv.style.left = `${table.x_position_percentage}%`;
            tableDiv.style.top = `${table.y_position_percentage}%`;

            // Проверяем, есть ли открытый заказ на этом столе
            if (openTableNumbers.includes(String(table.table_number))) {
                console.log(`Стол ${table.table_number} имеет открытые заказы.`);
                tableDiv.style.border = '4px solid rgb(83, 135, 255)'; // Меняем цвет на синий
            }

            // Добавляем событие на клик по столу для открытия модального окна
            tableDiv.addEventListener('click', () => showModal(table.table_number));

            layout.appendChild(tableDiv); // Добавляем стол в DOM

            // Запускаем анимацию появления
            requestAnimationFrame(() => {
                tableDiv.classList.add('visible'); // Добавляем класс visible для анимации
            });
        });
    } catch (error) {
        console.error('Ошибка при отображении столов:', error);
    }
}

// Функция для получения номеров столов с открытыми заказами
async function getTablesWithOpenOrders() {
    try {
        const response = await fetch('/orders?status=open');
        if (!response.ok) throw new Error('Ошибка запроса на сервер.');

        const orders = await response.json();
        console.log('Полученные заказы:', orders); // Отладочное сообщение

        return [...new Set(orders.map(order => String(order.table_number)))];
    } catch (error) {
        console.error('Ошибка при получении открытых заказов:', error);
        return [];
    }
}

// Функция для обновления границы конкретного стола
async function displayTableBorder(tableNumber) {
    const layout = document.getElementById('restaurant-layout');
    const tables = layout.getElementsByClassName('table');
    
    for (let table of tables) {
        if (table.textContent.includes(tableNumber.toString())) {
            table.style.border = '4px solid rgb(83, 135, 255)';
            break; // Выходим, как только нашли нужный стол
        }
    }
}

window.onload = async function () {
    try {
        await fetchTables(); // Загружаем данные столов
        await displayTables('inside'); // Отображаем столы внутри при загрузке

        // Подключаемся к серверу WebSocket
        const socket = io('http://192.168.0.103:5012'); // Здесь создаем сокет

        // Обработчики событий для отладки
        socket.on('connect', () => {
            console.log('Подключено к серверу WebSocket');
        });

        socket.on('connect_error', (err) => {
            console.error('Ошибка подключения:', err);
        });

        socket.on('disconnect', (reason) => {
            console.log('Отключено от сервера:', reason);
        });

        // Обрабатываем событие нового заказа
        socket.on('new_order', async (data) => {
            const tableNumber = data.table_number;
            console.log(`Новый заказ для стола ${tableNumber}`);
            
            // Обновляем только этот стол
            await displayTableBorder(tableNumber);
        });

    } catch (error) {
        console.error('Ошибка при загрузке страницы:', error);
    }

    const insideButton = document.getElementById('inside');
    const outsideButton = document.getElementById('outside');

    insideButton.addEventListener('click', async () => {
        await displayTables('inside'); // Отображаем столы внутри
        toggleButtons(insideButton, outsideButton); // Переключаем активную кнопку
    });

    outsideButton.addEventListener('click', async () => {
        await displayTables('outside'); // Отображаем столы снаружи
        toggleButtons(outsideButton, insideButton); // Переключаем активную кнопку
    });
};

function toggleButtons(activeButton, inactiveButton) {
    activeButton.id = 'active'; // Устанавливаем ID для активной кнопки
    inactiveButton.removeAttribute('id'); // Убираем ID у неактивной кнопки
}

async function saveOrder() {
    console.log("Сохранение заказа началось");
    try {
        // Логика сохранения
        console.log("Заказ успешно сохранён");
    } catch (error) {
        console.error("Ошибка при сохранении заказа:", error);
    }
}



// Обработчик для основной кнопки "Add"
document.getElementById('add-item').addEventListener('click', function() {
    // Открываем новое модальное окно
    const newModal = document.getElementById('modal-new-item');
    newModal.style.display = 'flex';

    // Закрываем новое модальное окно при клике на крестик
    //document.getElementById('close-new').addEventListener('click', function() {
      //  newModal.style.display = 'none';
    //});

    // Загружаем продукты в новый popup
    loadProductsIntoModal('order-items-new');
});

// Функция для загрузки продуктов в модальное окно
function loadProductsIntoModal(containerId) {
    const container = document.getElementById(containerId);
    const productSelect = container.querySelector('.product-select');

    allProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.product_name_int;  
        option.textContent = product.product_name_int;
        productSelect.appendChild(option);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const backButton = document.getElementById('back-btn');
    const modalMealItem = document.getElementById('modal-meal-item');

    if (backButton && modalMealItem) {
        backButton.addEventListener('click', () => {
            modalMealItem.style.display = 'none'; // Скрываем модальное окно
        });
    } else {
        console.error("Элементы с указанными ID не найдены.");
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('add-another-item');
    if (backButton) {
        backButton.addEventListener('click', () => {
            // Закрываем текущее окно выбора блюда
            const productModal = document.getElementById('modal-new-item');
            if (productModal) {
                productModal.style.display = 'none';
            }

            // Открываем окно выбора категорий
            const categoryModal = document.getElementById('modal-category');
            if (categoryModal) {
                categoryModal.style.display = 'flex';
            }
        });
    } else {
        console.error('Кнопка "Back" с классом .add-another-item не найдена');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('print-modal').style.display = 'none';
        });
    }
});


// Получаем элемент с ID 'close-new'
const closeNewButton = document.getElementById("close-new");

// Добавляем обработчик события для кнопки 'close-new'
closeNewButton.addEventListener("click", function() {
    const selectedTableNumber = currentTableNumber; // Замените на вашу логику получения номера стола

    document.getElementById("header-table-number").innerText = `Adding order: ${selectedTableNumber}`;
    document.getElementById("order-modal").style.display = "block";
});


// Обработчик закрытия модального окна для всех кнопок с классом "order-close-btn"
document.querySelectorAll(".order-close-btn").forEach(button => {
    button.addEventListener("click", function() {
        const selectedTableNumber = currentTableNumber;

        fetch(`/orders?table_number=${selectedTableNumber}&status=pending`)
            .then(response => response.json())
            .then(orders => {
                console.log('Полученные заказы:', orders); // Лог для проверки

                const printMainContainer = document.getElementById("option-main-container");
                printMainContainer.innerHTML = ''; // Очистить предыдущие заказы

                const optionIds = orders.flatMap(order => order.option_number ? String(order.option_number).split(',') : []);
                
                fetchOptionsByIds(optionIds)
                    .then(optionDetails => {
                        // Сохраняем заказы для последующей печати
                        window.currentOrders = [];

                        orders.forEach(order => {
                            const orderId = order.id;

                            // Проверяем, был ли этот заказ уже добавлен
                            if (!window.currentOrders.some(o => o.id === orderId)) {
                                const optionNumbers = order.option_number ? String(order.option_number).split(',') : [];
                                const optionNames = optionNumbers.map(num => {
                                    const optionName = optionDetails[num] || 'Нет';
                                    console.log(`Опция для ID ${num}: ${optionName}`);
                                    return optionName;
                                }).join(', ');

                                const productName = order.product_name_int || order.product_name || 'Unknown Product';
                            
                                const orderItem = document.createElement("div");
                                orderItem.classList.add("print-order-item");
                                orderItem.innerHTML = `
                                    <div class="order-btns">
                                        <input type="number" value="1" min="1" class="quantity" />
                                        <span class="remove-order" data-order-id="${orderId}">&times;</span> <!-- Кнопка крестик -->
                                    </div>
                                    <div class="order-container">
                                        <span class="option-text">${productName}</span>
                                        <span class="option-text" style="width: 200px;">${optionNames || 'No option'}</span>
                                        <span class="option-text">${order.option_text || 'No comment'}</span>
                                    </div>
                                `;

                                // Добавление обработчика события для кнопки-крестика
                                orderItem.querySelector('.remove-order').addEventListener('click', function() {
                                    const orderId = this.getAttribute('data-order-id'); // Получаем ID заказа
                                    deleteOrder(orderId, orderItem); // Передаем orderItem для скрытия
                                });
                                
                                printMainContainer.appendChild(orderItem);
                                
                                // Добавляем заказ в список текущих заказов
                                window.currentOrders.push({
                                    id: orderId,
                                    product_name: productName,
                                    option_details: optionNames || 'No option',
                                    option_text: order.option_text || 'No comment',
                                    product_number: order.product_number
                                });
                            }
                        });

                        // Открываем модальное окно печати
                        document.getElementById("order-modal").style.display = "block";
                        window.currentTableNumber = selectedTableNumber;  // Сохраняем номер стола
                    })
                    .catch(error => console.error('Ошибка при получении деталей опций:', error));
            })
            .catch(error => console.error('Ошибка при получении заказов:', error));
    });
});



document.getElementById('clear-btn').onclick = () => {
    const newModal = document.getElementById('pop-up');
    newModal.style.display = 'flex';
    tablenum = currentTableNumber
const popup = document.getElementById('pop-up');
const tableNumber = document.getElementById('popup-table');

// Устанавливаем номер стола в модальное окно
tableNumber.textContent = `Delete all records from table ${tablenum}?`;
popup.style.display = 'flex';
};

document.getElementById('pop-up-back').onclick = () => {
    const newModal = document.getElementById('pop-up');
    newModal.style.display = 'none';
};

document.getElementById('pop-up').onclick = () => {
    const newModal = document.getElementById('pop-up');
    newModal.style.display = 'none';
};

// Логика для кнопки отмены заказа
document.getElementById("pop-up-yes").addEventListener("click", function() {
    const selectedTableNumber = currentTableNumber; // Замените на вашу логику получения номера стола

    const popup = document.getElementById('pop-up');
    popup.style.display = 'none';

    // Отправляем запрос для изменения статуса всех заказов на 'deleted'
    fetch(`/close_orders?table_number=${selectedTableNumber}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' // Указываем тип контента
        },
        body: JSON.stringify({}) // Отправляем пустое тело, если не нужны данные
    })
    .then(response => {
        if (response.ok) {
            console.log('Все заказы успешно отменены');
            // Скрываем все элементы заказа в модальном окне
            document.getElementById("order-items").innerHTML = ''; // Очищаем список заказов
            // Можно также закрыть модальное окно, если необходимо
            document.getElementById("order-modal").style.display = "none";
        } else {
            console.error('Ошибка при отмене заказов');
        }
    })
    .catch(error => console.error('Ошибка:', error));
});


// Функция для установки текущего номера стола (вызовите эту функцию при выборе стола)
function selectTable(tableNumber) {
    currentTableNumber = tableNumber;
    console.log("Текущий номер стола установлен:", currentTableNumber);
}

// Ждем полной загрузки DOM
document.addEventListener("DOMContentLoaded", function() {
    // Получаем кнопки для отмены заказа
    const discardButton = document.getElementById("discard-order");
    const cancelButton = document.getElementById("cancel-order");

    // Добавляем обработчик на обе кнопки, если они найдены
    if (discardButton) {
        console.log("Элемент 'discard-order' найден, добавляем обработчик");
        discardButton.addEventListener("click", handleCancelOrder);
    } else {
        console.error("Элемент с ID 'discard-order' не найден.");
    }

    if (cancelButton) {
        console.log("Элемент 'cancel-order' найден, добавляем обработчик");
        cancelButton.addEventListener("click", handleCancelOrder);
    } else {
        console.error("Элемент с ID 'cancel-order' не найден.");
    }
});

// Функция обработки отмены заказа
function handleCancelOrder() {
    console.log("Кнопка отмены заказа нажата");

    // Проверяем, установлен ли текущий номер стола
    if (!currentTableNumber) {
        alert("Выберите стол перед отменой заказа.");
        console.error("Номер стола не установлен.");
        return;
    }

    console.log(`Номер стола для отмены заказа: ${currentTableNumber}`);

    // Отправляем запрос на сервер для отмены заказов по номеру стола
    fetch(`/discard_orders?table_number=${currentTableNumber}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    })
    .then(response => {
        console.log("Ответ от сервера получен");

        if (response.ok) {
            console.log('Все заказы успешно отменены');
            // Очищаем содержимое элемента с заказами
            document.getElementById("order-items").innerHTML = '';
            // Скрываем модальные окна
            document.getElementById("order-modal").style.display = "none";
            document.getElementById("modal-new-item").style.display = "none";
            document.getElementById("modal").style.display = "none";
        } else {
            console.error('Ошибка при отмене заказов, статус:', response.status);
            alert("Не удалось отменить заказы. Попробуйте еще раз.");
        }
    })
    .catch(error => {
        console.error('Ошибка при отправке запроса:', error);
        alert("Произошла ошибка при отмене заказа. Проверьте подключение к сети.");
    });
}



function deleteOrder(orderId, orderItem) {
    fetch(`/discard_order/${orderId}`, {
        method: 'POST'
    })
    .then(response => {
        if (response.ok) {
            console.log('Заказ успешно отменён');
            orderItem.style.display = 'none'; // Скрываем элемент
        } else {
            console.error('Ошибка при отмене заказа');
        }
    })
    .catch(error => console.error('Ошибка:', error));
}


document.getElementById("add-more").addEventListener("click", function() {
    // Закрываем текущее модальное окно
    document.getElementById("order-modal").style.display = "none";
    document.getElementById("modal-meal-item").style.display = "none";

    // Открываем модальное окно категорий
    document.getElementById("modal-new-item").style.display = "block";
});

document.getElementById("print-button").addEventListener("click", function() {
    const selectedTableNumber = currentTableNumber;

    fetch(`/orders?table_number=${selectedTableNumber}&status=pending`)
        .then(response => response.json())
        .then(orders => {
            console.log('Полученные заказы:', orders); // Лог для проверки

            const printMainContainer = document.getElementById("print-main-container");
            printMainContainer.innerHTML = ''; // Очистить предыдущие заказы

            const optionIds = orders.flatMap(order => order.option_number ? String(order.option_number).split(',') : []);
            
            fetchOptionsByIds(optionIds)
                .then(optionDetails => {
                    // Сохраняем заказы для последующей печати
                    window.currentOrders = []; // Инициализируем пустой массив для текущих заказов

                    orders.forEach(order => {
                        const orderId = order.id;

                        // Проверяем, был ли этот заказ уже добавлен
                        const existingOrder = window.currentOrders.find(o => o.id === orderId);

                        if (!existingOrder) {
                            const optionNumbers = order.option_number ? String(order.option_number).split(',') : [];
                            const optionNames = optionNumbers.map(num => {
                                const optionName = optionDetails[num] || 'Нет';
                                console.log(`Опция для ID ${num}: ${optionName}`);
                                return optionName;
                            }).join(', ');
                        
                            console.log(`Названия опций: ${optionNames}`);

                            const productName = order.product_name_int || order.product_name || 'Unknown Product';
                        
                            const orderItem = document.createElement("div");
                            orderItem.classList.add("print-order-item");
                            orderItem.innerHTML = `
                                <div class="order-btns">
                                    <input type="number" value="1" min="1" class="quantity" />
                                </div>
                                <div class="order-container">
                                    <span class="option-text">${productName}</span>
                                    <span class="option-text" style="width: 200px;">${optionNames || 'No option'}</span>
                                    <span class="option-text">${order.option_text || 'No comment'}</span>
                                </div>
                            `;
                            printMainContainer.appendChild(orderItem);
                        
                            // Добавляем заказ в список текущих заказов
                            window.currentOrders.push({
                                id: orderId,
                                product_name: productName,
                                option_details: optionNames || 'No option',
                                option_text: order.option_text || 'No comment',
                                product_number: order.product_number
                            });
                        }
                    });

                    // Открываем модальное окно печати
                    document.getElementById("print-modal").style.display = "block";
                    window.currentTableNumber = selectedTableNumber;  // Сохраняем номер стола
                })
                .catch(error => console.error('Ошибка при получении деталей опций:', error));
        })
        .catch(error => console.error('Ошибка при получении заказов:', error));
});

document.getElementById("confirm-print").addEventListener("click", function() {
    const orderedItems = window.currentOrders; // Убедитесь, что здесь есть product_number

    // Логируем заказы перед отправкой
    console.log("Заказы для печати:", orderedItems);

    fetch('/print_order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table_number: window.currentTableNumber, orders: orderedItems })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);
        document.getElementById("print-modal").style.display = "none";
    })
    .catch(error => console.error('Ошибка при отправке заказа на печать:', error));
});


// Функция для обработки нажатия на кнопку confirm-print
async function handleConfirmPrint() {
    if (typeof currentTableNumber === 'undefined') {
        console.error('Нет активного стола. Убедитесь, что стол выбран.');
        return;
    }

    try {
        // Отправляем запрос для изменения статуса всех заказов на 'open', если они были 'pending'
        const response = await fetch(`/update_orders?table_number=${currentTableNumber}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Отправляем пустое тело, если не нужны данные
        });

        if (response.ok) {
            console.log('Все заказы со статусом pending успешно обновлены на open');

            // Скрываем попапы перед открытием нового
            hidePopups();

            // Открываем модальное окно с открытыми заказами для активного стола
            await showModal(currentTableNumber);
        } else {
            console.error('Ошибка при обновлении заказов');
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Функция для скрытия модальных окон
function hidePopups() {
    const modals = ['print-modal', 'order-modal', 'modal-new-item'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
}

// Функция для отображения заказов в модальном окне
async function showModalу(tableNumber) {
    currentTableNumber = tableNumber;
    const modal = document.getElementById('modal');
    const tableNumberElement = document.getElementById('table-number');

    // Устанавливаем номер стола в модальное окно
    tableNumberElement.textContent = `Table: ${tableNumber}`;
    modal.style.display = 'flex';

    // Закрываем модальное окно при нажатии на крестик
    const closeModal = document.querySelector('#close');
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    try {
        // Получаем заказы для стола
        const response = await fetch(`/orders?table_number=${tableNumber}&status=open`);
        const orders = await response.json();

        console.log('Заказы для стола:', orders); // Отладка

        const orderItemsDiv = document.getElementById("order-items");
        orderItemsDiv.innerHTML = ''; // Очищаем контейнер

        // Проверяем наличие открытых заказов
        if (orders.length === 0) {
            orderItemsDiv.textContent = 'List is empty'; // Если нет заказов, выводим сообщение
            return; // Завершаем выполнение функции
        }

        // Собираем все идентификаторы опций
        const optionIds = [];
        orders.forEach(order => {
            if (order.option_number) {
                const numbers = String(order.option_number).split(',').map(Number);
                optionIds.push(...numbers);
            }
        });

        // Запрос для получения названий опций
        const optionDetails = await fetchOptionsByIds(optionIds);

        orders.forEach(order => {
            const orderItem = document.createElement("div");
            orderItem.classList.add("order-item");
            const optionNumbers = order.option_number ? String(order.option_number).split(',') : [];
    
            // Получаем названия опций
            const optionNames = optionNumbers.map(num => optionDetails[num] || 'Нет').join(', ');

            orderItem.innerHTML = `
                <div class="order-btns">
                    <input type="number" value="1" min="1" class="quantity" />
                    <span class="remove-order" data-order-id="${order.id}" data-product-name="${order.product_name}">&times;</span>
                </div>
                <div class="order-container">
                    <span class="option-text">${order.product_name}</span>
                    <span class="option-text" style="width: 200px;">${optionNames || 'No option'}</span>
                    <span class="option-text">${order.option_text || 'No comment'}</span>
                </div>
            `;

            // Обработчик события для кнопки-крестика
            orderItem.querySelector('.remove-order').addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                showDeletePopup(orderId, orderItem);
            });

            orderItemsDiv.appendChild(orderItem);
        });
    } catch (error) {
        console.error('Ошибка при проверке заказа:', error);
    }
}

// Добавляем обработчик события для кнопки confirm-print
document.getElementById('confirm-print').addEventListener('click', handleConfirmPrint);