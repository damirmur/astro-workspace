-- 1. Полная очистка таблиц перед импортом
DELETE FROM `tasks`;
DELETE FROM `projects`;
DELETE FROM `task_statuses`;
DELETE FROM `task_types`;

-- 2. Регистрируем базовые статусы (убраны колонки дат, так как PocketBase ведет их на своем уровне)
INSERT INTO `task_statuses` (`id`, `name`, `key`, `weight`, `color`) VALUES
('stat_todo_fixed', 'TODO', 'todo', 1, '#fbbf24'),
('stat_inpr_fixed', 'In Progress', 'in_progress', 2, '#60a5fa'),
('stat_done_fixed', 'Done', 'done', 3, '#34d399'),
('stat_canc_fixed', 'Canceled', 'canceled', 3, '#64748b');

-- 3. Регистрируем базовые типы задач
INSERT INTO `task_types` (`id`, `name`, `key`, `icon`) VALUES
('type_epic_fixed', 'Эпик', 'epic', '📂'),
('type_feat_fixed', 'Фича', 'feature', '✨'),
('type_step_fixed', 'Шаг', 'step', '📜'),
('type_bug_fixed',  'Баг',  'bug',  '🪲');

-- 4. Создаем глобальный проект
INSERT INTO `projects` (`id`, `title`, `status`, `entities`)
VALUES ('proj_go_wksp_01', 'Разработка проекта на Go', 'in_progress', '[]');

-- 5. Забиваем иерархическое дерево задач разработки
-- Вместо NULL для корневых элементов используем пустую строку '', чтобы обойти NOT NULL ограничение

-- Корневой Эпик
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `astro_coordinates`, `notes`) VALUES
('task_epic_mvp01', 'Разработка Workspace (MVP)', 'stat_inpr_fixed', 'type_epic_fixed', 'proj_go_wksp_01', '', '[]', '{"context":"IT-Development"}', '<h1>Глобальный Эпик</h1>');

-- Фичи
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `astro_coordinates`, `notes`) VALUES
('task_feat_back02', 'Создание бэкенда на Go и PocketBase', 'stat_inpr_fixed', 'type_feat_fixed', 'proj_go_wksp_01', 'task_epic_mvp01', '[]', '{"context":"IT-Development"}', '<p>Серверная часть</p>'),
('task_feat_fron03', 'Верстка и логика интерактивного дерева на клиенте', 'stat_todo_fixed', 'type_feat_fixed', 'proj_go_wksp_01', 'task_epic_mvp01', '[]', '{"context":"IT-Development"}', '<p>Клиентский интерфейс</p>');

-- Подзадачи для Бэкенда
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `astro_coordinates`, `notes`) VALUES
('task_step_sch001', 'Шаг 1: Настройка схемы коллекций (projects, tasks)', 'stat_done_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_back02', '[]', '{"context":"IT-Development"}', 'Выполнено успешно'),
('task_step_rel002', 'Шаг 2: Реализация двухэтапного создания self-relation связей', 'stat_done_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_back02', '["task_step_sch001"]', '{"context":"IT-Development"}', 'Решено через транзакции Go'),
('task_step_rt0003', 'Шаг 3: Включение раздачи статических файлов через apis.Static', 'stat_inpr_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_back02', '["task_step_rel002"]', '{"context":"IT-Development"}', 'В процессе кодинга');

-- Подзадачи для Фронтенда
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `astro_coordinates`, `notes`) VALUES
('task_step_sdk004', 'Шаг 1: Локальное подключение pocketbase.umd.js', 'stat_done_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_fron03', '[]', '{"context":"IT-Development"}', 'Заменено на jsdelivery верную сборку'),
('task_step_tree05', 'Шаг 2: Написание рекурсивной функции buildTree в app.js', 'stat_todo_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_fron03', '["task_step_sdk004"]', '{"context":"IT-Development"}', 'Ждет завершения бэкенда'),
('task_step_canc06', 'Шаг 3: [Устарело] Поддержка старых HTTPS сессий cURL', 'stat_canc_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_fron03', '["task_step_tree05"]', '{"context":"IT-Development"}', 'Фича отменена, так как перешли на типы');
