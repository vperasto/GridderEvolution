import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';

export const HIGH_SCORES_KEY = 'gridder_evolution_scores';

export interface HighScore {
  name: string;
  score: number;
}

const defaultScores: HighScore[] = [
  { name: "CPU", score: 1000 },
  { name: "C64", score: 500 },
  { name: "SID", score: 100 }
];

export async function saveHighScore(name: string, score: number) {
  try {
    const scoresRef = collection(db, 'highscores');
    await addDoc(scoresRef, {
      name: name.toUpperCase().substring(0, 3),
      score,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Error saving high score to Firebase", e);
    // Fallback to local storage if offline/error
    try {
      let scores = await getHighScores();
      scores.push({ name: name.toUpperCase().substring(0, 3), score });
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 5);
      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(scores));
    } catch (err) {
      console.error("Local storage fallback failed", err);
    }
  }
}

export async function getHighScores(): Promise<HighScore[]> {
  try {
    const q = query(collection(db, 'highscores'), orderBy('score', 'desc'), limit(5));
    const querySnapshot = await getDocs(q);
    const scores: HighScore[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      scores.push({ name: data.name, score: data.score });
    });
    
    if (scores.length === 0) {
      return defaultScores;
    }
    return scores;
  } catch (e) {
    console.error("Could not read high scores from Firebase", e);
    // Fallback to local storage
    try {
      const data = localStorage.getItem(HIGH_SCORES_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Could not read high scores from local storage", err);
    }
    return defaultScores;
  }
}

export function subscribeToHighScores(callback: (scores: HighScore[]) => void) {
  try {
    const q = query(collection(db, 'highscores'), orderBy('score', 'desc'), limit(5));
    return onSnapshot(q, (querySnapshot) => {
      const scores: HighScore[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        scores.push({ name: data.name, score: data.score });
      });
      
      if (scores.length === 0) {
        callback(defaultScores);
      } else {
        callback(scores);
      }
    }, (error) => {
      console.error("Error subscribing to high scores:", error);
      // Fallback to local storage on error
      getHighScores().then(callback);
    });
  } catch (e) {
    console.error("Failed to setup snapshot listener", e);
    getHighScores().then(callback);
    return () => {}; // Return empty unsubscribe function
  }
}

export const translations = {
  fi: {
    start: "START",
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
    testLevel: "TESTIKENTTÄ (DEV):",
    timeReset: "AIKA ALKAA ALUSTA",
    cut: "OIKOSULKU",
    cutReady: "VALMIS",
    info: "TIETOA",
    infoTitle: "TIETOA PELISTÄ",
    infoTabAbout: "YLEISTÄ",
    infoTabEnemies: "VIHOLLISET",
    infoDesc: "Gridder Evolution on moderni kyberpunk-henkinen avaruusseikkailu, joka vie klassisen arcade-pelaamisen uudelle tasolle. Inspiraationa on toiminut klassinen C64-peli Super Gridder. Väistä vihollisia, kerää pisteitä ja selviydy muuttuvassa matriisissa!",
    infoMusic: "Musiikki: Tekoälyn generoima.",
    infoCopyright: "© 2026 Vesa Perasto. Kaikki oikeudet pidätetään.",
    enemySpark: "Kipinä",
    enemySparkDesc: "Perusvihollinen. Partioi ruudukkoa satunnaisesti.",
    enemyStalker: "Vainoaja",
    enemyStalkerDesc: "Älykäs vihollinen. Etsii aktiivisesti lyhintä reittiä pelaajan luo.",
    bossClassic: "Klassinen Pomo",
    bossClassicDesc: "Valtava ja hidas, mutta vaarallinen. Seuraa pelaajaa säälimättä.",
    bossWeaver: "Kutoja",
    bossWeaverDesc: "Hämähäkkimäinen pomo. Jättää jälkeensä verkkoja, jotka hidastavat pelaajaa.",
    bossDasher: "Syöksyjä",
    bossDasherDesc: "Latautuu ja syöksyy valtavalla nopeudella kohti pelaajaa.",
    bossSplitter: "Jakautuja",
    bossSplitterDesc: "Jakaantuu pienemmiksi, nopeammiksi minipomoiksi osumasta.",
    bossTurret: "Tykkitorni",
    bossTurretDesc: "Ampuu nopeita ammuksia pelaajaa kohti. Pysy liikkeessä!",
    bossTeleporter: "Teleportoija",
    bossTeleporterDesc: "Katoaa ja ilmestyy yllättäen uuteen paikkaan. Varo punaista varoitusmerkkiä!",
    enemiesHeader: "VIHOLLISET",
    bossesHeader: "POMOT",
  },
  en: {
    start: "START",
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
    testLevel: "TEST LEVEL (DEV):",
    timeReset: "TIME RESET",
    cut: "GLITCH",
    cutReady: "READY",
    info: "INFO",
    infoTitle: "ABOUT THE GAME",
    infoTabAbout: "ABOUT",
    infoTabEnemies: "ENEMIES",
    infoDesc: "Gridder Evolution is a modern cyberpunk-themed space adventure that takes classic arcade gaming to the next level. Inspired by the classic C64 game Super Gridder. Dodge enemies, collect points, and survive in the mutating matrix!",
    infoMusic: "Music: AI-generated.",
    infoCopyright: "© 2026 Vesa Perasto. All rights reserved.",
    enemySpark: "Spark",
    enemySparkDesc: "Basic enemy. Patrols the grid randomly.",
    enemyStalker: "Stalker",
    enemyStalkerDesc: "Smart enemy. Actively seeks the shortest path to the player.",
    bossClassic: "Classic Boss",
    bossClassicDesc: "Huge and slow, but dangerous. Relentlessly pursues the player.",
    bossWeaver: "Weaver",
    bossWeaverDesc: "Spider-like boss. Leaves webs behind that slow down the player.",
    bossDasher: "Dasher",
    bossDasherDesc: "Charges and dashes toward the player at incredible speed.",
    bossSplitter: "Splitter",
    bossSplitterDesc: "Splits into smaller, faster mini-bosses when hit.",
    bossTurret: "Turret",
    bossTurretDesc: "Fires fast projectiles toward the player. Keep moving!",
    bossTeleporter: "Teleporter",
    bossTeleporterDesc: "Disappears and suddenly reappears in a new location. Watch for the red warning sign!",
    enemiesHeader: "ENEMIES",
    bossesHeader: "BOSSES",
  }
};

export type Language = 'fi' | 'en';
