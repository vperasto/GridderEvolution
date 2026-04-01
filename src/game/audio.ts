import bgMusicUrl from '../mp3/Before_the_Final_Gate_original.mp3';
import bossMusicUrl from '../mp3/Heartbeat_Under_Steel.mp3';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  public enabled = false;
  private bgMusic: HTMLAudioElement | null = null;
  private bossMusic: HTMLAudioElement | null = null;
  private currentMusic: HTMLAudioElement | null = null;
  private fadeInterval: number | null = null;
  
  private _musicVolume = 0.5;
  public get musicVolume() { return this._musicVolume; }
  public set musicVolume(v: number) {
    this._musicVolume = v;
    if (this.currentMusic && !this.fadeInterval) {
      this.currentMusic.volume = v;
    }
  }

  private _musicMuted = false;
  public get musicMuted() { return this._musicMuted; }
  public set musicMuted(v: boolean) {
    this._musicMuted = v;
    if (this.bgMusic) this.bgMusic.muted = v;
    if (this.bossMusic) this.bossMusic.muted = v;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.enabled = true;
      
      this.bgMusic = new Audio(bgMusicUrl);
      this.bgMusic.loop = true;
      this.bgMusic.muted = this._musicMuted;

      this.bossMusic = new Audio(bossMusicUrl);
      this.bossMusic.loop = true;
      this.bossMusic.muted = this._musicMuted;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration: number, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    // Simple lowpass filter for explosion sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  playCapture() {
    this.playTone(440, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(880, 'square', 0.15, 0.1), 100);
  }

  playMove() {
    // this.playTone(200, 'triangle', 0.05, 0.05); // Disabled so it doesn't clash with music
  }

  playHit() {
    if (!this.enabled || !this.ctx) return;
    
    // SFX - Player Hit
    const tempo = 200;
    const stepDurationMs = 50;
    const stepDurationSec = stepDurationMs / 1000;
    
    const freqs: Record<string, number> = {
      "G3": 196.00, "Eb3": 155.56, "C3": 130.81, "A2": 110.00
    };
    
    const sections = [
      {
        tempo: 200,
        vol: 1.0,
        rows: [
          ["G3", "N"],
          ["Eb3", "-"],
          ["C3", "-"],
          ["A2", "-"]
        ]
      }
    ];
    
    let timeOffset = 0;
    
    sections.forEach(section => {
      const currentStepDuration = (60 / section.tempo) / 4; // 16th notes
      
      section.rows.forEach(row => {
        const note1 = row[0];
        const perc = row[1];
        
        if (note1 !== '-') {
          setTimeout(() => {
            this.playTone(freqs[note1] * 0.5, 'triangle', currentStepDuration * 1.5, 0.6 * section.vol);
          }, timeOffset * 1000);
        }
        if (perc === 'N') {
          setTimeout(() => {
            // "CH4_hh": { "type": "noise", "volume": 0.25, "envelope": { "attack_ms": 1, "release_at": 0.4 } }
            // "N": { "filter": "highpass", "filter_hz": 4000, "filter_q": 1, "volume": 0.3, "duration_ms": 100 }
            this.playNoise(0.1, 0.4 * section.vol); // Simple noise for now, or we can use the specific filter
          }, timeOffset * 1000);
        }
        
        timeOffset += currentStepDuration;
      });
    });
  }

  playDeath() {
    if (!this.enabled || !this.ctx) return;
    
    // SFX - Player Death
    const tempo = 110;
    const stepDurationMs = 140;
    const stepDurationSec = stepDurationMs / 1000;
    
    const freqs: Record<string, number> = {
      "C4": 261.63, "Gb4": 369.99, "F4": 349.23, "D4": 293.66, "B3": 246.94, "Ab3": 207.65, "G3": 196.00, "F3": 174.61
    };
    
    const sections = [
      {
        tempo: 110,
        vol: 1.0,
        rows: [
          ["Gb4", "C4"],
          ["-", "-"],
          ["F4", "B3"],
          ["-", "-"]
        ]
      },
      {
        tempo: 80,
        vol: 0.9,
        rows: [
          ["D4", "Ab3"],
          ["-", "-"],
          ["B3", "F3"],
          ["-", "-"]
        ]
      },
      {
        tempo: 50,
        vol: 0.8,
        rows: [
          ["Ab3", "D3"], // D3 is not in freqs, but let's calculate it or just use F3. Actually, D3 is 146.83
          ["-", "-"],
          ["-", "-"],
          ["-", "-"]
        ]
      }
    ];
    
    // Add D3 to freqs just in case
    freqs["D3"] = 146.83;

    let timeOffset = 0;
    
    sections.forEach(section => {
      const currentStepDuration = (60 / section.tempo) / 4; // 16th notes
      
      section.rows.forEach(row => {
        const note1 = row[0];
        const note2 = row[1];
        
        if (note1 !== '-') {
          setTimeout(() => {
            this.playTone(freqs[note1], 'square', currentStepDuration * 2.5, 0.1 * section.vol);
          }, timeOffset * 1000);
        }
        if (note2 !== '-') {
          setTimeout(() => {
            this.playTone(freqs[note2] * 0.5, 'triangle', currentStepDuration * 3.0, 0.1 * section.vol);
          }, timeOffset * 1000);
        }
        
        timeOffset += currentStepDuration;
      });
    });
  }

  playLevelComplete() {
    if (!this.enabled || !this.ctx) return;
    
    // SFX - Level Complete
    const tempo = 120;
    
    const freqs: Record<string, number> = {
      "C4": 261.63, "E4": 329.63, "G4": 392.00, "C5": 523.25, "E5": 659.25, "G5": 783.99, "C6": 1046.50
    };
    
    const sections = [
      {
        tempo: 120,
        vol: 1.0,
        rows: [
          ["G5", "C4"],
          ["C6", "E4"],
          ["-", "-"],
          ["G5", "G4"],
          ["-", "-"],
          ["C6", "C5"],
          ["-", "-"],
          ["-", "-"]
        ]
      }
    ];
    
    let timeOffset = 0;
    
    sections.forEach(section => {
      const currentStepDuration = (60 / section.tempo) / 4; // 16th notes
      
      section.rows.forEach(row => {
        const note1 = row[0];
        const note2 = row[1];
        
        if (note1 !== '-') {
          setTimeout(() => {
            this.playTone(freqs[note1], 'square', currentStepDuration * 2.0, 0.1 * section.vol);
          }, timeOffset * 1000);
        }
        if (note2 !== '-') {
          setTimeout(() => {
            this.playTone(freqs[note2] * 0.5, 'triangle', currentStepDuration * 2.0, 0.1 * section.vol);
          }, timeOffset * 1000);
        }
        
        timeOffset += currentStepDuration;
      });
    });
  }

  playExplosion() {
    this.playNoise(0.5, 0.3);
    this.playTone(100, 'sawtooth', 0.3, 0.2);
  }

  playPowerup() {
    if (!this.enabled || !this.ctx) return;
    
    // SFX - Perk Collected
    const tempo = 180;
    
    const freqs: Record<string, number> = {
      "C5": 523.25, "E5": 659.25, "G5": 783.99, "C6": 1046.50
    };
    
    const sections = [
      {
        tempo: 180,
        vol: 1.0,
        rows: [
          ["C5"],
          ["E5"],
          ["G5"],
          ["C6"]
        ]
      }
    ];
    
    let timeOffset = 0;
    
    sections.forEach(section => {
      const currentStepDuration = (60 / section.tempo) / 4; // 16th notes
      
      section.rows.forEach(row => {
        const note1 = row[0];
        
        if (note1 !== '-') {
          setTimeout(() => {
            this.playTone(freqs[note1], 'square', currentStepDuration * 1.0, 0.1 * section.vol);
          }, timeOffset * 1000);
        }
        
        timeOffset += currentStepDuration;
      });
    });
  }

  playBossWarning() {
    if (!this.enabled || !this.ctx) return;
    // High-pitched alarming sound
    this.playTone(800, 'square', 0.1, 0.15);
    setTimeout(() => this.playTone(800, 'square', 0.1, 0.15), 150);
  }

  playBossAbility() {
    if (!this.enabled || !this.ctx) return;
    // Deep swoosh or impact
    this.playNoise(0.4, 0.3);
    this.playTone(150, 'sawtooth', 0.4, 0.2);
    setTimeout(() => this.playTone(100, 'sawtooth', 0.3, 0.2), 100);
  }

  private lastBossHitTime = 0;

  playBossHit() {
    if (!this.enabled || !this.ctx) return;
    const now = Date.now();
    if (now - this.lastBossHitTime < 200) return;
    this.lastBossHitTime = now;
    // Metallic clank or heavy hit
    this.playNoise(0.2, 0.4);
    this.playTone(200, 'square', 0.1, 0.2);
    setTimeout(() => this.playTone(150, 'square', 0.1, 0.2), 50);
  }

  playStart() {
    [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'square', 0.2, 0.1), i * 150);
    });
  }

  // Advanced Music Engine Data removed for future mp3 music
  
  startMusic(isBoss: boolean = false, forceTrackIdx?: number) {
    if (!this.enabled || !this.bgMusic || !this.bossMusic) return;

    const targetMusic = isBoss ? this.bossMusic : this.bgMusic;

    if (this.currentMusic === targetMusic) {
      // Already playing the correct track
      if (this.currentMusic.paused) {
        this.currentMusic.volume = this._musicVolume;
        this.currentMusic.play().catch(e => console.warn("Music play blocked by browser:", e));
      }
      return;
    }

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const previousMusic = this.currentMusic;
    this.currentMusic = targetMusic;
    
    // Start new track at 0 volume
    this.currentMusic.volume = 0;
    this.currentMusic.play().catch(e => console.warn("Music play blocked by browser:", e));

    const fadeDuration = 2000; // 2 seconds crossfade
    const steps = 20;
    const stepTime = fadeDuration / steps;
    let currentStep = 0;

    this.fadeInterval = window.setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      // Fade out previous
      if (previousMusic) {
        previousMusic.volume = Math.max(0, this._musicVolume * (1 - progress));
      }
      
      // Fade in new
      if (this.currentMusic) {
        this.currentMusic.volume = Math.min(this._musicVolume, this._musicVolume * progress);
      }

      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        if (previousMusic) {
          previousMusic.pause();
          previousMusic.currentTime = 0;
        }
        if (this.currentMusic) {
           this.currentMusic.volume = this._musicVolume;
        }
      }
    }, stepTime);
  }

  stopMusic() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
    if (this.bossMusic) {
      this.bossMusic.pause();
      this.bossMusic.currentTime = 0;
    }
    this.currentMusic = null;
  }
}

export const audio = new AudioEngine();
