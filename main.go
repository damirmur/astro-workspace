package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tools/types"
)

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		
		// 1. Создаем коллекцию ENTITIES (Люди или Репозитории)
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
			log.Println("Коллекция 'entities' создана!")
		}

		// 2. Создаем коллекцию PROJECTS (Глобальные проекты)
		projectsColl, err := app.FindCollectionByNameOrId("projects")
		if err != nil {
			projectsColl = core.NewBaseCollection("projects")
			projectsColl.ListRule = types.Pointer("")   
			projectsColl.ViewRule = types.Pointer("")   
			projectsColl.CreateRule = types.Pointer("") 

			projectsColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.SelectField{Name: "status", Required: true, Values: []string{"backlog", "in_progress", "done", "archive"}},
				&core.RelationField{
					Name:         "entities",
					CollectionId: entitiesColl.Id,
					MaxSelect:    99, 
				},
			)

			if err := app.Save(projectsColl); err != nil {
				return err
			}
			log.Println("Коллекция 'projects' создана!")
		}

		// 3. Создаем коллекцию TASKS (Задачи) — ДВУХЭТАПНЫЙ МЕТОД
		tasksColl, err := app.FindCollectionByNameOrId("tasks")
		if err != nil {
			// Этап А: Создаем болванку коллекции со всеми плоскими полями
			tasksColl = core.NewBaseCollection("tasks")
			tasksColl.ListRule = types.Pointer("")   
			tasksColl.ViewRule = types.Pointer("")   
			tasksColl.CreateRule = types.Pointer("") 

			tasksColl.Fields.Add(
				&core.TextField{Name: "title", Required: true},
				&core.SelectField{Name: "status", Required: true, Values: []string{"todo", "in_progress", "done"}},
				&core.RelationField{Name: "project", CollectionId: projectsColl.Id, MaxSelect: 1},
				&core.RelationField{Name: "entity", CollectionId: entitiesColl.Id, MaxSelect: 1},
				&core.JSONField{Name: "astro_coordinates"}, 
				&core.FileField{Name: "attachments", MaxSelect: 10},
				&core.EditorField{Name: "notes"},
				&core.AutodateField{Name: "created", OnCreate: true},
				&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			)

			// Сохраняем первый раз, чтобы PocketBase присвоил коллекции физический ID
			if err := app.Save(tasksColl); err != nil {
				return err
			}

			// Этап Б: Теперь, когда у tasksColl есть реальный Id, добавляем связь на саму себя
			tasksColl.Fields.Add(&core.RelationField{
				Name:         "parent_task", 
				CollectionId: tasksColl.Id, // Используем свежеполученный ID этой же коллекции!
				MaxSelect:    1,
			})

			// Пересохраняем обновленную структуру
			if err := app.Save(tasksColl); err != nil {
				return err
			}
			log.Println("Коллекция 'tasks' успешно создана с бесконечной вложенностью!")
		}

		// 4. Создаем коллекцию AI_SESSIONS (ИИ Логи)
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
			log.Println("Коллекция 'ai_sessions' создана!")
		}
    e.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
}
