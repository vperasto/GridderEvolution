import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, Dir } from './game/engine';
import { audio } from './game/audio';
import { getHighScores, saveHighScore, translations, Language, HighScore } from './game/meta';
import { Volume2, VolumeX, Maximize, Minimize, Pause, Play, Eye } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<string>('title');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState('');
  const [lang, setLang] = useState<Language>('fi');
  const [colorblind, setColorblind] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [startLevel, setStartLevel] = useState(1);
  
  const [musicVol, setMusicVol] = useState(0.5);
  const [musicMuted, setMusicMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const t = translations[lang];

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
      setIsPaused(engineRef.current.paused);
    }
  };

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.mutationMessage = t.mutation;
    engineRef.current.perkNames = {
      speed: t.perkSpeed,
      freeze: t.perkFreeze,
      shield: t.perkShield,
      double: t.perkDouble
    };
  }, [lang, t]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.colorblind = colorblind;
  }, [colorblind]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    
    engine.onStateChange = setGameState;
    engine.onScoreChange = setScore;
    engine.onLevelChange = setLevel;
    engine.onLivesChange = setLives;
    engine.mutationMessage = t.mutation;
    engine.colorblind = colorblind;
    engine.perkNames = {
      speed: t.perkSpeed,
      freeze: t.perkFreeze,
      shield: t.perkShield,
      double: t.perkDouble
    };
    engine.onMessage = (msg) => {
      setMessage(msg);
      setTimeout(() => setMessage(''), 2000);
    };
    
    engine.init();
    setHighScores(getHighScores());

    let lastTime = performance.now();
    let reqId: number;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      if (dt < 0.1) { // Cap dt to prevent huge jumps
        engine.update(dt);
        engine.render();
      }
      
      reqId = requestAnimationFrame(loop);
    };
    
    reqId = requestAnimationFrame(loop);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      engine.width = canvas.width;
      engine.height = canvas.height;
      if (engine.state === 'playing') engine.loadLevel(); // Reload to adjust grid
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const eng = engineRef.current;
      
      if (eng.state === 'playing') {
        const key = e.key.toLowerCase();
        if (key === 'p') {
          handlePause();
          return;
        }
        if (eng.paused) return;

        if (key === 'arrowup' || key === 'w') eng.setDir('up');
        if (key === 'arrowdown' || key === 's') eng.setDir('down');
        if (key === 'arrowleft' || key === 'a') eng.setDir('left');
        if (key === 'arrowright' || key === 'd') eng.setDir('right');
      } else if (eng.state === 'title' && e.key === 'Enter') {
        startGame();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Touch handling
  const touchStart = useRef<{x: number, y: number} | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || !engineRef.current) return;
    const eng = engineRef.current;
    if (eng.state !== 'playing') return;

    const touchCurrent = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const dx = touchCurrent.x - touchStart.current.x;
    const dy = touchCurrent.y - touchStart.current.y;
    
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) {
        eng.setDir(dx > 0 ? 'right' : 'left');
      } else {
        eng.setDir(dy > 0 ? 'down' : 'up');
      }
      // Reset touch start to allow continuous turning without lifting finger
      touchStart.current = touchCurrent;
    }
  };

  const handleTouchEnd = () => {
    touchStart.current = null;
  };

  const startGame = () => {
    audio.init();
    audio.musicVolume = musicVol;
    audio.musicMuted = musicMuted;
    engineRef.current?.start(startLevel);
  };

  const submitScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.length > 0) {
      saveHighScore(playerName, score);
      setHighScores(getHighScores());
      engineRef.current?.init(); // Go back to title
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setMusicVol(vol);
    audio.musicVolume = vol;
  };

  const toggleMute = () => {
    const newMuted = !musicMuted;
    setMusicMuted(newMuted);
    audio.musicMuted = newMuted;
  };

  useEffect(() => {
    const initAudioOnInteraction = () => {
      if (!audio.enabled) {
        audio.init();
        if (gameState === 'title') {
          audio.startMusic(false, 1);
        }
      }
    };

    window.addEventListener('click', initAudioOnInteraction, { once: true });
    window.addEventListener('touchstart', initAudioOnInteraction, { once: true });
    window.addEventListener('keydown', initAudioOnInteraction, { once: true });

    return () => {
      window.removeEventListener('click', initAudioOnInteraction);
      window.removeEventListener('touchstart', initAudioOnInteraction);
      window.removeEventListener('keydown', initAudioOnInteraction);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'title') {
      audio.stopMusic();
      audio.startMusic(false, 1); // Play menu music (index 1)
    } else if (gameState === 'gameover') {
      // Delay menu music so death sound can play
      const timer = setTimeout(() => {
        audio.stopMusic();
        audio.startMusic(false, 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none touch-none"
         style={{ fontFamily: "'Press Start 2P', monospace" }}
         onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      
      {/* CRT Overlay */}
      <div className="crt-overlay absolute inset-0 pointer-events-none"></div>
      <div className="scanline"></div>

      {/* Game Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full object-contain" />

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 text-[#0088FF]">
        
        {/* HUD */}
        {gameState === 'playing' && (
          <div className="flex justify-between items-center text-sm md:text-xl font-bold drop-shadow-[0_0_5px_rgba(0,136,255,0.8)]">
            <div className="flex gap-4">
              <div>{t.score}: {score}</div>
              <div>{t.lives}: {lives}</div>
              <div>{t.level} {level}</div>
            </div>
            <button onClick={handlePause} className="pointer-events-auto text-[#0088FF] hover:text-white transition-colors" title="Pause (P)">
              {isPaused ? <Play size={32} /> : <Pause size={32} />}
            </button>
          </div>
        )}

        {/* Floating Message */}
        {message && (
          <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 text-xl md:text-3xl font-bold text-[#EEEE77] animate-pulse-text drop-shadow-[0_0_10px_rgba(238,238,119,0.8)]">
            {message}
          </div>
        )}

        {/* Settings Controls (Bottom Right) */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto z-50">
          {/* Volume Slider (only show if not muted) */}
          {!musicMuted && (
            <div className="flex flex-col gap-3 bg-black/50 p-3 rounded border border-[#0088FF]/30 text-xs">
              <div className="flex items-center gap-3">
                <Volume2 size={16} />
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={musicVol} onChange={handleVolumeChange}
                  className="w-24 md:w-32 h-2 bg-[#0088FF]/30 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 bg-black/50 p-3 rounded border border-[#0088FF]/30">
            <button onClick={toggleFullscreen} className="text-[#0088FF] hover:text-white transition-colors" title="Fullscreen">
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
            <button onClick={toggleMute} className="text-[#0088FF] hover:text-white transition-colors" title="Mute Music">
              {musicMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <button onClick={() => setColorblind(!colorblind)} className={`${colorblind ? 'text-[#00CC55]' : 'text-[#0088FF] hover:text-white'} transition-colors`} title={t.colorblind}>
              <Eye size={24} />
            </button>
          </div>
        </div>

        {/* Title Screen */}
        {gameState === 'title' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 pointer-events-auto">
            <h1 className="text-3xl md:text-6xl font-bold text-[#EEEE77] mb-8 tracking-widest drop-shadow-[0_0_15px_rgba(238,238,119,0.8)] text-center leading-tight">
              GRIDDER<br/>EVOLUTION
            </h1>
            
            <button 
              onClick={startGame}
              className="px-8 py-4 mb-8 border-4 border-[#0088FF] text-[#0088FF] text-xl font-bold hover:bg-[#0088FF] hover:text-black transition-colors animate-pulse-text"
            >
              {t.start}
            </button>

            <div className="mb-12 flex flex-col items-center">
              <label className="text-[#AAFFEE] text-sm mb-2">{t.testLevel}</label>
              <input
                type="number"
                min="1"
                max="100"
                value={startLevel}
                onChange={(e) => setStartLevel(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-transparent border-2 border-[#0088FF] text-center text-xl text-white w-24 p-2 outline-none"
              />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-xl text-[#AAFFEE] mb-4">{t.highScores}</h2>
              {highScores.map((hs, i) => (
                <div key={i} className="text-lg flex justify-between w-64 mx-auto mb-2">
                  <span>{hs.name}</span>
                  <span>{hs.score}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setLang(lang === 'fi' ? 'en' : 'fi')}
              className="absolute top-4 right-4 px-4 py-2 border-2 border-gray-500 text-gray-400 hover:text-white text-xs"
            >
              {t.language}
            </button>
            
            <div className="absolute bottom-4 text-xs text-gray-500 text-center w-full">
              {t.controls}
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 pointer-events-auto">
            <h2 className="text-4xl md:text-6xl font-bold text-[#FF7777] mb-8 animate-pulse-text drop-shadow-[0_0_15px_rgba(255,119,119,0.8)]">
              {t.gameOver}
            </h2>
            <div className="text-2xl text-[#EEEE77] mb-12">{t.score}: {score}</div>
            
            {startLevel > 1 ? (
              <div className="flex flex-col items-center">
                <p className="text-[#FF7777] mb-8 text-xl">{t.testModeNoScore}</p>
                <button 
                  onClick={() => engineRef.current?.init()} 
                  className="px-8 py-4 border-4 border-[#AAFFEE] text-[#AAFFEE] text-xl font-bold hover:bg-[#AAFFEE] hover:text-black transition-colors"
                >
                  {t.returnToTitle}
                </button>
              </div>
            ) : (
              <form onSubmit={submitScore} className="flex flex-col items-center">
                <label className="text-sm md:text-base mb-4 text-[#AAFFEE]">{t.enterName}</label>
                <input 
                  type="text" 
                  maxLength={3}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value.toUpperCase())}
                  className="bg-transparent border-b-4 border-[#AAFFEE] text-center text-3xl text-white w-32 outline-none mb-8 uppercase"
                  autoFocus
                />
                <button type="submit" className="px-8 py-4 border-4 border-[#AAFFEE] text-[#AAFFEE] text-xl font-bold hover:bg-[#AAFFEE] hover:text-black transition-colors">
                  OK
                </button>
              </form>
            )}
          </div>
        )}

        {/* Level Transition */}
        {gameState === 'leveltransition' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <h2 className="text-4xl md:text-6xl font-bold text-[#00CC55] animate-pulse-text drop-shadow-[0_0_15px_rgba(0,204,85,0.8)]">
              {level % 5 === 0 ? t.boss : `${t.level} ${level}`}
            </h2>
          </div>
        )}

      </div>
    </div>
  );
}
