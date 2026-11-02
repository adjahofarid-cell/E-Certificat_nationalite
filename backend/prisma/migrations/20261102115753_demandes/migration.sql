-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('BROUILLON', 'EN_ATTENTE_PAIEMENT', 'EN_TRAITEMENT', 'VALIDEE', 'DOCUMENT_GENERE', 'REJETEE', 'ANNULEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "TypePiece" AS ENUM ('IDENTITE', 'ACTE_NAISSANCE', 'DOMICILE', 'PHOTO', 'PARENTS');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('MOBILE_MONEY', 'VISA');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'SUCCES', 'ECHEC');

-- CreateEnum
CREATE TYPE "StatutDocument" AS ENUM ('PROJET_GENERE', 'SIGNE_ENREGISTRE', 'REVOQUE');

-- CreateTable
CREATE TABLE "MotifRejet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "MotifRejet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demande" (
    "id" TEXT NOT NULL,
    "numeroDossier" TEXT,
    "statut" "StatutDemande" NOT NULL DEFAULT 'BROUILLON',
    "citoyenId" TEXT NOT NULL,
    "agentId" TEXT,
    "dateNaissance" DATE,
    "lieuNaissance" TEXT,
    "nomPere" TEXT,
    "nomMere" TEXT,
    "adresse" TEXT,
    "motifRejetId" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateSoumission" TIMESTAMP(3),
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceJustificative" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "type" "TypePiece" NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "cleStockage" TEXT NOT NULL,
    "dateUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceJustificative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "montant" DECIMAL(12,0) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "mode" "ModePaiement" NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "reference" TEXT NOT NULL,
    "cleIdempotence" TEXT NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "identifiantPublic" TEXT NOT NULL,
    "statut" "StatutDocument" NOT NULL DEFAULT 'PROJET_GENERE',
    "cheminProjet" TEXT NOT NULL,
    "cheminSigne" TEXT,
    "hashSigne" TEXT,
    "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEnregistrementSigne" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MotifRejet_code_key" ON "MotifRejet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Demande_numeroDossier_key" ON "Demande"("numeroDossier");

-- CreateIndex
CREATE INDEX "Demande_citoyenId_idx" ON "Demande"("citoyenId");

-- CreateIndex
CREATE INDEX "Demande_statut_idx" ON "Demande"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "PieceJustificative_demandeId_type_key" ON "PieceJustificative"("demandeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_cleIdempotence_key" ON "Paiement"("cleIdempotence");

-- CreateIndex
CREATE INDEX "Paiement_demandeId_idx" ON "Paiement"("demandeId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_demandeId_key" ON "Document"("demandeId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_identifiantPublic_key" ON "Document"("identifiantPublic");

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_citoyenId_fkey" FOREIGN KEY ("citoyenId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_motifRejetId_fkey" FOREIGN KEY ("motifRejetId") REFERENCES "MotifRejet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceJustificative" ADD CONSTRAINT "PieceJustificative_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une seule demande active par citoyen
CREATE UNIQUE INDEX "demande_active_unique"
    ON "Demande"("citoyenId")
    WHERE "statut" IN ('BROUILLON', 'EN_ATTENTE_PAIEMENT', 'EN_TRAITEMENT', 'VALIDEE');

-- Un seul paiement validé par demande
CREATE UNIQUE INDEX "paiement_valide_unique"
    ON "Paiement"("demandeId")
    WHERE "statut" = 'SUCCES';

-- Numérotation des dossiers (CN-2026-000123)
CREATE SEQUENCE "numero_dossier_seq" START 1;