// Rotation des sauvegardes de la base (entrypoint.sh, avant chaque migration).
//
// Conserve :
//   - les 3 sauvegardes les plus récentes ;
//   - la plus récente de chaque semaine (ISO) pendant 90 jours.
// Tout le reste est supprimé. Ne touche qu'aux fichiers minddump-AAAAMMJJ-HHMMSS.sql.gz.
//
//   node prisma/rotate-backups.js [dossier]     (défaut : $BACKUP_DIR ou /app/data/backups)
//   DRY_RUN=1 node prisma/rotate-backups.js     (affiche sans supprimer)
const fs = require("fs");
const path = require("path");

const KEEP_LATEST = 3;
const WEEKLY_DAYS = 90;
const PATTERN = /^minddump-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.sql\.gz$/;

// Semaine ISO 8601 ("2026-W39") d'une date UTC.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function plan(files, now = new Date()) {
  const backups = files
    .map((name) => {
      const m = name.match(PATTERN);
      if (!m) return null;
      const [, y, mo, d, h, mi, s] = m;
      return { name, date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) };
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date); // plus récente d'abord

  const keep = new Set(backups.slice(0, KEEP_LATEST).map((b) => b.name));
  const weeksSeen = new Set();
  for (const b of backups) {
    const ageDays = (now - b.date) / 86400000;
    if (ageDays > WEEKLY_DAYS) continue;
    const week = isoWeek(b.date);
    if (!weeksSeen.has(week)) {
      weeksSeen.add(week);
      keep.add(b.name);
    }
  }
  return {
    keep: backups.filter((b) => keep.has(b.name)).map((b) => b.name),
    remove: backups.filter((b) => !keep.has(b.name)).map((b) => b.name),
  };
}

if (require.main === module) {
  const dir = process.argv[2] || process.env.BACKUP_DIR || "/app/data/backups";
  const { keep, remove } = plan(fs.readdirSync(dir));
  for (const name of remove) {
    if (process.env.DRY_RUN) console.log(`  [dry-run] supprimerait ${name}`);
    else fs.unlinkSync(path.join(dir, name));
  }
  console.log(`  Sauvegardes conservées : ${keep.length}, supprimées : ${remove.length}`);
}

module.exports = { plan, isoWeek };
