/**
 * Listes de courses hors ligne (docs/app-mobile.md, étape 1.3).
 *
 * Cocher, ajouter ou supprimer un article s'applique tout de suite à l'écran.
 * Si le réseau manque, l'opération rejoint une file (localStorage) rejouée au
 * retour de la connexion. Les opérations sont idempotentes pour qu'un rejeu
 * n'ait pas d'effet de bord : on envoie l'état voulu (checked: true) et non
 * une bascule, un article ajouté porte un id généré ici, et supprimer un
 * article déjà supprimé est un succès.
 *
 * Aucune dépendance au navigateur au chargement du module : la route d'ajout
 * d'article en importe CLIENT_ID_PATTERN côté serveur.
 */

export type NewItem = {
  id: string;
  name: string;
  quantity: string | null;
  url?: string | null;
  price?: number | null;
  store?: string | null;
};

export type ListOp =
  | { type: "check"; listId: string; itemId: string; checked: boolean }
  | { type: "add"; listId: string; item: NewItem }
  | { type: "delete"; listId: string; itemId: string };

/** Forme d'un cuid ; seul ce format est accepté comme id fourni par le client. */
export const CLIENT_ID_PATTERN = /^c[a-z0-9]{24}$/;

const QUEUE_KEY = "minddump-offline-list-ops";
const CHANGE_EVENT = "minddump-offline-list-ops";

/** Id au format cuid (« c » + 24 caractères base 36), aléatoire. */
export function newItemId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "c" + Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

// ─── File d'attente ────────────────────────────────────────────

function readQueue(): ListOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as ListOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: ListOp[]) {
  try {
    if (ops.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Stockage indisponible : les opérations en attente seront perdues.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function pendingOps(): ListOp[] {
  return readQueue();
}

/** Déconnexion : les opérations d'un compte ne doivent pas survivre à la session. */
export function clearPendingOps() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {}
}

export function onPendingOpsChange(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

// ─── Envoi ─────────────────────────────────────────────────────

type SendResult = "done" | "retry" | "dropped";

async function send(op: ListOp): Promise<SendResult> {
  const base = `/api/lists/${op.listId}/items`;
  let res: Response;
  try {
    if (op.type === "add") {
      res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op.item),
      });
    } else if (op.type === "check") {
      res = await fetch(`${base}/${op.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: op.checked }),
      });
    } else {
      res = await fetch(`${base}/${op.itemId}`, { method: "DELETE" });
    }
  } catch {
    return "retry"; // pas de réseau
  }
  if (res.ok) return "done";
  // Déjà supprimé : c'est le résultat voulu.
  if (op.type === "delete" && res.status === 404) return "done";
  // Serveur en difficulté ou session à renouveler : on réessaiera.
  if (res.status >= 500 || res.status === 401) return "retry";
  // Refus définitif (liste supprimée entre-temps…) : rejouer ne changerait rien.
  return "dropped";
}

let flushing: Promise<boolean> | null = null;

/**
 * Rejoue la file dans l'ordre et s'arrête à la première opération qui ne
 * passe pas encore. Renvoie true si au moins une opération a été traitée.
 */
export function flushPendingOps(): Promise<boolean> {
  if (flushing) return flushing;
  flushing = (async () => {
    let progressed = false;
    for (;;) {
      const [op] = readQueue();
      if (!op) break;
      const result = await send(op);
      if (result === "retry") break;
      // Relire la file : une opération a pu s'ajouter pendant l'envoi.
      writeQueue(readQueue().slice(1));
      progressed = true;
    }
    return progressed;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * Applique l'opération tout de suite si possible, sinon la met en file.
 * Tant que la file n'est pas vide, les nouvelles opérations passent derrière
 * pour garder l'ordre (ajouter puis cocher le même article, par exemple).
 */
export async function runListOp(op: ListOp): Promise<"sent" | "queued" | "failed"> {
  if (readQueue().length === 0) {
    const result = await send(op);
    if (result === "done") return "sent";
    if (result === "dropped") return "failed";
  }
  writeQueue([...readQueue(), op]);
  return "queued";
}

// ─── Vue locale ────────────────────────────────────────────────

type ListLike<I> = { id: string; items: I[] };
type ItemLike = { id: string; checked: boolean };

/**
 * Rejoue les opérations en attente sur des listes reçues du serveur (ou de son
 * cache hors ligne), pour que l'écran montre ce que l'utilisateur a fait.
 */
export function applyOps<I extends ItemLike, L extends ListLike<I>>(
  lists: L[],
  ops: ListOp[],
  makeItem: (item: NewItem) => I
): L[] {
  return ops.reduce(
    (acc, op) =>
      acc.map((list) => {
        if (list.id !== op.listId) return list;
        if (op.type === "add") {
          if (list.items.some((i) => i.id === op.item.id)) return list;
          return { ...list, items: [...list.items, makeItem(op.item)] };
        }
        if (op.type === "check") {
          return {
            ...list,
            items: list.items.map((i) => (i.id === op.itemId ? { ...i, checked: op.checked } : i)),
          };
        }
        return { ...list, items: list.items.filter((i) => i.id !== op.itemId) };
      }),
    lists
  );
}
