// Инициализация PocketBase
const pb = new PocketBase('http://localhost:8090');

// Глобальное состояние приложения (загружается из SQLite)
let currentProjectId = "";
let globalStatuses = []; 
let globalTypes = [];

// Справочник весов базовых статусов на случай сбоя
const STATUS_WEIGHTS = { "todo": 1, "in_progress": 2, "done": 3 };
