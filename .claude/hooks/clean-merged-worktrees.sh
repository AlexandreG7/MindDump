#!/usr/bin/env bash
# Hook PostToolUse (Bash) : après un `git push` vers main, supprime les worktrees
# .claude/worktrees/* dont la branche vient d'entrer dans origin/main, puis leur
# branche locale.
#
# Garde-fous :
# - seulement les worktrees dont la branche est entièrement dans origin/main ET a
#   reçu au moins un commit (un worktree tout juste créé depuis main n'est jamais
#   touché) ; les worktrees en HEAD détaché sont ignorés ;
# - jamais un worktree avec des modifications suivies (hors cache .impeccable) ou
#   des fichiers non suivis ;
# - jamais le worktree courant de la session.
set -u

input=$(cat)
cmd=$(printf '%s' "$input" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

# Uniquement un git push qui vise main.
printf '%s' "$cmd" | grep -Eq 'git( -C [^ ]+)? push' || exit 0
printf '%s' "$cmd" | grep -Eq '(^|[ :/])main([ ;&|]|$)' || exit 0

repo="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$repo" || exit 0
git fetch -q origin main 2>/dev/null

new=$(git rev-parse -q --verify origin/main) || exit 0

here=$(cd "$(printf '%s' "$input" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)

removed=(); skipped=()
while IFS= read -r wt; do
  case "$wt" in */.claude/worktrees/*) ;; *) continue ;; esac
  [ "$wt" = "$here" ] && continue
  head=$(git -C "$wt" rev-parse HEAD 2>/dev/null) || continue
  git merge-base --is-ancestor "$head" "$new" || continue      # pas (encore) sur main
  branch=$(git -C "$wt" symbolic-ref -q --short HEAD) || continue   # HEAD détaché : on n'y touche pas
  # Branche jamais commitée (worktree tout juste créé depuis main) : on la garde.
  [ "$(git reflog show --format=%H "refs/heads/$branch" 2>/dev/null | wc -l | tr -d ' ')" -gt 1 ] || continue
  dirty=$(git -C "$wt" status --porcelain | grep -v ' \.impeccable/hook\.cache\.json$')
  if [ -n "$dirty" ]; then skipped+=("$(basename "$wt") (modifs locales)"); continue; fi
  if git worktree remove --force "$wt" 2>/dev/null; then
    [ -n "$branch" ] && git branch -D "$branch" >/dev/null 2>&1
    removed+=("$(basename "$wt")${branch:+ [$branch]}")
  fi
done < <(git worktree list --porcelain | awk '/^worktree /{print $2}')
git worktree prune

[ ${#removed[@]} -eq 0 ] && [ ${#skipped[@]} -eq 0 ] && exit 0
msg="Worktrees nettoyés après push sur main : ${removed[*]:-aucun}"
[ ${#skipped[@]} -gt 0 ] && msg="$msg. Conservés : ${skipped[*]}"
/usr/bin/python3 -c 'import json,sys; print(json.dumps({"systemMessage": sys.argv[1]}))' "$msg"
exit 0
