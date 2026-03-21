export const HIGH_SCORES_KEY = 'gridder_evolution_scores';

export interface HighScore {
  name: string;
  score: number;
}

export function saveHighScore(name: string, score: number) {
  let scores = getHighScores();
  scores.push({ name: name.toUpperCase().substring(0, 3), score });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 5);
  localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(scores));
}

export function getHighScores(): HighScore[] {
  try {
    const data = localStorage.getItem(HIGH_SCORES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Could not read high scores", e);
  }
  return [
    { name: "CPU", score: 1000 },
    { name: "C64", score: 500 },
    { name: "SID", score: 100 }
  ];
}

export const translations = {
  fi: {
    start: "PAINA START",
    score: "PISTEET",
    level: "TASO",
    lives: "ELÄMÄT",
    gameOver: "PELI OHI",
    enterName: "ANNA NIMI (3 KIRJAINTA)",
    highScores: "KUNNIAGALLERIA",
    combo: "YHDISTELMÄ!",
    boss: "POMOTAISTELU!",
    mutation: "KENTTÄ MUUTTUU!",
    perkSpeed: "NOPEUS!",
    perkFreeze: "JÄÄDYTYS!",
    perkShield: "KILPI!",
    perkDouble: "TUPLAPISTEET!",
    language: "EN",
    colorblind: "VÄRISOKEUSMOODI",
    controls: "Liiku pyyhkäisemällä tai nuolinäppäimillä",
    testModeNoScore: "TESTITILA - PISTEITÄ EI TALLENNETA",
    returnToTitle: "PALAA ALKUUN",
    testLevel: "TESTIKENTTÄ (DEV):"
  },
  en: {
    start: "PRESS START",
    score: "SCORE",
    level: "LEVEL",
    lives: "LIVES",
    gameOver: "GAME OVER",
    enterName: "ENTER NAME (3 LETTERS)",
    highScores: "HALL OF FAME",
    combo: "COMBO!",
    boss: "BOSS LEVEL!",
    mutation: "GRID MUTATION!",
    perkSpeed: "SPEED!",
    perkFreeze: "FREEZE!",
    perkShield: "SHIELD!",
    perkDouble: "DOUBLE POINTS!",
    language: "FI",
    colorblind: "COLORBLIND MODE",
    controls: "Swipe or use arrow keys to move",
    testModeNoScore: "TEST MODE - SCORE NOT SAVED",
    returnToTitle: "RETURN TO TITLE",
    testLevel: "TEST LEVEL (DEV):"
  }
};

export type Language = 'fi' | 'en';
