// Главная функция инициализации рабочего пространства
// Главная функция инициализации рабочего пространства (с учетом авторизации)
async function initWorkspace() {
    const loginOverlay = document.getElementById('login-overlay');
    const mainWorkspace = document.getElementById('main-workspace');

    // 1. ПРОВЕРКА: Авторизован ли пользователь в PocketBase?
    if (!pb.authStore.isValid) {
        // Если токена нет — показываем окно входа и блокируем интерфейс
        loginOverlay.style.display = 'flex';
        mainWorkspace.style.display = 'none';
        return;
    }

    // 2. Если токен валиден — скрываем форму входа и открываем рабочую область
    loginOverlay.style.display = 'none';
    mainWorkspace.style.display = 'block';

    // Выводим имя и роль текущего юзера в шапку из данных токена
    document.getElementById('user-display-name').innerText = pb.authStore.model.email;
    document.getElementById('user-display-role').innerText = pb.authStore.model.role.toUpperCase();

    try {
        // 3. Загружаем справочники, проекты и задачи (теперь бэкенд пропустит эти запросы)
        await fetchMeta();
        const projects = await fetchProjects();
        const selector = document.getElementById('project-selector');
        selector.innerHTML = '';

        if (projects.length === 0) {
            selector.innerHTML = '<option value="">Нет активных проектов</option>';
            document.getElementById('current-project-name').innerText = 'Нет проектов';
            document.getElementById('workspace-tree').innerHTML = '<div class="empty-state"><p>Создайте первый проект в панели справа!</p></div>';
            document.getElementById('root-task-btn').style.display = 'none';
            return;
        }

        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = p.title;
            selector.appendChild(opt);
        });

        if (!currentProjectId || !projects.some(p => p.id === currentProjectId)) {
            currentProjectId = projects[0].id; 
        }

        selector.value = currentProjectId;
        document.getElementById('current-project-name').innerText = "📂 Проект: " + selector.options[selector.selectedIndex].text;
        document.getElementById('root-task-btn').style.display = 'block';
        
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        console.error("Ошибка инициализации данных:", err);
    }
}

// Обработчик отправки формы входа
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;

    try {
        // Вызываем метод авторизации из api.js
        await apiAuthUser(email, pass);
        // В случае успеха перезапускаем рабочую область
        await initWorkspace();
    } catch (err) {
        alert("🔒 Ошибка авторизации: Неверный Email или пароль!\n" + err.message);
    }
}

// Обработчик нажатия кнопки Выйти
function handleLogout() {
    if (!confirm("Выйти из рабочего пространства?")) return;
    apiLogoutUser(); // Чистим токены
    initWorkspace(); // Возвращаем экран входа
}

// Загрузка и отрисовка дерева текущего проекта
async function renderProjectWorkspace(projectId) {
    try {
        const records = await fetchTasksForProject(projectId);
        if (records.length === 0) {
            document.getElementById('workspace-tree').innerHTML = `
                <div class="empty-state">
                    <p>В этом проекте еще нет задач.</p>
                    <button class="btn btn-primary" onclick="createSubtask(event, '')">Создать первую задачу</button>
                </div>`;
            return;
        }
        const treeData = buildTree(records);
        document.getElementById('workspace-tree').innerHTML = renderTreeHtml(treeData, records);
    } catch (err) {
        document.getElementById('workspace-tree').innerHTML = `<p style="color:#ef4444;">Ошибка рендера: ${err.message}</p>`;
    }
}

// Переключение проекта в селекторе
function selectProject() {
    currentProjectId = document.getElementById('project-selector').value;
    document.getElementById('current-project-name').innerText = "📂 Проект: " + document.getElementById('project-selector').options[document.getElementById('project-selector').selectedIndex].text;
    renderProjectWorkspace(currentProjectId);
}

// UI-кликер создания нового проекта
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
        alert("Ошибка создания проекта: " + err.message);
    }
}

// UI-кликер создания подзадачи
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
        renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
}

// UI-кликер линковки зависимостей
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
        renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
}

