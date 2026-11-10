export type DonneesCertificat = {
    numeroDossier: string;
    identifiantPublic: string;
    qrDataUrl: string;
    prenom: string;
    nom: string;
    dateNaissance: string;
    lieuNaissance: string;
    nomPere: string;
    nomMere: string;
    adresse: string;
    dateEdition: string;
};

// Les données viennent d'un formulaire : on neutralise tout HTML avant de les insérer.
const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function modeleCertificat(d: DonneesCertificat): string {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #16202e; margin: 0; }
  .cadre { border: 2px solid #1f3864; padding: 28px 34px; height: 255mm; position: relative; }
  .entete { text-align: center; border-bottom: 1px solid #cdd3dc; padding-bottom: 14px; margin-bottom: 26px; }
  .marque { font: 600 13px Arial, sans-serif; color: #1f3864; letter-spacing: .08em; }
  h1 { font-size: 26px; letter-spacing: .12em; text-align: center; margin: 18px 0 6px; color: #1f3864; }
  .dossier { text-align: center; font: 12px Arial, sans-serif; color: #5b6472; margin-bottom: 30px; }
  p.corps { font-size: 15.5px; line-height: 1.9; text-align: justify; }
  .zone { margin-top: 56px; display: flex; justify-content: space-between; align-items: flex-end; }
  .signature { width: 230px; height: 120px; border: 1px dashed #8991a0; padding: 8px; font: 11px Arial, sans-serif; color: #8991a0; text-align: center; }
  .verif { width: 200px; text-align: center; font: 11px Arial, sans-serif; color: #5b6472; }
  .verif img { width: 120px; height: 120px; display: block; margin: 0 auto 6px; }
  .mono { font-family: 'Courier New', monospace; color: #16202e; font-size: 12px; }
  .pied { position: absolute; bottom: 14px; left: 34px; right: 34px; text-align: center; font: 10.5px Arial, sans-serif; color: #8991a0; border-top: 1px solid #e3e6ec; padding-top: 8px; }
</style></head><body>
<div class="cadre">
  <div class="entete"><div class="marque">E-ADMIN</div></div>
  <h1>CERTIFICAT DE NATIONALITÉ</h1>
  <div class="dossier">Dossier n° ${esc(d.numeroDossier)}</div>
  <p class="corps">
    Il est certifié que <strong>${esc(d.prenom)} ${esc(d.nom)}</strong>, né(e) le ${esc(d.dateNaissance)}
    à ${esc(d.lieuNaissance)}, fils/fille de ${esc(d.nomPere)} et de ${esc(d.nomMere)},
    demeurant à ${esc(d.adresse)}, est de nationalité gabonaise.
  </p>
  <p class="corps">Édité le ${esc(d.dateEdition)}.</p>
  <div class="zone">
    <div class="verif">
      <img src="${d.qrDataUrl}" alt="QR Code de vérification">
      Identifiant public<br><span class="mono">${esc(d.identifiantPublic)}</span>
    </div>
    <div class="signature">Signature et cachet de l’autorité compétente</div>
  </div>
  <div class="pied">
    Projet à signer : ce document n’a de valeur qu’une fois signé par l’autorité compétente.
    La vérification en ligne est technique et ne garantit pas à elle seule sa valeur juridique.
  </div>
</div>
</body></html>`;
}