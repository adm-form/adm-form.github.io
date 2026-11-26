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
    const seuil = Math.max(42, Math.min(110, ecartFond * 0.7 + 35));
    return distanceFond > seuil && Math.abs(clair - clairFond) > 28;
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

  const margeX = largeurDetectee * 0.015;
  const margeY = hauteurDetectee * 0.015;
  const x = Math.max(0, plusGrandGauche - margeX);
  const y = Math.max(0, plusGrandHaut - margeY);
  const limiteDroite = Math.min(width, plusGrandDroite + margeX);
  const limiteBas = Math.min(height, plusGrandBas + margeY);

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
    return { source, limites, detecte: Boolean(detection) };
  } catch (e) {
    source.close();
    throw e;
  }
}

export async function recadrerPhoto(source, limites) {
  const x = Math.min(0.99, Math.max(0, limites.x));
  const y = Math.min(0.99, Math.max(0, limites.y));
  const droite = Math.min(1, Math.max(x + 0.01, limites.x + limites.largeur));
  const bas = Math.min(1, Math.max(y + 0.01, limites.y + limites.hauteur));
  const sourceX = Math.round(x * source.width);
  const sourceY = Math.round(y * source.height);
  const sourceLargeur = Math.max(1, Math.round((droite - x) * source.width));
  const sourceHauteur = Math.max(1, Math.round((bas - y) * source.height));
  const echelle = Math.min(1, LIMITE_SORTIE / Math.max(sourceLargeur, sourceHauteur));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceLargeur * echelle));
  canvas.height = Math.max(1, Math.round(sourceHauteur * echelle));
  const contexte = canvas.getContext("2d");
  if (!contexte) throw new Error("Impossible de recadrer cette photo.");
  contexte.fillStyle = "#fff";
  contexte.fillRect(0, 0, canvas.width, canvas.height);
  contexte.drawImage(
    source,
    sourceX,
    sourceY,
    sourceLargeur,
    sourceHauteur,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de préparer cette photo."))),
      "image/jpeg",
      0.9
    );
  });
}