// UI-переключатель смены статуса (содержит вызовы валидации ядра)
async function updateTaskStatus(event, taskId, newStatusId) {
    event.stopPropagation();
    const selectElement = event.target;
    const targetStatus = globalStatuses.find(s => s.id === newStatusId);
    const targetWeight = targetStatus ? targetStatus.weight : 1;

    try {
        const records = await fetchTasksForProject(currentProjectId);
        const treeData = buildTree(records);
        const foundNode = findNodeById(treeData, taskId);

        // 1. Проверяем подзадачи (снизу вверх)
        if (foundNode && hasSubtasksWithLowerStatus(foundNode, targetWeight)) {
            alert(`⚠️ Сначала переведите нижестоящие задачи в статус "${targetStatus.name}"!`);
            selectElement.value = foundNode.status;
            selectElement.className = `status-select status-${foundNode.expand?.status?.key || 'todo'}`;
            return;
        }

        // 2. Проверяем блокираторы (последовательность выполнения)
        if (foundNode && targetWeight > 1) {
            const blocker = getBlockingTask(foundNode, records);
            if (blocker) {
                const typeName = blocker.expand?.type?.name || "задача";
                alert(`⛔ Шаг заблокирован предшественником: [${typeName}] "${blocker.title}"!`);
                selectElement.value = foundNode.status;
                selectElement.className = `status-select status-${foundNode.expand?.status?.key || 'todo'}`;
                return;
            }
        }

        // 3. Сохраняем, если всё легально
        await apiUpdateTaskStatus(taskId, newStatusId);
        selectElement.className = `status-select status-${targetStatus.key}`;
        renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка обновления статуса: " + err.message);
        renderProjectWorkspace(currentProjectId);
    }
}

function toggleDetails(id) {
    document.getElementById(`details-${id}`).classList.toggle('active');
}

// Генерация HTML дерева
function renderTreeHtml(nodes, allRecords) {
    let html = '';
    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const typeIcon = node.expand?.type?.icon || "•";
        const typeKey = node.expand?.type?.key || "step";
        const currentStatusKey = node.expand?.status?.key || 'todo';
        const currentStatusId = node.status;

        let dependencyText = "";
        if (node.expand?.depends_on && node.expand.depends_on.length > 0) {
            dependencyText = `<div class="task-deps-list">⛓️ <b>Выполняется после:</b> ` +
                node.expand.depends_on.map(d => `"${d.title}"`).join(', ') + `</div>`;
        }

        html += `<div class="task-container">`;
        html += `
            <div class="task-card task-type-${typeKey}">
                <div class="task-header">
                    <div class="task-title" onclick="toggleDetails('${node.id}')">
                        ${hasChildren ? '▼' : ''} <span style="font-size:18px; margin-right:4px;">${typeIcon}</span> <span>${node.title}</span>
                    </div>
                    <div class="task-actions">
<div style="display:flex; gap:4px;">
    <button class="btn-dep" onclick="linkDependency(event, '${node.id}', ${JSON.stringify(allRecords).replace(/"/g, '&quot;')})">⛓️ +</button>
    <button class="btn-dep" style="color:#ef4444; border-color:#7f1d1d;" onclick="clearDependencies(event, '${node.id}')">❌ Сброс</button>
</div> 
                       <select class="status-select status-${currentStatusKey}" onchange="updateTaskStatus(event, '${node.id}', this.value)">
                            ${globalStatuses.map(st => `<option value="${st.id}" ${st.id === currentStatusId ? 'selected' : ''}>${st.name}</option>`).join('')}
                        </select>
                        <button class="btn-subtask" onclick="createSubtask(event, '${node.id}')">+ Подзадача</button>
                    </div>
                </div>
                <div class="task-details" id="details-${node.id}">
                    <div>${node.notes || '<i>Описания нет</i>'}</div>
                    ${dependencyText}
                </div>
            </div>
        `;
        if (hasChildren) html += `<div class="tree-node">${renderTreeHtml(node.children, allRecords)}</div>`;
        html += `</div>`;
    });
    return html;
}
// =========================================================================
// ЭКСПОРТ ПРОЕКТА В JSON
// =========================================================================
async function exportCurrentProject() {
    if (!currentProjectId) return alert("Нет активного проекта для экспорта!");

    try {
        // 1. Собираем слепок проекта через наше API
        const snapshot = await apiGetProjectSnapshot(currentProjectId);

        // 2. Превращаем JSON-объект в строку и создаем Blob-файл в памяти браузера
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));

        // 3. Создаем виртуальную ссылку для скачивания файла на компьютер
        const downloadAnchor = document.createElement('a');
        const fileName = `${snapshot.project_title.replace(/\s+/g, '_')}_snapshot.json`;

        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchor);

        // 4. Имитируем клик мышкой для скачивания и удаляем элемент
        downloadAnchor.click();
        downloadAnchor.remove();

        console.log(`Проект "${snapshot.project_title}" успешно экспортирован в файл ${fileName}`);
    } catch (err) {
        alert("Ошибка экспорта проекта: " + err.message);
    }
}

