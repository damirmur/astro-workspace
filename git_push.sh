#!/bin/sh

# Первый параметр: содержание коммита
COMMIT_MESSAGE="${1:-"Fix merge conflicts"}"

# Второй параметр: название ветки
BRANCH_NAME="${2:-"main"}"

echo "Добавляем все изменения в индекс..."
git add .

echo "Создаем коммит с сообщением: \"$COMMIT_MESSAGE\""
git commit -m "$COMMIT_MESSAGE"

echo "Отправляем изменения в удаленный репозиторий ветки \"$BRANCH_NAME\"..."
git push origin "$BRANCH_NAME"

echo "Скрипт завершен."
