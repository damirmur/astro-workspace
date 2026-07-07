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

		// 1. Создаем коллекцию TASK_TYPES (Динамические типы задач)
		typesColl, err := app.FindCollectionByNameOrId("task_types")
		if err != nil {
			typesColl = core.NewBaseCollection("task_types")
			typesColl.ListRule = types.Pointer("")
			typesColl.ViewRule = types.Pointer("")
			typesColl.CreateRule = types.Pointer("")
			typesColl.UpdateRule = types.Pointer("")

			typesColl.Fields.Add(
				&core.TextField{Name: "name", Required: true}, // "Эпик", "Фича"...
				&core.TextField{Name: "key", Required: true},  // "epic", "feature", "step", "bug"
				&core.TextField{Name: "icon", Required: true}, // "📂", "✨", "📜", "🪲"
			)

			if err := app.Save(typesColl); err != nil {
				return err
			}
			log.Println("Коллекция 'task_types' создана!")

			// Заполняем дефолтными системными типами
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
			log.Println("Системные типы задач импортированы!")
		}

		// 2. Создаем коллекцию TASK_STATUSES (Динамические статусы)
		statusesColl, err := app.FindCollectionByNameOrId("task_statuses")
		if err != nil {
			statusesColl = core.NewBaseCollection("task_statuses")
			statusesColl.ListRule = types.Pointer("")
			statusesColl.ViewRule = types.Pointer("")
			statusesColl.CreateRule = types.Pointer("")
			statusesColl.UpdateRule = types.Pointer("")

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
			log.Println("Базовые статусы импортированы!")
		}

		// 3. Создаем коллекцию ENTITIES
		entitiesColl, err := app.FindCollectionByNameOrId("entities")
		if err != nil {
			entitiesColl = core.NewBaseCollection("entities")
			entitiesColl.ListRule = types.Pointer("")
			entitiesColl.ViewRule = types.Pointer("")
			entitiesColl.CreateRule = types.Pointer("")

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

		// 4. Создаем коллекцию PROJECTS
		projectsColl, err := app.FindCollectionByNameOrId("projects")
		if err != nil {
			projectsColl = core.NewBaseCollection("projects")
			projectsColl.ListRule = types.Pointer("")
			projectsColl.ViewRule = types.Pointer("")
			projectsColl.CreateRule = types.Pointer("")

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

		// 5. Создаем коллекцию TASKS (Расширенная под типы и зависимости)
		tasksColl, err := app.FindCollectionByNameOrId("tasks")
		if err != nil {
			tasksColl = core.NewBaseCollection("tasks")
			tasksColl.ListRule = types.Pointer("")
			tasksColl.ViewRule = types.Pointer("")
			tasksColl.CreateRule = types.Pointer("")
			tasksColl.UpdateRule = types.Pointer("")

			tasksColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.RelationField{Name: "status", CollectionId: statusesColl.Id, MaxSelect: 1, Required: true},

				// ТЕПЕРЬ У ЗАДАЧИ ЕСТЬ СВЯЗЬ НА ТИП (Эпик, Фича...)
				&core.RelationField{Name: "type", CollectionId: typesColl.Id, MaxSelect: 1, Required: true},

				&core.RelationField{
					Name:          "project",
					CollectionId:  projectsColl.Id,
					MaxSelect:     1,
					CascadeDelete: true,
				}, &core.RelationField{Name: "entity", CollectionId: entitiesColl.Id, MaxSelect: 1},
				&core.JSONField{Name: "astro_coordinates"},
				&core.FileField{Name: "attachments", MaxSelect: 10},
				&core.EditorField{Name: "notes"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)

			if err := app.Save(tasksColl); err != nil {
				return err
			}

			// Второй этап — добавляем связи на саму себя (parent_task Иdepends_on)
			tasksColl.Fields.Add(
				&core.RelationField{Name: "parent_task", CollectionId: tasksColl.Id, MaxSelect: 1},

				// МАГИЯ ПОСЛЕДОВАТЕЛЬНОСТИ: Список задач, от которых зависит текущая
				&core.RelationField{Name: "depends_on", CollectionId: tasksColl.Id, MaxSelect: 99},
			)

			if err := app.Save(tasksColl); err != nil {
				return err
			}
			log.Println("Коллекция 'tasks' успешно создана со связями последовательности выполнения!")
		}

		// 6. Создаем коллекцию AI_SESSIONS
		_, err = app.FindCollectionByNameOrId("ai_sessions")
		if err != nil {
			aiSessions := core.NewBaseCollection("ai_sessions")
			aiSessions.ListRule = types.Pointer("")
			aiSessions.ViewRule = types.Pointer("")
			aiSessions.CreateRule = types.Pointer("")

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

		// Раздаем статику pb_public
		e.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
}
