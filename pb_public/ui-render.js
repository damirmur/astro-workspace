let collapsedNodesMap = {}; 
let currentProjectRecords = []; 

// 1. Загрузка данных проекта с раскрытием Исполнителей (assigned_to)
async function renderProjectWorkspace(projectId) {
    try {
        const projMeta = await fetchProjectMeta(projectId);
        const ghLink = document.getElementById('project-github-link');
        if (projMeta.repo_url) {
            ghLink.href = projMeta.repo_url;
            ghLink.style.display = 'flex';
        } else {
            ghLink.style.display = 'none';
        }

        // Качаем список пользователей перед рендером
        await fetchAllUsers();

        // Тянем из базы полный список задач и раскрываем объект исполнителя assigned_to
        currentProjectRecords = await pb.collection('tasks').getFullList({
            filter: `project = "${projectId}"`,
            sort: 'created',
            expand: 'status,type,depends_on,assigned_to' 
        });
        
        applyFilters();
    } catch (err) {
        document.getElementById('workspace-tree').innerHTML = `<p style="color:#ef4444;">Ошибка рендера: ${err.message}</p>`;
    }
}

// 2. Применение интерактивных фильтров бэклога (С исправленной логикой для критических багов)
function applyFilters() {
    const hideDone = document.getElementById('filter-hide-done').checked;
    const onlyCritical = document.getElementById('filter-only-critical').checked;

    let filteredRecords = [...currentProjectRecords];

    // Фильтр А: Скрыть выполненные / отмененные
    if (hideDone) {
        filteredRecords = filteredRecords.filter(r => {
            const statusKey = r.expand?.status?.key || 'todo';
            return statusKey !== 'done' && statusKey !== 'canceled';
        });
    }

    // Фильтр Б: Только критические баги (С сохранением цепочки родителей, чтобы дерево не исчезало)
    if (onlyCritical) {
        // 1. Сначала находим ID всех критических багов в массиве
        const criticalBugIds = filteredRecords
            .filter(r => r.priority && r.priority.toLowerCase() === 'critical')
            .map(r => r.id);

        // 2. Функция рекурсивного сбора всех родителей для найденных багов
        const idsToShow = new Set(criticalBugIds);
        
        criticalBugIds.forEach(bugId => {
            let current = filteredRecords.find(r => r.id === bugId);
            while (current && current.parent_task) {
                idsToShow.add(current.parent_task);
                current = filteredRecords.find(r => r.id === current.parent_task);
            }
        });

        // 3. Оставляем в массиве только сами критические баги и их цепочку родителей для рендера
        filteredRecords = filteredRecords.filter(r => idsToShow.has(r.id));
    }

    if (filteredRecords.length === 0) {
        document.getElementById('workspace-tree').innerHTML = '<div class="empty-state"><p>Нет задач по выбранным фильтрам.</p></div>';
        return;
    }

    const treeData = buildTree(filteredRecords);
    document.getElementById('workspace-tree').innerHTML = renderTreeHtml(treeData, currentProjectRecords);
}


// 3. Динамический HTML-рендер с отображением исполнителей, приоритетов и дедлайнов
function renderTreeHtml(nodes, allRecords) {
    let html = '';
    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const typeIcon = node.expand?.type?.icon || "•";
        const typeKey = node.expand?.type?.key || "step";
        const currentStatusKey = node.expand?.status?.key || 'todo';
        const currentStatusId = node.status;
        
        // 1. Интерактивный Селектор Приоритета
        const priority = (node.priority || 'medium').toLowerCase();
        const prioritySelectHtml = `
            <select class="priority-select priority-${priority}" onclick="event.stopPropagation()" onchange="updateTaskPriority(event, '${node.id}', this.value)">
                <option value="low" ${priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${priority === 'high' ? 'selected' : ''}>High</option>
                <option value="critical" ${priority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
        `;

        // 2. Интерактивное Поле Дедлайна
        let deadlineInputValue = "";
        let isOverdue = false;
        if (node.deadline) {
            const d = new Date(node.deadline);
            deadlineInputValue = d.toISOString().split('T')[0];
            isOverdue = d < new Date() && currentStatusKey !== 'done' && currentStatusKey !== 'canceled';
        }
        const overdueClass = isOverdue ? 'overdue' : '';
        const deadlineHtml = `
            <input type="date" class="deadline-input ${overdueClass}" value="${deadlineInputValue}" 
                   onclick="event.stopPropagation()" 
                   onchange="updateTaskDeadline(event, '${node.id}', this.value)">
            ${isOverdue ? '<span style="color:#ef4444; font-size:10px; font-weight:bold; animation:pulse 2s infinite;">🔥 ИСТЕК!</span>' : ''}
        `;

        // 3. ИНТЕРАКТИВНЫЙ СЕЛЕКТОР ИСПОЛНИТЕЛЯ (Взамен текстовой плашки)
        const currentAssigneeId = node.assigned_to || "";
        const assigneeSelectHtml = `
            <select class="priority-select" style="background:#334155; color:#cbd5e1; border-color:#475569;" 
                    onclick="event.stopPropagation()" 
                    onchange="updateTaskAssignee(event, '${node.id}', this.value)">
                <option value="">🚫 Не назначен</option>
                ${globalUsers.map(u => `
                    <option value="${u.id}" ${u.id === currentAssigneeId ? 'selected' : ''}>
                        👤 ${u.email} (${(u.role || 'user').toUpperCase()})
                    </option>
                `).join('')}
            </select>
        `;

        let dependencyText = "";
        if (node.expand?.depends_on && node.expand.depends_on.length > 0) {
            dependencyText = `<div class="task-deps-list">⛓️ <b>Выполняется после:</b> ` + 
                node.expand.depends_on.map(d => `"${d.title}"`).join(', ') + `</div>`;
        }

        const isCollapsed = collapsedNodesMap[node.id] === true;
        const collapsedClass = isCollapsed ? 'collapsed' : '';

        html += `<div class="task-container">`;
        html += `
            <div class="task-card task-type-${typeKey}">
                <div class="task-header" onclick="${hasChildren ? `toggleNodeCollapse(event, '${node.id}')` : ''}" style="${hasChildren ? 'cursor:pointer;' : ''}">
                    <div class="task-title">
                        <span style="font-size:18px; margin-right:4px;">${typeIcon}</span> 
                        <span style="${isCollapsed ? 'color:#64748b;' : ''}">${node.title}</span>
                        ${prioritySelectHtml}
                        ${deadlineHtml}
                        ${assigneeSelectHtml} <!-- Вызов селектора исполнителя -->
                        <span class="btn-details-toggle" onclick="toggleDetails(event, '${node.id}')">Подробнее</span>
                    </div>
                    <div class="task-actions">
                        <button class="btn-dep" onclick="linkDependency(event, '${node.id}', ${JSON.stringify(allRecords).replace(/"/g, '&quot;')})">⛓️ Зависимость</button>
                        <select class="status-select status-${currentStatusKey}" onclick="event.stopPropagation()" onchange="updateTaskStatus(event, '${node.id}', this.value)">
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
        if (hasChildren) {
            html += `<div class="tree-node ${collapsedClass}" id="node-block-${node.id}">${renderTreeHtml(node.children, allRecords)}</div>`;
        }
        html += `</div>`;
    });
    return html;
}
