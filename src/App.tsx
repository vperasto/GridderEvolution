import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, Dir } from './game/engine';
import { audio } from './game/audio';
import { getHighScores, saveHighScore, subscribeToHighScores, translations, Language, HighScore } from './game/meta';
import { Volume2, VolumeX, Maximize, Minimize, Pause, Play, Eye, Trophy, Heart, Layers, Timer, Zap, Settings } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<string>('title');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(1000);
  const [cutCooldown, setCutCooldown] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const [colorblind, setColorblind] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [startLevel, setStartLevel] = useState(1);
  
  const [musicVol, setMusicVol] = useState(0.5);
  const [musicMuted, setMusicMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [dismissPortraitWarning, setDismissPortraitWarning] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<'about' | 'enemies'>('about');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    engine.onTimeChange = setTimeLeft;
    engine.onCooldownChange = setCutCooldown;
    engine.onCountdownChange = setCountdown;
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
    
    // Subscribe to high scores instead of just getting them once
    const unsubscribe = subscribeToHighScores((scores) => {
      setHighScores(scores);
    });

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

    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        engine.width = canvas.width;
        engine.height = canvas.height;
        if (engine.state === 'playing') engine.loadLevel(); // Reload to adjust grid
      }, 200);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      if (unsubscribe) unsubscribe();
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
        if (key === ' ') eng.cutLine();
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
      saveHighScore(playerName, score); // Fire and forget, Firebase handles it in background
      engineRef.current?.init(); // Go back to title immediately
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
        {(gameState === 'playing' || gameState === 'countdown') && (
          <div className="relative flex justify-center items-start w-full drop-shadow-[0_0_5px_rgba(0,136,255,0.8)]">
            
            {/* Main HUD Panel */}
            <div className="flex flex-wrap justify-center items-center gap-x-2 sm:gap-x-4 md:gap-x-6 gap-y-1 text-[10px] sm:text-xs md:text-base lg:text-xl font-bold mt-12 sm:mt-2">
              
              <div className="flex items-center gap-1 sm:gap-2" title={t.score}>
                <Trophy size={14} className="text-[#0088FF] sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                <span className="text-white min-w-[3ch]">{score}</span>
              </div>
              
              <span className="text-[#0088FF]/50 hidden sm:inline">|</span>
              
              <div className="flex items-center gap-1 sm:gap-2" title={t.lives}>
                <Heart size={14} className="text-[#0088FF] sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                <span className="text-white">{lives}</span>
              </div>
              
              <span className="text-[#0088FF]/50 hidden sm:inline">|</span>
              
              <div className="flex items-center gap-1 sm:gap-2" title={t.level}>
                <Layers size={14} className="text-[#0088FF] sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                <span className="text-white">{level}</span>
              </div>
              
              <span className="text-[#0088FF]/50 hidden sm:inline">|</span>
              
              <div className={`flex items-center gap-1 sm:gap-2 ${timeLeft < 200 ? "text-[#FF7777] animate-pulse" : ""}`} title="Time">
                <Timer size={14} className="text-[#0088FF] sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                <span className={timeLeft < 200 ? "text-[#FF7777]" : "text-white min-w-[3ch]"}>{Math.ceil(timeLeft)}</span>
              </div>
              
              <span className="text-[#0088FF]/50 hidden sm:inline">|</span>
              
              <div className={`flex items-center gap-1 sm:gap-2 ${cutCooldown > 0 ? "text-[#FF7777]" : "text-[#00CC55]"}`} title={t.cut}>
                <Zap size={14} className="text-[#0088FF] sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                <span className="min-w-[4ch]">{cutCooldown > 0 ? Math.ceil(cutCooldown) : t.cutReady}</span>
              </div>
              
            </div>

            {/* Pause Button */}
            <div className="absolute right-0 top-0 mt-1 mr-1">
              <button onClick={handlePause} className="pointer-events-auto text-[#0088FF] hover:text-white transition-colors drop-shadow-[0_0_5px_rgba(0,136,255,0.8)]" title="Pause (P)">
                {isPaused ? <Play size={24} className="md:w-8 md:h-8 lg:w-10 lg:h-10" /> : <Pause size={24} className="md:w-8 md:h-8 lg:w-10 lg:h-10" />}
              </button>
            </div>
            
          </div>
        )}

        {/* Countdown Screen */}
        {gameState === 'countdown' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-none">
            <h2 className="text-6xl md:text-8xl font-bold text-[#FFFFFF] mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
              {Math.ceil(countdown)}
            </h2>
            <h2 className="text-4xl md:text-6xl font-bold text-[#FF7777] animate-pulse-text drop-shadow-[0_0_15px_rgba(255,119,119,0.8)]">
              {t.timeReset}
            </h2>
          </div>
        )}

        {/* Floating Message */}
        {message && (
          <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 text-xl md:text-3xl font-bold text-[#EEEE77] animate-pulse-text drop-shadow-[0_0_10px_rgba(238,238,119,0.8)]">
            {message}
          </div>
        )}

        {/* Settings Controls (Top Left) */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4 flex flex-col items-start gap-2 pointer-events-auto z-50">
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="bg-black/50 p-2 md:p-3 rounded border border-[#0088FF]/30 text-[#0088FF] hover:text-white transition-colors"
            title="Settings"
          >
            <Settings size={20} className={`md:w-6 md:h-6 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90' : ''}`} />
          </button>

          {isSettingsOpen && (
            <>
              <div className="flex flex-col items-center gap-2 md:gap-4 bg-black/50 p-2 md:p-3 rounded border border-[#0088FF]/30 animate-in fade-in slide-in-from-top-2 duration-200">
                <button 
                  onClick={() => setLang(lang === 'fi' ? 'en' : 'fi')}
                  className="text-[#0088FF] hover:text-white font-bold text-xs md:text-sm transition-colors"
                  title={t.language}
                >
                  {lang.toUpperCase()}
                </button>
                <button onClick={() => setColorblind(!colorblind)} className={`${colorblind ? 'text-[#00CC55]' : 'text-[#0088FF] hover:text-white'} transition-colors`} title={t.colorblind}>
                  <Eye size={20} className="md:w-6 md:h-6" />
                </button>
                <button onClick={toggleMute} className="text-[#0088FF] hover:text-white transition-colors" title="Mute Music">
                  {musicMuted ? <VolumeX size={20} className="md:w-6 md:h-6" /> : <Volume2 size={20} className="md:w-6 md:h-6" />}
                </button>
                <button onClick={toggleFullscreen} className="text-[#0088FF] hover:text-white transition-colors" title="Fullscreen">
                  {isFullscreen ? <Minimize size={20} className="md:w-6 md:h-6" /> : <Maximize size={20} className="md:w-6 md:h-6" />}
                </button>
              </div>
              
              {/* Volume Slider (only show if not muted) */}
              {!musicMuted && (
                <div className="flex flex-col items-center gap-2 md:gap-3 bg-black/50 py-2 md:py-3 w-full rounded border border-[#0088FF]/30 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                  <Volume2 size={14} className="md:w-4 md:h-4" />
                  <div className="relative w-4 h-16 sm:h-24 md:h-32 flex items-center justify-center">
                    <input 
                      type="range" min="0" max="1" step="0.05" 
                      value={musicVol} onChange={handleVolumeChange}
                      className="absolute w-16 sm:w-24 md:w-32 h-2 bg-[#0088FF]/30 rounded-lg appearance-none cursor-pointer -rotate-90 origin-center"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Portrait Warning */}
        {isPortrait && !dismissPortraitWarning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 pointer-events-auto z-[100] p-8 text-center">
            <div className="border-4 border-[#0088FF] p-8 rounded-xl max-w-md bg-black/80 shadow-[0_0_30px_rgba(0,136,255,0.5)]">
              <Maximize size={64} className="text-[#0088FF] mx-auto mb-6 animate-pulse rotate-90" />
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {lang === 'fi' ? 'Käännä laitteesi' : 'Rotate your device'}
              </h2>
              <p className="text-[#AAFFEE] mb-8">
                {lang === 'fi' 
                  ? 'Peli on suunniteltu pelattavaksi vaakatasossa. Käännä laitteesi parhaan pelikokemuksen saamiseksi.' 
                  : 'The game is designed to be played in landscape mode. Please rotate your device for the best experience.'}
              </p>
              <button 
                onClick={() => setDismissPortraitWarning(true)}
                className="px-6 py-3 border-2 border-[#FF7777] text-[#FF7777] font-bold hover:bg-[#FF7777] hover:text-black transition-colors rounded"
              >
                {lang === 'fi' ? 'Jatka pystynäytöllä' : 'Continue in portrait'}
              </button>
            </div>
          </div>
        )}

        {/* Title Screen */}
        {gameState === 'title' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 pointer-events-auto py-4 px-4 overflow-hidden">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-[#EEEE77] mb-6 md:mb-10 tracking-widest drop-shadow-[0_0_15px_rgba(238,238,119,0.8)] text-center leading-tight">
              GRIDDER<br/>EVOLUTION
            </h1>
            
            <div className="flex flex-col items-center gap-4 md:gap-8">
              <button 
                onClick={startGame}
                className="px-8 py-3 md:px-12 md:py-4 border-4 border-[#0088FF] text-[#0088FF] text-xl md:text-2xl font-bold hover:bg-[#0088FF] hover:text-black transition-colors animate-pulse-text"
              >
                {t.start}
              </button>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowHighScores(true)}
                  className="px-4 py-2 border-2 border-[#AAFFEE] text-[#AAFFEE] text-sm md:text-base font-bold hover:bg-[#AAFFEE] hover:text-black transition-colors h-[42px]"
                >
                  {t.highScores}
                </button>

                <button 
                  onClick={() => setShowInfo(true)}
                  className="px-4 py-2 border-2 border-gray-400 text-gray-400 text-sm md:text-base font-bold hover:bg-gray-400 hover:text-black transition-colors h-[42px]"
                >
                  {t.info}
                </button>
              </div>
            </div>
            
            <div className="absolute bottom-2 text-[10px] md:text-xs text-gray-500 text-center w-full max-w-md px-4">
              {t.controls}
            </div>

            {/* Info Modal */}
            {showInfo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-[200] p-4">
                <div className="border-2 border-gray-400 bg-black p-6 w-full max-w-md flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl md:text-2xl text-gray-300 font-bold">{t.infoTitle}</h2>
                    <button 
                      onClick={() => setShowInfo(false)}
                      className="text-[#FF7777] hover:text-white text-3xl font-bold leading-none"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="flex gap-4 mb-4 border-b border-gray-800 pb-2">
                    <button
                      onClick={() => setInfoTab('about')}
                      className={`text-sm md:text-base font-bold transition-colors ${infoTab === 'about' ? 'text-[#AAFFEE]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {t.infoTabAbout}
                    </button>
                    <button
                      onClick={() => setInfoTab('enemies')}
                      className={`text-sm md:text-base font-bold transition-colors ${infoTab === 'enemies' ? 'text-[#AAFFEE]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {t.infoTabEnemies}
                    </button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 pr-2 text-gray-400 text-sm md:text-base space-y-4">
                    {infoTab === 'about' ? (
                      <>
                        <p className="text-white leading-relaxed">
                          {t.infoDesc}
                        </p>
                        <p className="text-[#AAFFEE]">
                          {t.infoMusic}
                        </p>
                        
                        <div className="pt-4 border-t border-gray-800 mt-4">
                          <div className="flex flex-col items-center gap-2">
                            <label className="text-[#AAFFEE] text-xs md:text-sm">{t.testLevel}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={startLevel}
                                onChange={(e) => setStartLevel(Math.max(1, parseInt(e.target.value) || 1))}
                                className="bg-transparent border-2 border-[#0088FF] text-center text-lg text-white w-16 p-1 outline-none"
                              />
                              <button 
                                onClick={() => { setShowInfo(false); startGame(); }}
                                className="px-4 py-1 border-2 border-[#0088FF] text-[#0088FF] font-bold hover:bg-[#0088FF] hover:text-black transition-colors"
                              >
                                {t.start}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-800 text-xs text-gray-500 text-center">
                          {t.infoCopyright}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-6">
                        {/* Regular Enemies */}
                        <div>
                          <h3 className="text-lg text-white font-bold mb-3 border-b border-gray-800 pb-1">{t.enemiesHeader}</h3>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-4 h-4 mt-1 bg-[#FF7777] shrink-0" />
                              <div>
                                <div className="text-[#FF7777] font-bold">{t.enemySpark}</div>
                                <div className="text-sm text-gray-400">{t.enemySparkDesc}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-4 h-4 mt-1 bg-[#AAFFEE] shrink-0" />
                              <div>
                                <div className="text-[#AAFFEE] font-bold">{t.enemyStalker}</div>
                                <div className="text-sm text-gray-400">{t.enemyStalkerDesc}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bosses */}
                        <div>
                          <h3 className="text-lg text-white font-bold mb-3 border-b border-gray-800 pb-1">{t.bossesHeader}</h3>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 mt-0.5 bg-[#CC44CC] shrink-0" />
                              <div>
                                <div className="text-[#CC44CC] font-bold">{t.bossClassic}</div>
                                <div className="text-sm text-gray-400">{t.bossClassicDesc}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 mt-0.5 bg-[#8A2BE2] shrink-0 rounded-full" />
                              <div>
                                <div className="text-[#8A2BE2] font-bold">{t.bossWeaver}</div>
                                <div className="text-sm text-gray-400">{t.bossWeaverDesc}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 mt-0.5 bg-[#FF4500] shrink-0" />
                              <div>
                                <div className="text-[#FF4500] font-bold">{t.bossDasher}</div>
                                <div className="text-sm text-gray-400">{t.bossDasherDesc}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 mt-0.5 bg-[#32CD32] shrink-0" />
                              <div>
                                <div className="text-[#32CD32] font-bold">{t.bossSplitter}</div>
                                <div className="text-sm text-gray-400">{t.bossSplitterDesc}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 mt-0.5 bg-[#808080] shrink-0" />
                              <div>
                                <div className="text-[#808080] font-bold">{t.bossTurret}</div>
                                <div className="text-sm text-gray-400">{t.bossTurretDesc}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 mt-0.5 bg-[#00FFFF] shrink-0" />
                              <div>
                                <div className="text-[#00FFFF] font-bold">{t.bossTeleporter}</div>
                                <div className="text-sm text-gray-400">{t.bossTeleporterDesc}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* High Scores Modal */}
            {showHighScores && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-[200] p-4">
                <div className="border-2 border-[#AAFFEE] bg-black p-6 w-full max-w-sm flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl md:text-2xl text-[#AAFFEE] font-bold">{t.highScores}</h2>
                    <button 
                      onClick={() => setShowHighScores(false)}
                      className="text-[#FF7777] hover:text-white text-3xl font-bold leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 pr-2">
                    {highScores.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4">-</div>
                    ) : (
                      highScores.map((hs, i) => (
                        <div key={i} className="text-sm md:text-lg flex justify-between w-full mb-2 border-b border-gray-800 pb-1">
                          <span className="text-white">{hs.name}</span>
                          <span className="text-[#0088FF] font-bold">{hs.score}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
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
