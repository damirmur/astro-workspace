// Полноценная инициализация воркфлоу с защитой от пустых объектов сессии
async function initWorkspace() {
    const loginOverlay = document.getElementById('login-overlay');
    const mainWorkspace = document.getElementById('main-workspace');

    // 1. Проверяем валидность токена в памяти SDK
    if (!pb.authStore.isValid) {
        loginOverlay.style.display = 'flex';
        mainWorkspace.style.display = 'none';
        return;
    }

    // 2. Если токен есть — открываем рабочую область и скрываем форму входа
    loginOverlay.style.display = 'none';
    mainWorkspace.style.display = 'block';

    // БЕЗОПАСНЫЙ ВЫВОД ИМЕНИ И РОЛИ (Защита от undefined)
    const currentModel = pb.authStore.model;
    const userEmail = currentModel ? currentModel.email : "admin@system.local";
    // Если у пользователя нет поля role (например, зашел Суперадмин), принудительно ставим ADMIN
    const userRole = (currentModel && currentModel.role) ? currentModel.role : "admin";

    document.getElementById('user-display-name').innerText = userEmail;
    document.getElementById('user-display-role').innerText = userRole.toUpperCase();

    try {
        // 3. Загружаем метаданные, проекты и задачи из SQLite
        await fetchMeta();
        const projects = await fetchProjects();
        const selector = document.getElementById('project-selector');
        selector.innerHTML = '';

        if (projects.length === 0) {
            selector.innerHTML = '<option value="">Нет активных проектов</option>';
            document.getElementById('current-project-name').innerText = 'Нет проектов';
            document.getElementById('workspace-tree').innerHTML = '<div class="empty-state"><p>Создайте первый проект!</p></div>';
            document.getElementById('root-task-btn').style.display = 'none';
            return;
        }

        projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = p.title;
            selector.appendChild(opt);
        });

        // Корректный выбор первого проекта из массива
        if (!currentProjectId || !projects.some(p => p.id === currentProjectId)) {
            currentProjectId = projects[0].id; // Фикс: строго берем первый элемент по индексу [0]!
        }

        selector.value = currentProjectId;
        document.getElementById('current-project-name').innerText = "📂 Проект: " + selector.options[selector.selectedIndex].text;
        document.getElementById('root-task-btn').style.display = 'block';
        
        // Рендерим дерево задач выбранного проекта
        await renderProjectWorkspace(currentProjectId);
    } catch (err) {
        console.error("Ошибка загрузки данных бэклога:", err);
        document.getElementById('workspace-tree').innerHTML = `<p style="color:#ef4444;">Ошибка API: ${err.message}</p>`;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    try {
        await apiAuthUser(email, pass);
        await initWorkspace();
    } catch (err) {
        alert("🔒 Ошибка авторизации:\n" + err.message);
    }
}

function handleLogout() {
    apiLogoutUser();
    // Принудительно чистим localStorage, чтобы сессия стерлась окончательно
    localStorage.removeItem('pocketbase_auth');
    initWorkspace();
}
