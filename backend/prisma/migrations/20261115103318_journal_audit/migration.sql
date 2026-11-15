-- CreateEnum
CREATE TYPE "ActionAudit" AS ENUM ('CONNEXION', 'CONNEXION_ECHEC', 'PRISE_EN_CHARGE', 'VALIDATION', 'REJET', 'PROJET_GENERE', 'DOCUMENT_SIGNE', 'AGENT_CREE', 'AGENT_DESACTIVE', 'AGENT_REACTIVE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "dateRevocation" TIMESTAMP(3),
ADD COLUMN     "motifRevocation" TEXT;

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "ActionAudit" NOT NULL,
    "acteurId" TEXT,
    "acteurNom" TEXT,
    "acteurRole" "Role",
    "demandeId" TEXT,
    "dossier" TEXT,
    "detail" TEXT,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE INDEX "Audit_date_idx" ON "Audit"("date");

-- CreateIndex
CREATE INDEX "Audit_action_idx" ON "Audit"("action");
