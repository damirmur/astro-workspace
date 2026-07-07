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

		// 1. НАСТРОЙКА СИСТЕМНОЙ КОЛЛЕКЦИИ USERS (Возвращаем роли сотрудников и ИИ)
		usersColl, err := app.FindCollectionByNameOrId("users")
		if err == nil {
			if usersColl.Fields.GetByName("role") == nil {
				usersColl.Fields.Add(&core.SelectField{
					Name:     "role",
					Required: true,
					Values:   []string{"admin", "user", "paid_user", "guest", "ai_agent"},
				})
				if err := app.Save(usersColl); err != nil {
					return err
				}
				log.Println("Коллекция 'users' успешно восстановлена с полем 'role'!")
			}
		}

		// 2. КОЛЛЕКЦИЯ ТИПОВ ЗАДАЧ
		typesColl, err := app.FindCollectionByNameOrId("task_types")
		if err != nil {
			typesColl = core.NewBaseCollection("task_types")
			typesColl.ListRule = types.Pointer("")
			typesColl.ViewRule = types.Pointer("")

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

		// 3. КОЛЛЕКЦИЯ СТАТУСОВ
		statusesColl, err := app.FindCollectionByNameOrId("task_statuses")
		if err != nil {
			statusesColl = core.NewBaseCollection("task_statuses")
			statusesColl.ListRule = types.Pointer("")
			statusesColl.ViewRule = types.Pointer("")

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

		// 4. КОЛЛЕКЦИЯ ПРОЕКТОВ
		projectsColl, err := app.FindCollectionByNameOrId("projects")
		if err != nil {
			projectsColl = core.NewBaseCollection("projects")
			projectsColl.ListRule = types.Pointer("")
			projectsColl.ViewRule = types.Pointer("")
			projectsColl.CreateRule = types.Pointer("")
			projectsColl.UpdateRule = types.Pointer("")
			projectsColl.DeleteRule = types.Pointer("")

			projectsColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.SelectField{Name: "status", Required: true, Values: []string{"backlog", "in_progress", "done", "archive"}},
				&core.TextField{Name: "repo_url"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)
			if err := app.Save(projectsColl); err != nil {
				return err
			}
		}

		// 5. КОЛЛЕКЦИЯ ЗАДАЧ (С Исполнителями)
		tasksColl, err := app.FindCollectionByNameOrId("tasks")
		if err != nil {
			tasksColl = core.NewBaseCollection("tasks")
			tasksColl.ListRule = types.Pointer("")
			tasksColl.ViewRule = types.Pointer("")
			tasksColl.CreateRule = types.Pointer("")
			tasksColl.UpdateRule = types.Pointer("")
			tasksColl.DeleteRule = types.Pointer("")

			tasksColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.RelationField{Name: "status", CollectionId: statusesColl.Id, MaxSelect: 1, Required: true},
				&core.RelationField{Name: "type", CollectionId: typesColl.Id, MaxSelect: 1, Required: true},
				&core.RelationField{Name: "project", CollectionId: projectsColl.Id, MaxSelect: 1, CascadeDelete: true},
				&core.SelectField{Name: "priority", Required: true, Values: []string{"low", "medium", "high", "critical"}},
				&core.DateField{Name: "deadline"},

				// ВОЗВРАЩАЕМ НАЗНАЧЕНИЕ НА ЮЗЕРА / АГЕНТА
				&core.RelationField{Name: "assigned_to", CollectionId: usersColl.Id, MaxSelect: 1},

				&core.JSONField{Name: "astro_coordinates"},
				&core.EditorField{Name: "notes"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)

			if err := app.Save(tasksColl); err != nil {
				return err
			}

			tasksColl.Fields.Add(
				&core.RelationField{Name: "parent_task", CollectionId: tasksColl.Id, MaxSelect: 1},
				&core.RelationField{Name: "depends_on", CollectionId: tasksColl.Id, MaxSelect: 99},
			)
			if err := app.Save(tasksColl); err != nil {
				return err
			}
			log.Println("Коллекции воркфлоу восстановлены!")
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
