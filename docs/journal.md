# MindDump — Journal des décisions

Trace datée de ce qui a été tranché, pourquoi, et ce que ça change. Une
entrée par session de travail, la plus récente en haut. Les choix
d'architecture durables ont leur ADR (`docs/adr/`) ; le journal y renvoie.
Mode d'emploi : skill `journal` (`.claude/skills/journal/SKILL.md`).

---

## 2026-10-14 — Outillage des sessions Claude

| Décision | Raison | Conséquence |
|---|---|---|
| Hook de démarrage pour les sessions cloud (`npm ci` de l'app et du MCP) | Les sessions cloud n'avaient pas de dépendances : les tests bloquants ne tournaient qu'au build Docker, donc en production | `npm run build && npm run test:*` utilisables dans le cloud |
| Skills `livrer`, `rca-prod`, `nouveau-test-http`, `pieges-ios` (agent `mobile` seul), `journal` | Tâches répétées d'une session à l'autre, refaites de mémoire | Procédures versionnées dans `.claude/skills/` |
| Skill `hellofresh` réécrit sur les outils MCP | L'ancien guide appelait l'API HelloFresh depuis le Mac et visait un groupe en dur ; le serveur passe désormais par le proxy Cloudflare | Import par `search_hellofresh` / `import_hellofresh` ; groupe par défaut de l'utilisateur |
| Hook de fin de tour qui rappelle le journal | Les décisions restaient dans les sessions (le journal marketing du 21/09 n'a jamais été fusionné) | Une relance par ensemble de fichiers modifiés, quand du code change sans `docs/` |

- **Écarté** : skills de triage de liste et de repli en cas d'accès GitHub
  bloqué.
- **Laissé de côté** : un hook avant `git push` qui compile et teste
  `minddump-mcp/` et rappelle son Redeploy ; vérifier l'appartenance au foyer
  avant l'URL dans `POST /api/calendar/subscriptions` (le test ownership
  échoue sans DNS, donc dans le cloud) ; sortir `PROXY_SECRET` de
  `hellofresh-proxy/wrangler.toml`.
