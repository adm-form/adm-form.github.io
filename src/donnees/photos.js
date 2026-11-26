const LIMITE_ANALYSE = 600;
const LIMITE_SORTIE = 2500;

export function detecterBordereau(imageData) {
  const { data, width, height } = imageData;
  const taille = width * height;
  const echantillons = [];

  for (const [fractionX, fractionY] of [
    [0.04, 0.04],
    [0.96, 0.04],
    [0.04, 0.96],
    [0.96, 0.96],
  ]) {
    const x = Math.floor(width * fractionX);
    const y = Math.floor(height * fractionY);
    const rayon = Math.max(1, Math.round(Math.min(width, height) * 0.02));
    let r = 0;
    let g = 0;
    let b = 0;
    let nombre = 0;
    for (let yy = Math.max(0, y - rayon); yy < Math.min(height, y + rayon); yy++) {
      for (let xx = Math.max(0, x - rayon); xx < Math.min(width, x + rayon); xx++) {
        const index = (yy * width + xx) * 4;
        r += data[index];
        g += data[index + 1];
        b += data[index + 2];
        nombre++;
      }
    }
    echantillons.push([r / nombre, g / nombre, b / nombre]);
  }

  const fond = [
    echantillons.reduce((somme, couleur) => somme + couleur[0], 0) / 4,
    echantillons.reduce((somme, couleur) => somme + couleur[1], 0) / 4,
    echantillons.reduce((somme, couleur) => somme + couleur[2], 0) / 4,
  ];
  const ecartFond = Math.max(...echantillons.map((couleur) =>
    Math.hypot(couleur[0] - fond[0], couleur[1] - fond[1], couleur[2] - fond[2])
  ));

  const candidat = (i) => {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const distanceFond = Math.hypot(r - fond[0], g - fond[1], b - fond[2]);
    const clair = (r + g + b) / 3;
    const clairFond = (fond[0] + fond[1] + fond[2]) / 3;
    const seuil = Math.max(58, Math.min(125, ecartFond * 0.8 + 45));
    return distanceFond > seuil && Math.abs(clair - clairFond) > 35;
  };

  const papier = new Uint8Array(taille);
  for (let i = 0; i < taille; i++) {
    if (candidat(i)) papier[i] = 1;
  }

  const file = new Int32Array(taille);
  let plusGrandGauche = width;
  let plusGrandHaut = height;
  let plusGrandDroite = 0;
  let plusGrandBas = 0;
  let plusGrandNombre = 0;

  for (let depart = 0; depart < taille; depart++) {
    if (!papier[depart]) continue;
    let debut = 0;
    let fin = 0;
    let gauche = width;
    let haut = height;
    let droite = 0;
    let bas = 0;
    file[fin++] = depart;
    papier[depart] = 0;

    while (debut < fin) {
      const index = file[debut++];
      const x = index % width;
      const y = Math.floor(index / width);
      gauche = Math.min(gauche, x);
      haut = Math.min(haut, y);
      droite = Math.max(droite, x + 1);
      bas = Math.max(bas, y + 1);

      for (const voisin of [index - 1, index + 1, index - width, index + width]) {
        if (voisin < 0 || voisin >= taille || !papier[voisin]) continue;
        const vx = voisin % width;
        const vy = Math.floor(voisin / width);
        if (Math.abs(vx - x) + Math.abs(vy - y) !== 1) continue;
        papier[voisin] = 0;
        file[fin++] = voisin;
      }
    }

    if (fin > plusGrandNombre) {
      plusGrandNombre = fin;
      plusGrandGauche = gauche;
      plusGrandHaut = haut;
      plusGrandDroite = droite;
      plusGrandBas = bas;
    }
  }

  if (
    plusGrandNombre < taille * 0.08 ||
    (plusGrandDroite - plusGrandGauche) * (plusGrandBas - plusGrandHaut) > taille * 0.96
  ) return null;

  const largeurDetectee = plusGrandDroite - plusGrandGauche;
  const hauteurDetectee = plusGrandBas - plusGrandHaut;
  if (largeurDetectee < width * 0.15 || hauteurDetectee < height * 0.15) return null;
  if (Math.max(largeurDetectee, hauteurDetectee) / Math.min(largeurDetectee, hauteurDetectee) > 6) {
    return null;
  }

  const x = plusGrandGauche;
  const y = plusGrandHaut;
  const limiteDroite = plusGrandDroite;
  const limiteBas = plusGrandBas;

  return {
    x: x / width,
    y: y / height,
    largeur: (limiteDroite - x) / width,
    hauteur: (limiteBas - y) / height,
  };
}

