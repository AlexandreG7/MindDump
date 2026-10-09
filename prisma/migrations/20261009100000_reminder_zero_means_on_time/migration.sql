-- Rappels : 0 signifie désormais « à l'heure » (et non plus « pas de rappel »).
--
-- Avant cette version, notifyBefore = 0 voulait toujours dire « pas de rappel » :
-- l'ancien cron l'ignorait (test « if (!notifyBefore) »), le MCP envoyait 0 pour
-- supprimer un rappel et l'interface agenda l'enregistrait comme absent. Depuis,
-- le menu de rappel propose « À l'heure » = 0 et « Pas de rappel » = NULL. Sans
-- cette normalisation, les anciens 0 déclencheraient d'un coup des rappels à
-- l'heure que personne n'a demandés.
--
-- Pourquoi c'est sûr : aucune donnée n'est perdue. Un 0 ancien n'avait aucun
-- effet (jamais de rappel envoyé) ; NULL exprime exactement le même état
-- (« pas de rappel »). Ni titre, ni date, ni auteur, ni groupe, ni partage n'est
-- touché : aucun élément ne disparaît pour personne (ADR 0001 non concerné).
-- Aucun changement de schéma (colonnes inchangées), donc aucune dérive.
--
-- Rejouer ces ordres ne casserait rien (ils ne touchent que les 0), et Prisma ne les
-- applique de toute façon qu'une fois, avant que de vrais rappels « à l'heure »
-- puissent exister.
UPDATE "Todo" SET "notifyBefore" = NULL WHERE "notifyBefore" = 0;
UPDATE "CalendarEvent" SET "notifyBefore" = NULL WHERE "notifyBefore" = 0;
