package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {

		// 1. НАСТРОЙКА СИСТЕМНОЙ КОЛЛЕКЦИИ USERS (Добавляем Роль)
		usersColl, err := app.FindCollectionByNameOrId("users")
		if err == nil {
			// Проверяем, есть ли уже поле role, если нет — добавляем
			if usersColl.Fields.GetByName("role") == nil {
				usersColl.Fields.Add(&core.SelectField{
					Name:     "role",
					Required: true,
					Values:   []string{"admin", "user", "paid_user", "guest", "ai_agent"},
				})
				if err := app.Save(usersColl); err != nil {
					return err
				}
				log.Println("Системная коллекция 'users' расширена полем 'role'!")
			}
		}

		// 2. Создаем коллекцию TASK_TYPES (Динамические типы задач)
		typesColl, err := app.FindCollectionByNameOrId("task_types")
		if err != nil {
			typesColl = core.NewBaseCollection("task_types")
			typesColl.ListRule = types.Pointer("")                               // Доступно всем
			typesColl.ViewRule = types.Pointer("")                               // Доступно всем
			typesColl.CreateRule = types.Pointer("@request.auth.role = 'admin'") // Только админ
			typesColl.UpdateRule = types.Pointer("@request.auth.role = 'admin'") // Только админ

			typesColl.Fields.Add(
				&core.TextField{Name: "name", Required: true},
				&core.TextField{Name: "key", Required: true},
				&core.TextField{Name: "icon", Required: true},
			)
			if err := app.Save(typesColl); err != nil {
				return err
			}

			defaultTypes := []map[string]string{
				{"name": "Эпик", "key": "epic", "icon": "📂"},
				{"name": "Фича", "key": "feature", "icon": "✨"},
				{"name": "Шаг", "key": "step", "icon": "📜"},
				{"name": "Баг", "key": "bug", "icon": "🪲"},
			}
			for _, t := range defaultTypes {
				record := core.NewRecord(typesColl)
				record.Set("name", t["name"])
				record.Set("key", t["key"])
				record.Set("icon", t["icon"])
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}

		// 3. Создаем коллекцию TASK_STATUSES (Динамические статусы)
		statusesColl, err := app.FindCollectionByNameOrId("task_statuses")
		if err != nil {
			statusesColl = core.NewBaseCollection("task_statuses")
			statusesColl.ListRule = types.Pointer("")
			statusesColl.ViewRule = types.Pointer("")
			statusesColl.CreateRule = types.Pointer("@request.auth.role = 'admin'")
			statusesColl.UpdateRule = types.Pointer("@request.auth.role = 'admin'")

			statusesColl.Fields.Add(
				&core.TextField{Name: "name", Required: true},
				&core.TextField{Name: "key", Required: true},
				&core.NumberField{Name: "weight", Required: true},
				&core.TextField{Name: "color"},
			)
			if err := app.Save(statusesColl); err != nil {
				return err
			}

			defaultStatuses := []map[string]any{
				{"name": "TODO", "key": "todo", "weight": 1, "color": "#fbbf24"},
				{"name": "In Progress", "key": "in_progress", "weight": 2, "color": "#60a5fa"},
				{"name": "Done", "key": "done", "weight": 3, "color": "#34d399"},
				{"name": "Canceled", "key": "canceled", "weight": 3, "color": "#64748b"},
			}
			for _, st := range defaultStatuses {
				record := core.NewRecord(statusesColl)
				record.Set("name", st["name"])
				record.Set("key", st["key"])
				record.Set("weight", st["weight"])
				record.Set("color", st["color"])
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}

		// 4. Создаем коллекцию ENTITIES
		entitiesColl, err := app.FindCollectionByNameOrId("entities")
		if err != nil {
			entitiesColl = core.NewBaseCollection("entities")
			entitiesColl.ListRule = types.Pointer("@request.auth.id != ''") // Только авторизованные
			entitiesColl.ViewRule = types.Pointer("@request.auth.id != ''")
			entitiesColl.CreateRule = types.Pointer("@request.auth.role = 'admin'") //Entities создает только админ

			entitiesColl.Fields.Add(
				&core.TextField{Name: "name", Required: true},
				&core.SelectField{Name: "type", Required: true, Values: []string{"human", "code_repo"}},
				&core.JSONField{Name: "astro_data"},
				&core.TextField{Name: "repo_url"},
			)
			if err := app.Save(entitiesColl); err != nil {
				return err
			}
		}

		// 5. Создаем коллекцию PROJECTS (Защищенная ролями)
		projectsColl, err := app.FindCollectionByNameOrId("projects")
		if err != nil {
			projectsColl = core.NewBaseCollection("projects")

			// Матрица доступа для Проектов:
			// Гость (без токена) не видит ничего. Авторизованный ИИ-агент или Пользователь видят проекты.
			// Создавать проекты ИИ-агентам запрещено (@request.auth.role != 'ai_agent')
			projectsColl.ListRule = types.Pointer("@request.auth.id != ''")
			projectsColl.ViewRule = types.Pointer("@request.auth.id != ''")
			projectsColl.CreateRule = types.Pointer("@request.auth.id != '' && @request.auth.role != 'ai_agent' && @request.auth.role != 'guest'")
			projectsColl.UpdateRule = types.Pointer("@request.auth.role = 'admin' || @request.auth.role = 'user' || @request.auth.role = 'paid_user'")
			projectsColl.DeleteRule = types.Pointer("@request.auth.role = 'admin'") // Удаляет только админ-человек

			projectsColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.SelectField{Name: "status", Required: true, Values: []string{"backlog", "in_progress", "done", "archive"}},
				&core.RelationField{Name: "entities", CollectionId: entitiesColl.Id, MaxSelect: 99},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)
			if err := app.Save(projectsColl); err != nil {
				return err
			}
		}

		// 6. Создаем коллекцию TASKS (С графом исполнителей и защитой)
		tasksColl, err := app.FindCollectionByNameOrId("tasks")
		if err != nil {
			tasksColl = core.NewBaseCollection("tasks")

			// Матрица доступа для Задач:
			// Чтение разрешено всем авторизованным.
			// Создавать задачи могут все, КРОМЕ гостей. ИИ-агент может создавать подзадачи.
			// Удаление запрещено ИИ-агентам полностью.
			tasksColl.ListRule = types.Pointer("@request.auth.id != ''")
			tasksColl.ViewRule = types.Pointer("@request.auth.id != ''")
			tasksColl.CreateRule = types.Pointer("@request.auth.id != '' && @request.auth.role != 'guest'")
			tasksColl.UpdateRule = types.Pointer("@request.auth.id != '' && @request.auth.role != 'guest'")
			tasksColl.DeleteRule = types.Pointer("@request.auth.role = 'admin' || @request.auth.role = 'user'")

			tasksColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.RelationField{Name: "status", CollectionId: statusesColl.Id, MaxSelect: 1, Required: true},
				&core.RelationField{Name: "type", CollectionId: typesColl.Id, MaxSelect: 1, Required: true},
				&core.RelationField{Name: "project", CollectionId: projectsColl.Id, MaxSelect: 1, CascadeDelete: true},
				&core.RelationField{Name: "entity", CollectionId: entitiesColl.Id, MaxSelect: 1},

				// ГИБРИДНАЯ ОРКЕСТРАЦИЯ: Назначаем задачу на пользователя (Человека или ИИ-агента)
				&core.RelationField{Name: "assigned_to", CollectionId: usersColl.Id, MaxSelect: 1},

				&core.JSONField{Name: "astro_coordinates"},
				&core.FileField{Name: "attachments", MaxSelect: 10},
				&core.EditorField{Name: "notes"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)

			if err := app.Save(tasksColl); err != nil {
				return err
			}

			// Второй этап — self-relations
			tasksColl.Fields.Add(
				&core.RelationField{Name: "parent_task", CollectionId: tasksColl.Id, MaxSelect: 1},
				&core.RelationField{Name: "depends_on", CollectionId: tasksColl.Id, MaxSelect: 99},
			)
			if err := app.Save(tasksColl); err != nil {
				return err
			}
			log.Println("Коллекция 'tasks' защищена ролевой моделью!")
		}

		// 7. Создаем коллекцию AI_SESSIONS
		_, err = app.FindCollectionByNameOrId("ai_sessions")
		if err != nil {
			aiSessions := core.NewBaseCollection("ai_sessions")
			aiSessions.ListRule = types.Pointer("@request.auth.id != ''")
			aiSessions.ViewRule = types.Pointer("@request.auth.id != ''")
			aiSessions.CreateRule = types.Pointer("@request.auth.role = 'admin' || @request.auth.role = 'ai_agent' || @request.auth.role = 'paid_user'")

			aiSessions.Fields.Add(
				&core.RelationField{Name: "task", CollectionId: tasksColl.Id, MaxSelect: 1},
				&core.TextField{Name: "model"},
				&core.TextField{Name: "system_prompt"},
				&core.JSONField{Name: "input_data"},
				&core.JSONField{Name: "output_result"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)
			if err := app.Save(aiSessions); err != nil {
				return err
			}
		}

		// Раздаем статику
		e.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
}
