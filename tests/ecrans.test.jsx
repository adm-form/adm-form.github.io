// @vitest-environment jsdom
/*
 * MONTER LES ÉCRANS POUR DE VRAI — LE SEUL CONTRÔLE QUI ATTRAPE L'ÉCRAN BLANC.
 *
 * Un identifiant non déclaré, une prop oubliée, un import manquant : Vite
 * COMPILE SANS UN MOT (il tient l'identifiant inconnu pour une variable
 * globale), et le `ReferenceError` ne tombe qu'à l'exécution — en démontant
 * tout l'arbre React. Page blanche, rien à l'écran, rien dans le journal du
 * serveur. La construction ne le voit pas ; seul un vrai montage le voit.
 *
 * Ces essais passent donc par les composants, pas par la logique : ils
 * cliquent là où le technicien clique.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App.jsx";
import Formulaire from "../src/fiche/Formulaire.jsx";
import Points from "../src/ecrans/Points.jsx";
import { REGLAGES_DEFAUT } from "../src/reglages.js";
import { pointsLivres, modifier } from "../src/donnees/points.js";

const POINTS = modifier(
  modifier(pointsLivres(), "YUL", "RP-102", { matrice: "Pluvial", methode: "Perche" }),
  "YMX",
  "P3A",
  { matrice: "Surface" }
);

beforeEach(() => {
  localStorage.clear();
  // La file d'attente passe par IndexedDB, absent de jsdom : elle retombe
  // alors sur `localStorage`, ce qui est précisément le chemin de secours
  // qu'on veut voir fonctionner.
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const bouton = (nom) => screen.getByRole("button", { name: nom });

/* Plusieurs champs offrent les mêmes mots — « Aucune » est une couleur ET une
 * odeur, « Faible » une odeur ET un débit. On désigne donc le champ d'abord. */
const champ = (code) => document.querySelector(`[data-champ="${code}"]`);
const boutonDe = (code, nom) => within(champ(code)).getByRole("button", { name: nom });

/* « RP-102 » est aussi contenu dans « 24G-RP-102 » : le filtre rend les deux,
 * et c'est le bon comportement. L'ancre « ^ » désigne celui qu'on veut. */
const POINT_RP102 = /^RP-102/;

describe("la fiche s'affiche et répond", () => {
  it("se monte sans lever et montre ses sections", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    expect(screen.getByText("Campagne")).toBeTruthy();
    expect(screen.getByText("Observations")).toBeTruthy();
    expect(screen.getByText("Analyses")).toBeTruthy();
  });

  it("porte les défauts demandés, visibles à l'écran", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    expect(bouton("Régulier").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByDisplayValue("S. Lessard")).toBeTruthy();
  });

  it("ne montre les points qu'après le choix de l'aéroport", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    expect(screen.getByText(/Choisir l'aéroport pour voir ses points/)).toBeTruthy();
    fireEvent.click(bouton("YUL"));
    expect(screen.getByPlaceholderText(/Filtrer parmi 62/)).toBeTruthy();
  });

  it("montre les 26 points de YMX, et pas ceux de YUL", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YMX"));
    expect(screen.getByPlaceholderText(/Filtrer parmi 26/)).toBeTruthy();
  });

  it("passe les quatre paramètres à « - » quand on choisit YUL", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YUL"));
    expect(screen.getAllByPlaceholderText("non mesuré")).toHaveLength(4);
    expect(screen.getAllByText("défaut de l'aéroport")).toHaveLength(4);
  });

  it("laisse les quatre paramètres à saisir à YMX", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YMX"));
    expect(screen.queryAllByPlaceholderText("non mesuré")).toHaveLength(0);
  });

  it("remplit la matrice et la méthode quand le point les déclare", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YUL"));
    fireEvent.change(screen.getByPlaceholderText(/Filtrer parmi/), { target: { value: "RP-102" } });
    fireEvent.click(within(champ("point")).getByRole("button", { name: POINT_RP102 }));
    expect(boutonDe("matrice", "Pluvial").getAttribute("aria-pressed")).toBe("true");
    expect(boutonDe("methode", "Perche").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("déduit du point")).toHaveLength(2);
  });

  it("filtre la liste des points — 62 boutons ne se cherchent pas à l'œil", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YUL"));
    fireEvent.change(screen.getByPlaceholderText(/Filtrer parmi/), { target: { value: "f24g" } });
    expect(screen.getAllByRole("button", { name: /F24G/ })).toHaveLength(6);
  });

  it("ouvre le champ d'intensité SEULEMENT après une couleur, et le referme", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    expect(screen.queryByText("Intensité de la couleur")).toBeNull();
    fireEvent.click(boutonDe("couleur", "Verdâtre"));
    expect(screen.getByText("Intensité de la couleur")).toBeTruthy();
    fireEvent.click(boutonDe("couleur_intensite", "Intense"));
    // Repasser à « Aucune » doit refermer le champ ET oublier l'intensité :
    // une intensité sans couleur contredirait l'observation.
    fireEvent.click(boutonDe("couleur", "Aucune"));
    expect(screen.queryByText("Intensité de la couleur")).toBeNull();
    fireEvent.click(boutonDe("couleur", "Verdâtre"));
    expect(boutonDe("couleur_intensite", "Intense").getAttribute("aria-pressed")).toBe("false");
  });

  it("ouvre la nature de l'odeur SEULEMENT après une odeur", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    expect(screen.queryByText("Nature de l'odeur")).toBeNull();
    fireEvent.click(boutonDe("odeur", "Faible"));
    expect(screen.getByText("Nature de l'odeur")).toBeTruthy();
    expect(boutonDe("odeur_nature", "Glycol")).toBeTruthy();
  });

  it("coche plusieurs analyses et les compte", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("HP"));
    fireEvent.click(bouton("Glycol"));
    expect(screen.getByText(/2 analyse\(s\) : HP, Glycol/)).toBeTruthy();
  });

  it("refuse d'enregistrer une fiche incomplète, et DIT lesquels", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(screen.getByText(/champs obligatoires sont vides/)).toBeTruthy();
    expect(screen.getByText(/À remplir :/)).toBeTruthy();
  });

  it("avertit d'un pH aberrant SANS bloquer l'enregistrement", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YMX"));
    fireEvent.change(within(champ("ph")).getByRole("textbox"), { target: { value: "15,2" } });
    // Le repère court est à côté du champ, la phrase entière dans le
    // récapitulatif — une seule fois chacun.
    expect(within(champ("ph")).getByText("à vérifier")).toBeTruthy();
    expect(screen.getByText(/pH : 15.2 sort de l'intervalle habituel \(0 à 14\)/)).toBeTruthy();
    // Le bouton ne compte QUE les champs obligatoires vides : une anomalie
    // n'empêche pas d'enregistrer.
    expect(screen.getByRole("button", { name: "Enregistrer — 3 champ(s) à remplir" })).toBeTruthy();
  });

  it("marque « non mesuré » d'un appui, et le défait du suivant", () => {
    render(<Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} />);
    fireEvent.click(bouton("YMX"));
    const basculer = within(champ("temperature")).getByRole("button", { name: "-" });
    fireEvent.click(basculer);
    expect(within(champ("temperature")).getByPlaceholderText("non mesuré")).toBeTruthy();
    fireEvent.click(basculer);
    expect(within(champ("temperature")).queryByPlaceholderText("non mesuré")).toBeNull();
  });

  it("enregistre une fiche complète et garde l'aéroport pour la suivante", async () => {
    const surEnregistrement = vi.fn();
    render(
      <Formulaire reglages={REGLAGES_DEFAUT} points={POINTS} surEnregistrement={surEnregistrement} />
    );
    fireEvent.click(bouton("YUL"));
    fireEvent.change(screen.getByPlaceholderText(/Filtrer parmi/), { target: { value: "RP-102" } });
    fireEvent.click(within(champ("point")).getByRole("button", { name: POINT_RP102 }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer — RP-102/ }));

    expect(await screen.findByText(/Fiche enregistrée : YUL · RP-102/)).toBeTruthy();
    expect(surEnregistrement).toHaveBeenCalled();
    // L'aéroport est reconduit (donc ses « - » aussi), le point est reparti à zéro.
    expect(bouton("YUL").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByPlaceholderText("non mesuré")).toHaveLength(4);
    // …et le point, la matrice et la méthode sont repartis à zéro.
    expect(screen.getByRole("button", { name: "Enregistrer — 3 champ(s) à remplir" })).toBeTruthy();
  });
});

