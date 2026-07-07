-- 1. Очистка таблиц перед импортом
DELETE FROM `tasks`;
DELETE FROM `projects`;
DELETE FROM `task_statuses`;
DELETE FROM `task_types`;

-- 2. Регистрируем базовые статусы
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
INSERT INTO `projects` (`id`, `title`, `status`, `repo_url`, `created`, `updated`) VALUES 
('proj_go_wksp_01', 'Разработка проекта на Go', 'in_progress', 'https://github.com', datetime('now'), datetime('now'));

-- 5. Забиваем иерархическое дерево задач разработки с приоритетами, дедлайнами и ИСПОЛНИТЕЛЯМИ (assigned_to)

-- Корневой Эпик (Назначаем на нашего worker@test.ru через подзапрос к users)
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `priority`, `deadline`, `assigned_to`, `astro_coordinates`, `notes`) VALUES
('task_epic_mvp01', 'Разработка Workspace (MVP)', 'stat_inpr_fixed', 'type_epic_fixed', 'proj_go_wksp_01', '', '[]', 'high', '2026-07-31 18:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', '<h1>Глобальный Эпик</h1>');

-- Фича 1: Бэкенд
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `priority`, `deadline`, `assigned_to`, `astro_coordinates`, `notes`) VALUES
('task_feat_back02', 'Создание бэкенда на Go и PocketBase', 'stat_inpr_fixed', 'type_feat_fixed', 'proj_go_wksp_01', 'task_epic_mvp01', '[]', 'high', '2026-07-15 18:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', '<p>Серверная часть</p>');

-- Фича 2: Фронтенд
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `priority`, `deadline`, `assigned_to`, `astro_coordinates`, `notes`) VALUES
('task_feat_fron03', 'Верстка и логика интерактивного дерева на клиенте', 'stat_todo_fixed', 'type_feat_fixed', 'proj_go_wksp_01', 'task_epic_mvp01', '[]', 'medium', '2026-07-25 18:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', '<p>Клиентский интерфейс</p>');

-- Подзадачи для Бэкенда
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `priority`, `deadline`, `assigned_to`, `astro_coordinates`, `notes`) VALUES
('task_step_sch001', 'Шаг 1: Настройка схемы коллекций (projects, tasks)', 'stat_done_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_back02', '[]', 'medium', '2026-07-10 12:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', 'Выполнено успешно'),
('task_step_rel002', 'Шаг 2: Реализация двухэтапного создания self-relation связей', 'stat_done_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_back02', '["task_step_sch001"]', 'high', '2026-07-12 12:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', 'Решено через транзакции Go'),
('task_step_rt0003', 'Шаг 3: Включение раздачи статических файлов через apis.Static', 'stat_inpr_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_back02', '["task_step_rel002"]', 'medium', '2026-07-15 18:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', 'В процессе кодинга');

-- Критический Баг
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `priority`, `deadline`, `assigned_to`, `astro_coordinates`, `notes`) VALUES
('task_bug_oops07', '[Bug] Не работает роутер на последней версии PocketBase', 'stat_todo_fixed', 'type_bug_fixed', 'proj_go_wksp_01', 'task_feat_back02', '[]', 'critical', '2026-07-08 10:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', '<p>Ошибка компилятора в apis.StaticDirectoryHandler</p>');

-- Подзадачи для Фронтенда
INSERT INTO `tasks` (`id`, `title`, `status`, `type`, `project`, `parent_task`, `depends_on`, `priority`, `deadline`, `assigned_to`, `astro_coordinates`, `notes`) VALUES
('task_step_sdk004', 'Шаг 1: Локальное подключение pocketbase.umd.js', 'stat_done_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_fron03', '[]', 'low', '2026-07-18 12:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', 'Заменено на верную сборку'),
('task_step_tree05', 'Шаг 2: Написание рекурсивной функции buildTree в app.js', 'stat_todo_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_fron03', '["task_step_sdk004"]', 'medium', '2026-07-22 12:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', 'Ждет завершения бэкенда'),
('task_step_canc06', 'Шаг 3: [Устарело] Поддержка старых HTTPS сессий cURL', 'stat_canc_fixed', 'type_step_fixed', 'proj_go_wksp_01', 'task_feat_fron03', '["task_step_tree05"]', 'low', '2026-07-25 18:00:00', (SELECT id FROM users LIMIT 1), '{"context":"IT-Development"}', 'Фича отменена');
