#!/usr/bin/env bash
# Hook Stop : quand la branche modifie du code (src/, prisma/, minddump-mcp/, mobile/…)
# sans rien toucher dans docs/, demande UNE fois à Claude de tenir le journal
# (skill `journal`). Il redemande seulement si de nouveaux fichiers changent ensuite.
# Claude peut juger qu'il n'y a rien à consigner : il le dit et s'arrête.
set -u

input=$(cat)
field() { printf '%s' "$input" | /usr/bin/python3 -c "import json,sys; print(json.load(sys.stdin).get('$1',''))" 2>/dev/null; }

# Déjà relancé par un Stop hook dans ce tour : on ne boucle pas.
[ "$(field stop_hook_active)" = "True" ] && exit 0

cd "$(field cwd)" 2>/dev/null || cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
base=$(git merge-base origin/main HEAD 2>/dev/null) || exit 0

changed=$( { git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u)
code=$(printf '%s\n' "$changed" | grep -E '^(src|prisma|minddump-mcp|mobile|hellofresh-proxy|drive-extension)/')
[ -n "$code" ] || exit 0
printf '%s\n' "$changed" | grep -Eq '^(docs/|PRODUCT\.md$|CLAUDE\.md$)' && exit 0

# Une seule relance pour un même ensemble de fichiers modifiés.
marker=$(git rev-parse --git-path claude-journal-reminded)
key=$(printf '%s' "$code" | git hash-object --stdin)
[ "$(cat "$marker" 2>/dev/null)" = "$key" ] && exit 0
printf '%s' "$key" > "$marker"

n=$(printf '%s\n' "$code" | wc -l | tr -d ' ')
reason="Cette branche modifie $n fichier(s) de code sans toucher docs/. Charge le skill journal : s'il y a une décision, un changement de comportement visible ou une contrainte à retenir, ajoute l'entrée (docs/journal.md, ADR ou doc du domaine) ; sinon dis en une ligne qu'il n'y a rien à consigner. Ne relance aucun autre travail."
printf '{"decision":"block","reason":"%s"}\n' "$reason"
