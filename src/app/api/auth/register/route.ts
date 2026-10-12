import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { ensureDefaultGroup } from "@/lib/defaultGroup";
import { generateUniquePublicId } from "@/lib/publicId";
import { CONSENT_VERSION } from "@/lib/consent";
import { parseEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { SIGNUP_CLOSED_MESSAGE, isSignupAllowed } from "@/lib/signupAllowlist";
import {
  INVITE_EMAIL_MISMATCH_MESSAGE,
  INVITE_INVALID_MESSAGE,
  createUserWithGrant,
  findValidInvite,
} from "@/lib/signupInvite";
import {
  GROUP_INVITE_INVALID_MESSAGE,
  findSignupGroupInvite,
  groupInviteAcceptsEmail,
} from "@/lib/groupInviteSignup";

// Essais par adresse IP et par fenêtre (limiteur en mémoire, une instance : src/lib/rateLimit.ts).
const REGISTER_MAX = 10;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Avant tout accès à la base : freine l'essai en masse d'adresses.
  if (!rateLimit(`register:${clientIp(req.headers)}`, REGISTER_MAX, REGISTER_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(REGISTER_WINDOW_MS / 1000) } }
    );
  }

  const body = await req.json().catch(() => null);
  const { name, email, password, consent, invite, groupInvite } = body ?? {};
  const hasGroupInvite = groupInvite !== undefined && groupInvite !== null && groupInvite !== "";

  // Inscriptions sur invitation (src/lib/signupInvite.ts). Une adresse peut créer un
  // compte si elle est dans la table AllowedSignupEmail (gérée dans /admin) OU si l'invitation
  // fournie la vise. Pour une adresse NON autorisée et sans invitation, la réponse (403) est la
  // même qu'elle soit inscrite ou non : aucune lecture de comptes avant ce contrôle (la seule
  // lecture est celle de la table des adresses autorisées). Ce n'est PAS une protection contre
  // l'énumération en général : pour une adresse autorisée ou invitée, le 409 « compte existant »
  // révèle qu'elle est inscrite. D'où la limite de débit ci-dessus (docs/oauth.md). Sans jeton,
  // la table ne protège que par le secret de ses adresses : qui en connaît une peut créer le
  // compte avant son titulaire.
  const cleanEmail = parseEmail(email);
  const allowlisted = await isSignupAllowed(cleanEmail);
  if (!allowlisted) {
    if (invite !== undefined && invite !== null && invite !== "") {
      const found = await findValidInvite(invite);
      if (!found) return NextResponse.json({ error: INVITE_INVALID_MESSAGE }, { status: 403 });
      // Le porteur du lien connaît déjà l'adresse invitée (elle est affichée) : message précis.
      if (found.email !== cleanEmail) {
        return NextResponse.json({ error: INVITE_EMAIL_MISMATCH_MESSAGE }, { status: 403 });
      }
    } else if (hasGroupInvite) {
      // Invitation de foyer : lien valide (non expiré, pas encore associé à une inscription),
      // ouvert ou nominatif pour cette adresse (groupInviteSignup.ts). Le contrôle atomique
      // se refait dans createUserWithGrant.
      const found = await findSignupGroupInvite(groupInvite);
      if (!found) return NextResponse.json({ error: GROUP_INVITE_INVALID_MESSAGE }, { status: 403 });
      if (!cleanEmail) return NextResponse.json({ error: "Indique une adresse e-mail valide." }, { status: 400 });
      if (!groupInviteAcceptsEmail(found.email, cleanEmail)) {
        return NextResponse.json({ error: INVITE_EMAIL_MISMATCH_MESSAGE }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: SIGNUP_CLOSED_MESSAGE }, { status: 403 });
    }
  }
  // Ici `cleanEmail` n'est jamais null (TypeScript ne peut pas le déduire) : soit l'adresse
  // est dans la table, et isSignupAllowed(null) vaut false ; soit une invitation
  // valide a été trouvée et son adresse, toujours valide, est égale à `cleanEmail`.
  const signupEmail = cleanEmail as string;

  // RGPD : le consentement doit être explicite, y compris pour un POST direct.
  if (consent !== true) {
    return NextResponse.json(
      { error: "Tu dois accepter la politique de confidentialité pour créer un compte." },
      { status: 400 }
    );
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email et mot de passe requis." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const publicId = await generateUniquePublicId();

  // Une transaction : verrou sur l'adresse, doublon sans tenir compte de la casse,
  // consommation de l'invitation, création (adresse stockée en minuscules).
  const result = await createUserWithGrant(
    signupEmail,
    {
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      password: hashPassword(password),
      emailVerified: new Date(),
      role: "user",
      publicId,
      consentedAt: new Date(),
      consentVersion: CONSENT_VERSION,
    },
    invite,
    hasGroupInvite ? groupInvite : undefined
  );

  if (!result.ok) {
    if (result.reason === "exists") {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
    }
    // Invitation consommée entre-temps (deux inscriptions simultanées) ou remplacée.
    return NextResponse.json(
      { error: hasGroupInvite && !invite ? GROUP_INVITE_INVALID_MESSAGE : INVITE_INVALID_MESSAGE },
      { status: 403 }
    );
  }

  // Créer le groupe par défaut automatiquement
  await ensureDefaultGroup(result.user.id, result.user.name);

  return NextResponse.json({ ok: true }, { status: 201 });
}
