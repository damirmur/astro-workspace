const pb = new PocketBase('http://localhost:8090');
let currentProjectId = "";

// 1. Загрузка всех проектов
async function loadProjects() {
    try {
        const projects = await pb.collection('projects').getFullList({ sort: '-created' });
        const selector = document.getElementById('project-selector');
        selector.innerHTML = '';

        if (projects.length === 0) {
            selector.innerHTML = '<option value="">Нет активных проектов</option>';
            document.getElementById('current-project-name').innerText = 'Нет проектов';
            document.getElementById('workspace-tree').innerHTML = '<div class="empty-state"><p>Создайте ваш первый глобальный проект в панели справа!</p></div>';
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
        
        loadTasksForProject(currentProjectId);
    } catch (err) {
        console.error("Ошибка загрузки проектов:", err);
    }
}

// 2. Смена проекта
function selectProject() {
    const selector = document.getElementById('project-selector');
    currentProjectId = selector.value;
    document.getElementById('current-project-name').innerText = "📂 Проект: " + selector.options[selector.selectedIndex].text;
    loadTasksForProject(currentProjectId);
}

// 3. Создание проекта
async function createNewProject() {
    const input = document.getElementById('new-project-title');
    const title = input.value.trim();
    if (!title) return alert("Введите название проекта!");

    try {
        const newProj = await pb.collection('projects').create({
            title: title,
            status: 'in_progress'
        });
        input.value = '';
        currentProjectId = newProj.id;
        await loadProjects();
    } catch (err) {
        alert("Ошибка создания проекта: " + err.message);
    }
}

// 4. Загрузка задач проекта
async function loadTasksForProject(projectId) {
    try {
        const records = await pb.collection('tasks').getFullList({
            filter: `project = "${projectId}"`,
            sort: 'created'
        });

        if (records.length === 0) {
            document.getElementById('workspace-tree').innerHTML = `
                <div class="empty-state">
                    <p>В этом проекте еще нет задач.</p>
                    <button class="btn btn-primary" onclick="createSubtask(event, '')">Создать первую корневую задачу</button>
                </div>`;
            return;
        }

        const treeData = buildTree(records);
        document.getElementById('workspace-tree').innerHTML = renderTreeHtml(treeData);
    } catch (err) {
        document.getElementById('workspace-tree').innerHTML = `<p style="color:#ef4444;">Ошибка: ${err.message}</p>`;
    }
}

// 5. Создание подзадачи
async function createSubtask(event, parentId) {
    event.stopPropagation();
    if (!currentProjectId) return alert("Сначала выберите или создайте проект!");

    const title = prompt(parentId ? "Введите название подзадачи/фичи:" : "Введите название корневого Эпика:");
    if (!title) return;

    try {
        await pb.collection('tasks').create({
            title: title,
            status: 'todo',
            project: currentProjectId,
            parent_task: parentId || null,
            astro_coordinates: { "context": "IT-Development" },
            notes: "<p>Создано через веб-интерфейс.</p>"
        });
        
        loadTasksForProject(currentProjectId);
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
}

function toggleDetails(id) {
    document.getElementById(`details-${id}`).classList.toggle('active');
}

function buildTree(list, parentId = null) {
    let branch = [];
    list.forEach(item => {
        if (item.parent_task === parentId || (!parentId && !item.parent_task)) {
            const children = buildTree(list, item.id);
            if (children.length) item.children = children;
            branch.push(item);
        }
    });
    return branch;
}

function renderTreeHtml(nodes) {
    let html = '';
    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const statusClass = `status-${node.status || 'todo'}`;
        
        html += `<div class="task-container">`;
        html += `
            <div class="task-card">
                <div class="task-header">
                    <div class="task-title" onclick="toggleDetails('${node.id}')">
                        ${hasChildren ? '▼' : '•'} <span>${node.title}</span>
                    </div>
                    <div class="task-actions">
                        <span class="status-badge ${statusClass}">${node.status || 'todo'}</span>
                        <button class="btn-subtask" onclick="createSubtask(event, '${node.id}')">+ Подзадача</button>
                    </div>
                </div>
                <div class="task-details" id="details-${node.id}">
                    <div>${node.notes || '<i>Описания нет</i>'}</div>
                    ${node.astro_coordinates ? `<pre>${JSON.stringify(node.astro_coordinates, null, 2)}</pre>` : ''}
                </div>
            </div>
        `;
        if (hasChildren) html += `<div class="tree-node">${renderTreeHtml(node.children)}</div>`;
        html += `</div>`;
    });
    return html;
}

// Запуск при загрузке страницы
loadProjects();
