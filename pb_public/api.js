// Загрузка метаданных (статусы и типы задач)
async function fetchMeta() {
    globalStatuses = await pb.collection('task_statuses').getFullList({ sort: 'weight' });
    globalTypes = await pb.collection('task_types').getFullList();
}

// Загрузка списка проектов
async function fetchProjects() {
    return await pb.collection('projects').getFullList({ sort: '-created' });
}

// Создание нового проекта
async function apiCreateProject(title) {
    return await pb.collection('projects').create({ title: title, status: 'in_progress' });
}

// Загрузка всех задач проекта со связями
async function fetchTasksForProject(projectId) {
    return await pb.collection('tasks').getFullList({
        filter: `project = "${projectId}"`,
        sort: 'created',
        expand: 'status,type,depends_on'
    });
}

// Создание новой задачи/подзадачи
async function apiCreateTask(title, typeId, parentId) {
    return await pb.collection('tasks').create({
        title: title,
        status: globalStatuses[0]?.id, // Первый статус — обычно TODO
        type: typeId,
        project: currentProjectId,
        parent_task: parentId || null,
        astro_coordinates: { "context": "IT-Development" },
        notes: "<p>Создано через модульный интерфейс.</p>"
    });
}

// Добавление линейной зависимости между задачами
async function apiAddDependency(taskId, blockingTaskId) {
    return await pb.collection('tasks').update(taskId, {
        "depends_on+": blockingTaskId
    });
}

// Обновление статуса в базе данных
async function apiUpdateTaskStatus(taskId, newStatusId) {
    return await pb.collection('tasks').update(taskId, { status: newStatusId });
}
// Функция сборки структуры всего проекта в один цельный JSON-объект
async function apiGetProjectSnapshot(projectId) {
    // 1. Получаем метаданные самого проекта
    const project = await pb.collection('projects').getOne(projectId);
    
    // 2. Получаем все задачи этого проекта, раскрывая их типы и статусы
    const tasks = await pb.collection('tasks').getFullList({
        filter: `project = "${projectId}"`,
        expand: 'status,type'
    });

    // 3. Формируем чистый массив задач, вычищая локальные ID статусов/типов 
    // и заменяя их на универсальные текстовые ключи (key) для переносимости
    const cleanTasks = tasks.map(task => {
        return {
            id: task.id, // Оставляем оригинальный ID задачи для сохранения связей parent_task и depends_on
            title: task.title,
            parent_task: task.parent_task || "",
            depends_on: task.depends_on || [],
            astro_coordinates: task.astro_coordinates || {},
            notes: task.notes || "",
            status_key: task.expand?.status?.key || "todo", // Экспортируем ключ статуса ('todo', 'canceled'...)
            type_key: task.expand?.type?.key || "step"      // Экспортируем ключ типа ('epic', 'bug'...)
        };
    });

    // 4. Возвращаем единый слепок проекта
    return {
        version: "1.0",
        project_title: project.title,
        project_status: project.status || "in_progress",
        tasks: cleanTasks
    };
}

// Заготовка для функции импорта (будет вызывать API последовательно)
async function apiImportProjectSnapshot(snapshotData) {
    // Сюда мы передадим распарсенный JSON, функция будет создавать проект и пошагово восстанавливать задачи.
    // Эту логику мы пропишем на следующем шаге вместе с UI-обработчиком.
    return snapshotData;
}
// Очистка всех зависимостей у задачи
async function apiClearDependencies(taskId) {
    return await pb.collection('tasks').update(taskId, {
        "depends_on": [] // Сбрасываем массив в ноль
    });
}

// Сетевой запрос авторизации по email/паролю
async function apiAuthUser(email, password) {
    // Метод authWithPassword проверяет данные, сохраняет токен локально и возвращает объект сессии
    return await pb.collection('users').authWithPassword(email, password);
}

// Сетевой сброс токена при выходе
function apiLogoutUser() {
    pb.authStore.clear(); // Полностью вычищаем токены из памяти браузера
}
