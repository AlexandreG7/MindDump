/**
 * Identité de l'éditeur affichée sur /confidentialite.
 *
 * Ces informations sont personnelles et la page est publique : elles viennent de
 * variables d'environnement (Coolify en production), jamais du dépôt, qui est
 * public. On peut ainsi les corriger sans commit, et elles n'entrent pas dans
 * l'historique git.
 */
export interface PrivacyInfo {
  controller: string;
  contactEmail: string;
  mailProvider: string;
  /** true tant qu'une valeur n'est pas renseignée (affichage « à compléter »). */
  incomplete: boolean;
}

const MISSING = {
  controller: "[à compléter : nom ou raison sociale de l'éditeur, adresse]",
  contactEmail: "[à compléter : adresse e-mail de contact]",
  mailProvider: "[à compléter : prestataire d'envoi d'e-mails]",
};

export function getPrivacyInfo(): PrivacyInfo {
  const controller = process.env.PRIVACY_CONTROLLER?.trim();
  const contactEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  const mailProvider = process.env.PRIVACY_MAIL_PROVIDER?.trim();
  return {
    controller: controller || MISSING.controller,
    contactEmail: contactEmail || MISSING.contactEmail,
    mailProvider: mailProvider || MISSING.mailProvider,
    incomplete: !controller || !contactEmail || !mailProvider,
  };
}