export async function analyserPhoto(file) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("Ce navigateur ne permet pas l’analyse de cette photo.");
  }

  const source = await createImageBitmap(file);
  try {
    const echelle = Math.min(1, LIMITE_ANALYSE / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * echelle));
    canvas.height = Math.max(1, Math.round(source.height * echelle));
    const contexte = canvas.getContext("2d", { willReadFrequently: true });
    if (!contexte) throw new Error("Impossible d’analyser cette photo.");
    contexte.drawImage(source, 0, 0, canvas.width, canvas.height);
    const imageData = contexte.getImageData(0, 0, canvas.width, canvas.height);
    const detection = detecterBordereau(imageData);
    const limites = detection || { x: 0, y: 0, largeur: 1, hauteur: 1 };
    const coins = {
      hautGauche: { x: limites.x, y: limites.y },
      hautDroite: { x: limites.x + limites.largeur, y: limites.y },
      basDroite: { x: limites.x + limites.largeur, y: limites.y + limites.hauteur },
      basGauche: { x: limites.x, y: limites.y + limites.hauteur },
    };
    return {
      source,
      sourceUrl: URL.createObjectURL(file),
      limites,
      coins,
      detecte: Boolean(detection),
    };
  } catch (e) {
    source.close();
    throw e;
  }
}

function limitesVersCoins(limites) {
  return {
    hautGauche: { x: limites.x, y: limites.y },
    hautDroite: { x: limites.x + limites.largeur, y: limites.y },
    basDroite: { x: limites.x + limites.largeur, y: limites.y + limites.hauteur },
    basGauche: { x: limites.x, y: limites.y + limites.hauteur },
  };
}

function resoudre3(mat) {
  for (let colonne = 0; colonne < 3; colonne++) {
    let pivot = colonne;
    for (let ligne = colonne + 1; ligne < 3; ligne++) {
      if (Math.abs(mat[ligne][colonne]) > Math.abs(mat[pivot][colonne])) pivot = ligne;
    }
    if (Math.abs(mat[pivot][colonne]) < 1e-8) return null;
    [mat[colonne], mat[pivot]] = [mat[pivot], mat[colonne]];
    const diviseur = mat[colonne][colonne];
    for (let c = 0; c < 4; c++) mat[colonne][c] /= diviseur;
    for (let ligne = 0; ligne < 3; ligne++) {
      if (ligne === colonne) continue;
      const facteur = mat[ligne][colonne];
      for (let c = 0; c < 4; c++) mat[ligne][c] -= facteur * mat[colonne][c];
    }
  }
  return [mat[0][3], mat[1][3], mat[2][3]];
}

function affineVersDestination(source, destination) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const a = resoudre3([
    [s0.x, s0.y, 1, d0.x],
    [s1.x, s1.y, 1, d1.x],
    [s2.x, s2.y, 1, d2.x],
  ]);
  const b = resoudre3([
    [s0.x, s0.y, 1, d0.y],
    [s1.x, s1.y, 1, d1.y],
    [s2.x, s2.y, 1, d2.y],
  ]);
  if (!a || !b) return null;
  return [a[0], b[0], a[1], b[1], a[2], b[2]];
}

function dessinerTriangle(contexte, source, sourcePoints, destinationPoints) {
  const transform = affineVersDestination(sourcePoints, destinationPoints);
  if (!transform) return;
  contexte.save();
  contexte.beginPath();
  contexte.moveTo(destinationPoints[0].x, destinationPoints[0].y);
  contexte.lineTo(destinationPoints[1].x, destinationPoints[1].y);
  contexte.lineTo(destinationPoints[2].x, destinationPoints[2].y);
  contexte.closePath();
  contexte.clip();
  contexte.setTransform(...transform);
  contexte.drawImage(source, 0, 0);
  contexte.restore();
}

