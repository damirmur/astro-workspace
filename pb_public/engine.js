// Построение иерархического дерева из плоского массива записей PocketBase
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

// Рекурсивный поиск узла в дереве по его ID
function findNodeById(nodes, id) {
    for (let node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

// ПРОВЕРКА СНИЗУ ВВЕРХ: Есть ли подзадачи со статусом ниже целевого веса?
function hasSubtasksWithLowerStatus(node, targetWeight) {
    if (!node.children || node.children.length === 0) return false;
    for (let child of node.children) {
        const childWeight = child.expand?.status?.weight || 1;
        if (childWeight < targetWeight) return true; 
        if (hasSubtasksWithLowerStatus(child, targetWeight)) return true;
    }
    return false;
}

// ПРОВЕРКА ПОСЛЕДОВАТЕЛЬНОСТИ: Завершены ли задачи, от которых зависит текущая?
function getBlockingTask(node, records) {
    // Если у текущей задачи нет зависимостей — она не заблокирована
    if (!node.depends_on || node.depends_on.length === 0) return null;

    for (let blockingId of node.depends_on) {
        // Ищем в базе данных ту задачу, которая должна быть выполнена ДО текущей
        const predecessor = records.find(r => r.id === blockingId);
        
        if (predecessor) {
            const predecessorWeight = predecessor.expand?.status?.weight || 1;
            
            // Если предшественник еще НЕ ЗАВЕРШЕН (его вес меньше 3, т.е. TODO или In Progress)
            // то он блокирует текущую задачу!
            if (predecessorWeight < 3) {
                return predecessor; // Возвращаем задачу-блокиратор
            }
        }
    }
    return null; // Блокировок нет, путь свободен
}