describe("l'application entière", () => {
  /* C'EST LE MONTAGE QUI COMPTE ICI. `App` importe la couche Microsoft, qui
   * importe MSAL : une bibliothèque qui lèverait au chargement rendrait
   * l'application entièrement blanche, et la construction n'en dirait rien. */
  it("se monte sans réglages et le DIT, au lieu de rester muette", async () => {
    render(<App />);
    expect(await screen.findByText("Fiches Terrain")).toBeTruthy();
    expect(screen.getByText(/fichier Excel non relié/)).toBeTruthy();
    expect(screen.getByText("à jour")).toBeTruthy();
  });

  it("navigue entre les quatre onglets sans rien casser", async () => {
    render(<App />);
    for (const [onglet, repere] of [
      ["Envois", /Aucune fiche enregistrée/],
      ["Points", /62 point\(s\) à YUL/],
      ["Réglages", /1\. Connexion Microsoft/],
      // Sans aéroport choisi, la fiche ne montre pas encore la liste des
      // points : c'est l'invitation à le choisir qui s'affiche à sa place.
      ["Fiche", /Choisir l'aéroport pour voir ses points/],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: onglet }));
      expect(await screen.findByText(repere)).toBeTruthy();
    }
  });
});

describe("l'écran des points", () => {
  it("se monte et compte ce qui reste à attribuer", () => {
    render(<Points points={POINTS} surChangement={() => {}} />);
    expect(screen.getByText(/62 point\(s\) à YUL/)).toBeTruthy();
    expect(screen.getByText(/sans matrice/)).toBeTruthy();
  });

  it("attribue une matrice en lot, et annonce le nombre visé", () => {
    const surChangement = vi.fn();
    render(<Points points={POINTS} surChangement={surChangement} />);
    fireEvent.change(screen.getByPlaceholderText(/Préfixe/), { target: { value: "F06D" } });
    const appliquer = screen.getByRole("button", { name: /Appliquer à 6 point\(s\)/ });
    fireEvent.click(appliquer);
    expect(surChangement).toHaveBeenCalled();
  });

  it("montre l'héritage d'un contrôle qualité plutôt que des boutons", () => {
    render(<Points points={POINTS} surChangement={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Filtrer…"), { target: { value: "B1-CQ" } });
    const ligne = screen.getByText("B1-CQ").closest("li");
    expect(within(ligne).getByText(/contrôle qualité de B1/)).toBeTruthy();
    expect(within(ligne).queryByRole("button")).toBeNull();
  });

  it("refuse un point en doublon et le dit", () => {
    render(<Points points={POINTS} surChangement={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Nom du point à YUL/), { target: { value: "B1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(screen.getByText(/« B1 » est déjà dans la liste de YUL/)).toBeTruthy();
  });
});
