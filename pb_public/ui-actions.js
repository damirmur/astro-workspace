// Переключение проекта в селекторе
function selectProject() {
    currentProjectId = document.getElementById('project-selector').value;
    document.getElementById('current-project-name').innerText = "📂 Проект: " + document.getElementById('project-selector').options[document.getElementById('project-selector').selectedIndex].text;
    collapsedNodesMap = {}; 
    renderProjectWorkspace(currentProjectId);
}

// Создание нового проекта
async function createNewProject() {
    const input = document.getElementById('new-project-title');
    const title = input.value.trim();
    if (!title) return alert("Введите название проекта!");
    try {
        const newProj = await apiCreateProject(title);
        input.value = '';
        currentProjectId = newProj.id;
        await initWorkspace();
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
}

// Создание подзадачи/шага
async function createSubtask(event, parentId) {
    event.stopPropagation();
    const title = prompt("Введите название задачи/шага:");
    if (!title) return;

    let typePromptText = "Выберите тип задачи (цифра):\n";
    globalTypes.forEach((t, idx) => typePromptText += `${idx + 1} — ${t.icon} ${t.name}\n`);
    
    const typeIdx = parseInt(prompt(typePromptText, "3")) - 1;
    if (isNaN(typeIdx) || typeIdx < 0 || typeIdx >= globalTypes.length) return alert("Неверный тип!");

    try {
        await apiCreateTask(title, globalTypes[typeIdx].id, parentId);
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
}

// Создание связи блокировки (depends_on)
async function linkDependency(event, taskId, allRecords) {
    event.stopPropagation();
    const availableTasks = allRecords.filter(r => r.id !== taskId);
    if (availableTasks.length === 0) return alert("Нет других задач!");

    let promptText = "Какая задача должна быть выполнена перед текущей (цифра):\n";
    availableTasks.forEach((t, idx) => {
        const icon = globalTypes.find(type => type.id === t.type)?.icon || "•";
        promptText += `${idx + 1} — ${icon} ${t.title}\n`;
    });

    const idx = parseInt(prompt(promptText)) - 1;
    if (isNaN(idx) || idx < 0 || idx >= availableTasks.length) return alert("Неверный выбор!");

    try {
        await apiAddDependency(taskId, availableTasks[idx].id);
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
}

// Интерактивное изменение статуса с валидацией графа
async function updateTaskStatus(event, taskId, newStatusId) {
    event.stopPropagation();
    const selectElement = event.target;
    const targetStatus = globalStatuses.find(s => s.id === newStatusId);
    const targetWeight = targetStatus ? targetStatus.weight : 1;

    try {
        const records = await fetchTasksForProject(currentProjectId);
        const treeData = buildTree(records);
        const foundNode = findNodeById(treeData, taskId);

        if (foundNode && hasSubtasksWithLowerStatus(foundNode, targetWeight)) {
            alert(`⚠️ Сначала переведите нижестоящие задачи в статус "${targetStatus.name}"!`);
            selectElement.value = foundNode.status;
            selectElement.className = `status-select status-${foundNode.expand?.status?.key || 'todo'}`;
            return;
        }

        if (foundNode) {
            const blockerData = getBlockingTask(foundNode, records, targetWeight);
            if (blockerData) {
                alert(`⛔ Конвейер заблокирован!\n\n${blockerData.reason}`);
                selectElement.value = foundNode.status;
                selectElement.className = `status-select status-${foundNode.expand?.status?.key || 'todo'}`;
                return;
            }
        }

        await apiUpdateTaskStatus(taskId, newStatusId);
        selectElement.className = `status-select status-${targetStatus.key}`;
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка: " + err.message);
        await renderProjectWorkspace(currentProjectId);
    }
}

// 1. Обработчик изменения приоритета с экрана
async function updateTaskPriority(event, taskId, newPriority) {
    try {
        await apiUpdateTaskPriority(taskId, newPriority);
        // Перекрашиваем селектор налету
        const select = event.target;
        select.className = `priority-select priority-${newPriority}`;
        console.log(`Приоритет задачи ${taskId} успешно изменен на ${newPriority}`);
    } catch (err) {
        alert("Не удалось изменить приоритет: " + err.message);
    }
}

// 2. Обработчик изменения дедлайна с экрана
// Обновленный обработчик дедлайна с валидацией временного штампа
async function updateTaskDeadline(event, taskId, dateString) {
    try {
        let isoDate = "";
        
        if (dateString) {
            // Дополняем YYYY-MM-DD временем, чтобы PocketBase принял валидный DateField
            const fullDateTimeString = `${dateString}T23:59:59.000Z`;
            isoDate = new Date(fullDateTimeString).toISOString();
        }
        
        // Отправляем PATCH-запрос в SQLite
        await apiUpdateTaskDeadline(taskId, isoDate);
        
        // Перезагружаем бэклог, чтобы обновить баджи просроченности
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Не удалось сохранить дедлайн: " + err.message);
    }
}


// 3. Обновленная функция сворачивания (теперь работает без кнопок, чисто по DOM-клику)
function toggleNodeCollapse(event, taskId) {
    event.stopPropagation();
    collapsedNodesMap[taskId] = !collapsedNodesMap[taskId];
    
    // Перерендериваем воркфлоу, чтобы применить стили затухания текста свернутого родителя
    applyFilters();
}

// 4. Обновленная функция Подробнее (с остановкой всплытия клика родителя)
function toggleDetails(event, id) {
    event.stopPropagation(); // Критично! Чтобы при клике на "Подробнее" дерево не сворачивалось
    document.getElementById(`details-${id}`).classList.toggle('active');
}
// Обработчик интерактивной смены исполнителя с экрана
async function updateTaskAssignee(event, taskId, newUserId) {
    try {
        await apiUpdateTaskAssignee(taskId, newUserId);
        console.log(`Исполнитель задачи ${taskId} успешно изменен на ${newUserId}`);
        // Обновляем бэклог для фиксации состояния expand
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Не удалось сменить исполнителя: " + err.message);
    }
}