export async function recadrerPhoto(source, limitesOuCoins) {
  const coins = limitesOuCoins.hautGauche
    ? limitesOuCoins
    : limitesVersCoins(limitesOuCoins);
  const points = ["hautGauche", "hautDroite", "basDroite", "basGauche"].map((nom) => ({
    x: Math.max(0, Math.min(1, coins[nom].x)) * source.width,
    y: Math.max(0, Math.min(1, coins[nom].y)) * source.height,
  }));
  const [hg, hd, bd, bg] = points;
  const largeur = Math.max(
    1,
    Math.round((Math.hypot(hd.x - hg.x, hd.y - hg.y) + Math.hypot(bd.x - bg.x, bd.y - bg.y)) / 2)
  );
  const hauteur = Math.max(
    1,
    Math.round((Math.hypot(bg.x - hg.x, bg.y - hg.y) + Math.hypot(bd.x - hd.x, bd.y - hd.y)) / 2)
  );
  const echelle = Math.min(1, LIMITE_SORTIE / Math.max(largeur, hauteur));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largeur * echelle));
  canvas.height = Math.max(1, Math.round(hauteur * echelle));
  const contexte = canvas.getContext("2d");
  if (!contexte) throw new Error("Impossible de recadrer cette photo.");
  contexte.fillStyle = "#fff";
  contexte.fillRect(0, 0, canvas.width, canvas.height);
  const destination = [
    { x: 0, y: 0 },
    { x: canvas.width, y: 0 },
    { x: canvas.width, y: canvas.height },
    { x: 0, y: canvas.height },
  ];
  const destSource = points.map((point) => ({
    x: point.x,
    y: point.y,
  }));
  const echelleDestination = [
    destination[0],
    destination[1],
    destination[2],
    destination[3],
  ];
  // Les triangles redressent les quatre coins sans conserver le fond en dehors.
  dessinerTriangle(contexte, source, [destSource[0], destSource[1], destSource[2]],
    [echelleDestination[0], echelleDestination[1], echelleDestination[2]]);
  dessinerTriangle(contexte, source, [destSource[0], destSource[2], destSource[3]],
    [echelleDestination[0], echelleDestination[2], echelleDestination[3]]);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de préparer cette photo."))),
      "image/jpeg",
      0.9
    );
  });
}

export function grouperPhotosParType(photos) {
  const groupes = new Map();
  for (const photo of photos) {
    const type = photo.type
      || (photo.nom.startsWith("bordereau-YUL-B1B-")
        ? "bordereau-YUL-B1B"
        : photo.nom.startsWith("bordereau-YUL-")
          ? "bordereau-YUL"
          : photo.nom.startsWith("bordereau-YMX-")
            ? "bordereau-YMX"
            : "bordereau");
    if (!groupes.has(type)) groupes.set(type, []);
    groupes.get(type).push(photo);
  }
  return groupes;
}

function dateDansNom(photo) {
  const correspondance = photo.nom.match(/-(\d{8}T\d{6})-/);
  return correspondance ? correspondance[1] : "";
}

export function nomPdf(type, photos) {
  const date = photos.length ? dateDansNom(photos[0]) : "";
  return date ? `${type}-${date}.pdf` : `${type}.pdf`;
}

function blobVersDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("Impossible de lire une image à partager."));
    lecteur.readAsDataURL(blob);
  });
}

export async function creerPdfBordereaux(photos) {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const largeurA4 = 210;
  const hauteurA4 = 297;
  const marge = 10;

  for (let index = 0; index < photos.length; index++) {
    if (index > 0) pdf.addPage("a4", "portrait");
    const photo = photos[index];
    const jpeg = await recadrerPhoto(photo.source, photo.coins || photo.limites);
    const dataUrl = await blobVersDataUrl(jpeg);
    const image = await createImageBitmap(jpeg);
    try {
      const largeurDisponible = largeurA4 - marge * 2;
      const hauteurDisponible = hauteurA4 - marge * 2;
      const echelle = Math.min(
        largeurDisponible / (image.width / 96 * 25.4),
        hauteurDisponible / (image.height / 96 * 25.4)
      );
      const largeurImage = (image.width / 96 * 25.4) * echelle;
      const hauteurImage = (image.height / 96 * 25.4) * echelle;
      const gauche = (largeurA4 - largeurImage) / 2;
      const haut = (hauteurA4 - hauteurImage) / 2;
      pdf.addImage(dataUrl, "JPEG", gauche, haut, largeurImage, hauteurImage, undefined, "FAST");
    } finally {
      image.close();
    }
  }

  return pdf.output("blob");
}