// =========================================================================
// ИМПОРТ ПРОЕКТА ИЗ JSON (С ВОССТАНОВЛЕНИЕМ ГРАФА ИЕРАРХИИ)
// =========================================================================
function importProjectFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const snapshot = JSON.parse(e.target.result);
            if (!snapshot.project_title || !snapshot.tasks) {
                throw new Error("Неверный формат файла слепка проекта!");
            }

            if (!confirm(`Импортировать проект "${snapshot.project_title}" (${snapshot.tasks.length} задач)?`)) return;

            // 1. Создаем глобальный проект в базе данных
            const newProject = await pb.collection('projects').create({
                title: snapshot.project_title,
                status: snapshot.project_status || 'in_progress'
            });

            // 2. Магия восстановления связей:
            // PocketBase сгенерирует новые случайные ID для задач. Чтобы parent_task и depends_on
            // указывали на правильные элементы, мы создадим карту соответствия: [Старый ID] -> [Новый ID]
            const idMapping = {};

            // Этап А: Создаем задачи плоским списком, привязывая верные типы и статусы
            for (let task of snapshot.tasks) {
                // Ищем локальный ID статуса по его текстовому ключу
                const actualStatus = globalStatuses.find(s => s.key === task.status_key) || globalStatuses[0];
                // Ищем локальный ID типа по его текстовому ключу
                const actualType = globalTypes.find(t => t.key === task.type_key) || globalTypes[0];

                const createdRecord = await pb.collection('tasks').create({
                    title: task.title,
                    status: actualStatus.id,
                    type: actualType.id,
                    project: newProject.id,
                    notes: task.notes,
                    astro_coordinates: task.astro_coordinates,
                    parent_task: "", // Пока оставляем пустым, свяжем на Этапе Б
                    depends_on: []   // Пока оставляем пустым, свяжем на Этапе Б
                });

                // Запоминаем, какой новый ID база выдала старой задаче
                idMapping[task.id] = createdRecord.id;
            }

            // Этап Б: Вторым проходом каскадно восстанавливаем иерархию (parent_task) и блокировки (depends_on)
            for (let task of snapshot.tasks) {
                const newTaskId = idMapping[task.id];
                const updateData = {};

                // Если у задачи был родитель, находим его новый ID в карте соответствия
                if (task.parent_task && idMapping[task.parent_task]) {
                    updateData.parent_task = idMapping[task.parent_task];
                }

                // Если у задачи были блокировки, переводим все старые ID в новые
                if (task.depends_on && task.depends_on.length > 0) {
                    const newDependsOn = task.depends_on
                        .map(oldId => idMapping[oldId])
                        .filter(newId => !!newId); // Исключаем пустые значения, если что-то пошло не так

                    if (newDependsOn.length > 0) {
                        updateData.depends_on = newDependsOn;
                    }
                }

                // Если есть что обновлять — отправляем PATCH-запрос в PocketBase
                if (Object.keys(updateData).length > 0) {
                    await pb.collection('tasks').update(newTaskId, updateData);
                }
            }

            alert(`🎉 Проект "${snapshot.project_title}" успешно импортирован!`);

            // Сбрасываем инпут выбора файла, чтобы можно было загрузить его повторно
            event.target.value = '';

            // Переключаем интерфейс на импортированный проект и обновляем экран
            currentProjectId = newProject.id;
            await initWorkspace();

        } catch (err) {
            alert("Ошибка импорта проекта: " + err.message);
        }
    };
    reader.readAsText(file);
}
async function clearDependencies(event, taskId) {
    event.stopPropagation();
    if (!confirm("Очистить все зависимости для этой задачи?")) return;
    try {
        await apiClearDependencies(taskId);
        renderProjectWorkspace(currentProjectId);
    } catch (err) {
        alert("Ошибка сброса: " + err.message);
    }
}
// Запуск приложения
initWorkspace();
