export class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private musicInterval: number | null = null;
  private isPlayingMusic = false;
  
  public musicVolume = 0.5;
  public musicMuted = false;
  public musicTempo = 1.0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.enabled = true;
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

  playStart() {
    [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'square', 0.2, 0.1), i * 150);
    });
  }

  // Advanced Music Engine Data
      private tracks = [
    {
      name: "SID Explorer - The Ambient Grid (Amiga MOD Version)",
      tempo: 85,
      channels: {
        CH1: { type: 'triangle' as OscillatorType, octave: 1.0, volume: 0.22, release: 2.5 },
        CH2: { type: 'triangle' as OscillatorType, octave: 0.25, volume: 0.45, release: 4.0 },
        CH3: { type: 'triangle' as OscillatorType, octave: 1.0, volume: 0.08, release: 2.5 }
      },
      sections: [
        { label: 'Intro_Cm', vol: 0.85, rows: [
          ["-", "C2", "D4", "K"], ["-", "-", "B3", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"],
          ["-", "-", "-", "S"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"]
        ]},
        { label: 'Intro_Fm', vol: 0.9, rows: [
          ["-", "F2", "-", "K"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"],
          ["-", "-", "-", "S"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"]
        ]},
        { label: 'Intro_Ab', vol: 0.95, rows: [
          ["-", "Ab2", "-", "K"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"],
          ["-", "-", "-", "S"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"]
        ]},
        { label: 'Intro_G', vol: 1, rows: [
          ["-", "G2", "-", "K"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"],
          ["-", "-", "-", "S"], ["-", "-", "-", "H"], ["-", "-", "-", "-"], ["-", "-", "-", "H"]
        ]},
        { label: 'A_Theme_Cm', vol: 1, rows: [
          ["C5", "C2", "-", "K"], ["D5", "-", "-", "H"], ["Eb5", "-", "C5", "-"], ["G5", "-", "D5", "H"],
          ["C6", "-", "Eb5", "S"], ["G5", "-", "G5", "H"], ["Eb5", "-", "C6", "-"], ["D5", "-", "G5", "H"]
        ]},
        { label: 'A_Theme_Ab', vol: 1, rows: [
          ["F5", "Ab2", "Eb5", "K"], ["G5", "-", "D5", "H"], ["Ab5", "-", "F5", "-"], ["C6", "-", "G5", "H"],
          ["Eb6", "-", "Ab5", "S"], ["C6", "-", "C6", "H"], ["Ab5", "-", "Eb6", "-"], ["G5", "-", "C6", "H"]
        ]},
        { label: 'A_Theme_Fm', vol: 1, rows: [
          ["F5", "F2", "Ab5", "K"], ["G5", "-", "G5", "H"], ["Ab5", "-", "F5", "-"], ["F5", "-", "G5", "H"],
          ["D5", "-", "Ab5", "S"], ["Eb5", "-", "F5", "H"], ["F5", "-", "D5", "-"], ["D5", "-", "Eb5", "H"]
        ]},
        { label: 'A_Theme_G', vol: 1, rows: [
          ["Eb5", "G2", "F5", "K"], ["D5", "-", "D5", "H"], ["C5", "-", "Eb5", "-"], ["Bb4", "-", "D5", "H"],
          ["C5", "-", "C5", "S"], ["D5", "-", "Bb4", "H"], ["Eb5", "-", "C5", "-"], ["F5", "-", "D5", "H"]
        ]},
        { label: 'B_Theme_Eb', vol: 1.05, rows: [
          ["G5", "Eb2", "Eb5", "K"], ["F5", "-", "F5", "H"], ["Eb5", "-", "G5", "-"], ["D5", "-", "F5", "H"],
          ["Eb5", "-", "Eb5", "S"], ["F5", "-", "D5", "H"], ["G5", "-", "Eb5", "-"], ["Bb5", "-", "F5", "H"]
        ]},
        { label: 'B_Theme_Bb', vol: 1.05, rows: [
          ["F5", "Bb2", "G5", "K"], ["Eb5", "-", "Bb5", "H"], ["D5", "-", "F5", "-"], ["C5", "-", "Eb5", "H"],
          ["D5", "-", "D5", "S"], ["Eb5", "-", "C5", "H"], ["F5", "-", "D5", "-"], ["Ab5", "-", "Eb5", "H"]
        ]},
        { label: 'B_Theme_Cm_High', vol: 1.05, rows: [
          ["Eb5", "C2", "F5", "K"], ["F5", "-", "Ab5", "H"], ["G5", "-", "Eb5", "-"], ["C6", "-", "F5", "H"],
          ["Eb6", "-", "G5", "S"], ["D6", "-", "C6", "H"], ["C6", "-", "Eb6", "-"], ["G5", "-", "D6", "H"]
        ]},
        { label: 'B_Theme_G_Turn', vol: 1.05, rows: [
          ["F5", "G2", "C6", "K"], ["D5", "-", "G5", "H"], ["B4", "-", "F5", "-"], ["G4", "-", "D5", "H"],
          ["B4", "-", "B4", "S"], ["D5", "-", "G4", "H"], ["F5", "-", "B4", "-"], ["G5", "-", "D5", "H"]
        ]},
        { label: 'C_Theme_Ab_Climax', vol: 1.1, rows: [
          ["C6", "Ab2", "F5", "K"], ["Eb6", "-", "G5", "H"], ["G6", "-", "C6", "-"], ["Ab6", "-", "Eb6", "H"],
          ["G6", "-", "G6", "S"], ["Eb6", "-", "Ab6", "H"], ["C6", "-", "G6", "-"], ["Ab5", "-", "Eb6", "H"]
        ]},
        { label: 'C_Theme_Eb_Climax', vol: 1.1, rows: [
          ["Bb5", "Eb2", "C6", "K"], ["D6", "-", "Ab5", "H"], ["F6", "-", "Bb5", "-"], ["G6", "-", "D6", "H"],
          ["F6", "-", "F6", "S"], ["D6", "-", "G6", "H"], ["Bb5", "-", "F6", "-"], ["G5", "-", "D6", "H"]
        ]},
        { label: 'C_Theme_Fm_Climax', vol: 1.1, rows: [
          ["Ab5", "F2", "Bb5", "K"], ["C6", "-", "G5", "H"], ["Eb6", "-", "Ab5", "-"], ["F6", "-", "C6", "H"],
          ["Eb6", "-", "Eb6", "S"], ["C6", "-", "F6", "H"], ["Ab5", "-", "Eb6", "-"], ["F5", "-", "C6", "H"]
        ]},
        { label: 'C_Theme_G_Tension', vol: 1.1, rows: [
          ["G5", "G2", "Ab5", "K"], ["B5", "-", "F5", "H"], ["D6", "-", "G5", "-"], ["F6", "-", "B5", "H"],
          ["Ab6", "-", "D6", "S"], ["G6", "-", "F6", "H"], ["F6", "-", "Ab6", "-"], ["D6", "-", "G6", "H"]
        ]},
        { label: 'Bridge_to_Loop_Cm', vol: 1, rows: [
          ["Eb6", "C2", "F6", "K"], ["C6", "-", "D6", "H"], ["G5", "-", "Eb6", "-"], ["Eb5", "-", "C6", "H"],
          ["C5", "-", "G5", "S"], ["G4", "-", "Eb5", "H"], ["Eb4", "-", "C5", "-"], ["C4", "-", "G4", "H"]
        ]},
        { label: 'Bridge_to_Loop_Ab', vol: 0.95, rows: [
          ["C5", "Ab2", "Eb4", "K"], ["Eb5", "-", "C4", "H"], ["Ab5", "-", "C5", "-"], ["C6", "-", "Eb5", "H"],
          ["Ab5", "-", "Ab5", "S"], ["Eb5", "-", "C6", "H"], ["C5", "-", "Ab5", "-"], ["Ab4", "-", "Eb5", "H"]
        ]},
        { label: 'Bridge_to_Loop_G1', vol: 0.9, rows: [
          ["B4", "G2", "C5", "K"], ["D5", "-", "Ab4", "H"], ["G5", "-", "B4", "-"], ["B5", "-", "D5", "H"],
          ["G5", "-", "G5", "S"], ["D5", "-", "B5", "H"], ["B4", "-", "G5", "-"], ["G4", "-", "D5", "H"]
        ]},
        { label: 'Bridge_to_Loop_G2', vol: 0.85, rows: [
          ["D4", "G2", "B4", "K"], ["F4", "-", "G4", "H"], ["G4", "-", "D4", "-"], ["B4", "-", "F4", "H"],
          ["G4", "-", "G4", "S"], ["F4", "-", "B4", "H"], ["D4", "-", "G4", "-"], ["B3", "-", "F4", "H"]
        ]}
      ]
    },
    {
      name: "The Ambient Grid (Menu Edit)",
      tempo: 85,
      channels: {
        CH1: { type: 'triangle' as OscillatorType, octave: 1.0, volume: 0.18, release: 3.0 },
        CH2: { type: 'triangle' as OscillatorType, octave: 0.25, volume: 0.38, release: 4.0 },
        CH3: { type: 'triangle' as OscillatorType, octave: 1.0, volume: 0.07, release: 3.0 }
      },
      sections: [
        { label: 'Menu_Theme_Cm', vol: 0.8, rows: [
          ["C5", "C2", "-", "K"], ["-", "-", "-", "-"], ["Eb5", "-", "C5", "H"], ["-", "-", "-", "-"],
          ["G5", "-", "-", "K"], ["-", "-", "Eb5", "H"], ["C6", "-", "-", "-"], ["-", "-", "G5", "H"]
        ]},
        { label: 'Menu_Theme_Ab', vol: 0.8, rows: [
          ["Ab5", "Ab2", "-", "K"], ["-", "-", "-", "-"], ["C6", "-", "Ab5", "H"], ["-", "-", "-", "-"],
          ["Eb6", "-", "-", "K"], ["-", "-", "C6", "H"], ["C6", "-", "-", "-"], ["-", "-", "Ab5", "H"]
        ]},
        { label: 'Menu_Theme_Fm', vol: 0.8, rows: [
          ["F5", "F2", "-", "K"], ["-", "-", "-", "-"], ["Ab5", "-", "F5", "H"], ["-", "-", "-", "-"],
          ["C6", "-", "-", "K"], ["-", "-", "Ab5", "H"], ["Ab5", "-", "-", "-"], ["-", "-", "F5", "H"]
        ]},
        { label: 'Menu_Theme_G', vol: 0.8, rows: [
          ["G5", "G2", "-", "K"], ["-", "-", "-", "-"], ["B4", "-", "G5", "H"], ["-", "-", "-", "-"],
          ["D5", "-", "-", "K"], ["-", "-", "B4", "H"], ["G4", "-", "-", "-"], ["-", "-", "D5", "H"]
        ]}
      ]
    },
    {
      name: "Project Neon - The Turrican Core",
      tempo: 142,
      channels: {
        CH1: { type: 'square' as OscillatorType, octave: 1.0, volume: 0.18, release: 0.75 },
        CH2: { type: 'triangle' as OscillatorType, octave: 0.25, volume: 0.45, release: 0.8 },
        CH3: { type: 'square' as OscillatorType, octave: 1.0, volume: 0.08, release: 0.5 }
      },
      sections: [
        { label: 'Intro_1_Beat', vol: 0.7, rows: [
          ["-", "-", "-", "K"],
          ["-", "-", "-", "H"],
          ["-", "-", "-", "O"],
          ["-", "-", "-", "H"],
          ["-", "-", "-", "S"],
          ["-", "-", "-", "H"],
          ["-", "-", "-", "O"],
          ["-", "-", "-", "H"]
        ]},
        { label: 'Intro_2_Beat', vol: 0.8, rows: [
          ["-", "-", "-", "K"],
          ["-", "-", "-", "H"],
          ["-", "-", "-", "O"],
          ["-", "-", "-", "H"],
          ["-", "-", "-", "S"],
          ["-", "-", "-", "H"],
          ["-", "-", "-", "O"],
          ["-", "-", "-", "H"]
        ]},
        { label: 'Intro_3_Bass', vol: 0.9, rows: [
          ["-", "D3", "-", "K"],
          ["-", "D3", "-", "H"],
          ["-", "D3", "-", "O"],
          ["-", "D3", "-", "H"],
          ["-", "D3", "-", "S"],
          ["-", "D3", "-", "H"],
          ["-", "F3", "-", "O"],
          ["-", "G3", "-", "H"]
        ]},
        { label: 'Intro_4_Bass_Arp', vol: 1.0, rows: [
          ["-", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["-", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["-", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["-", "F3", "G4", "O"],
          ["-", "G3", "A4", "H"]
        ]},
        { label: 'A_Theme_1', vol: 1.0, rows: [
          ["D5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["F5", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["A5", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["G5", "F3", "D4", "O"],
          ["-", "G3", "F4", "H"]
        ]},
        { label: 'A_Theme_2', vol: 1.0, rows: [
          ["F5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["E5", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["C5", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["-", "F3", "D4", "O"],
          ["D5", "G3", "F4", "H"]
        ]},
        { label: 'A_Theme_3', vol: 1.0, rows: [
          ["D5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["F5", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["A5", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["C6", "F3", "D4", "O"],
          ["-", "G3", "F4", "H"]
        ]},
        { label: 'A_Theme_4', vol: 1.0, rows: [
          ["G5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["F5", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["E5", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["C5", "F3", "G4", "O"],
          ["A4", "G3", "A4", "H"]
        ]},
        { label: 'B_Theme_Shift_Bb', vol: 1.05, rows: [
          ["D5", "Bb2", "Bb3", "K"],
          ["-", "Bb2", "D4", "H"],
          ["F5", "Bb2", "F4", "O"],
          ["-", "Bb2", "Bb4", "H"],
          ["Bb5", "Bb2", "F4", "S"],
          ["-", "Bb2", "D4", "H"],
          ["A5", "Bb2", "Bb3", "O"],
          ["-", "Bb2", "D4", "H"]
        ]},
        { label: 'B_Theme_Shift_F', vol: 1.05, rows: [
          ["F5", "F2", "F3", "K"],
          ["-", "F2", "A3", "H"],
          ["A5", "F2", "C4", "O"],
          ["-", "F2", "F4", "H"],
          ["C6", "F2", "C4", "S"],
          ["-", "F2", "A3", "H"],
          ["G5", "F2", "F3", "O"],
          ["-", "F2", "A3", "H"]
        ]},
        { label: 'B_Theme_Shift_C', vol: 1.05, rows: [
          ["E5", "C3", "C4", "K"],
          ["-", "C3", "E4", "H"],
          ["G5", "C3", "G4", "O"],
          ["-", "C3", "C5", "H"],
          ["C6", "C3", "G4", "S"],
          ["-", "C3", "E4", "H"],
          ["A5", "C3", "C4", "O"],
          ["-", "C3", "E4", "H"]
        ]},
        { label: 'B_Theme_Shift_Dm_Fill', vol: 1.05, rows: [
          ["F5", "D3", "D4", "K"],
          ["G5", "D3", "F4", "S"],
          ["A5", "D3", "A4", "K"],
          ["C6", "D3", "D5", "S"],
          ["D6", "D3", "F5", "K"],
          ["E6", "D3", "G5", "S"],
          ["F6", "F3", "A5", "K"],
          ["G6", "G3", "C6", "S"]
        ]},
        { label: 'C_Theme_Breakdown_1', vol: 0.9, rows: [
          ["A5", "-", "A4", "K"],
          ["-", "-", "C5", "H"],
          ["-", "-", "E5", "H"],
          ["-", "-", "A5", "H"],
          ["-", "-", "E5", "K"],
          ["-", "-", "C5", "H"],
          ["-", "-", "A4", "H"],
          ["-", "-", "E4", "H"]
        ]},
        { label: 'C_Theme_Breakdown_2', vol: 0.9, rows: [
          ["G5", "-", "G4", "K"],
          ["-", "-", "Bb4", "H"],
          ["-", "-", "D5", "H"],
          ["-", "-", "G5", "H"],
          ["-", "-", "D5", "K"],
          ["-", "-", "Bb4", "H"],
          ["-", "-", "G4", "H"],
          ["-", "-", "D4", "H"]
        ]},
        { label: 'C_Theme_Breakdown_3', vol: 0.9, rows: [
          ["F5", "-", "F4", "K"],
          ["-", "-", "A4", "H"],
          ["-", "-", "C5", "H"],
          ["-", "-", "F5", "H"],
          ["-", "-", "C5", "K"],
          ["-", "-", "A4", "H"],
          ["-", "-", "F4", "H"],
          ["-", "-", "C4", "H"]
        ]},
        { label: 'C_Theme_Breakdown_4', vol: 0.9, rows: [
          ["E5", "-", "E4", "K"],
          ["-", "-", "G4", "H"],
          ["-", "-", "C5", "H"],
          ["-", "-", "E5", "H"],
          ["-", "-", "C5", "K"],
          ["-", "-", "G4", "H"],
          ["-", "-", "E4", "H"],
          ["-", "-", "C4", "H"]
        ]},
        { label: 'D_Theme_Build_1', vol: 1.0, rows: [
          ["D5", "D3", "D4", "K"],
          ["-", "D3", "F4", "S"],
          ["-", "D3", "A4", "K"],
          ["-", "D3", "D5", "S"],
          ["F5", "D3", "A4", "K"],
          ["-", "D3", "F4", "S"],
          ["-", "D3", "D4", "K"],
          ["-", "D3", "A3", "S"]
        ]},
        { label: 'D_Theme_Build_2', vol: 1.0, rows: [
          ["A5", "D3", "D4", "K"],
          ["-", "D3", "F4", "S"],
          ["-", "D3", "A4", "K"],
          ["-", "D3", "D5", "S"],
          ["C6", "D3", "A4", "K"],
          ["-", "D3", "F4", "S"],
          ["-", "D3", "D4", "K"],
          ["-", "D3", "A3", "S"]
        ]},
        { label: 'D_Theme_Build_3', vol: 1.1, rows: [
          ["D6", "D3", "D4", "S"],
          ["-", "D3", "F4", "S"],
          ["E6", "D3", "A4", "S"],
          ["-", "D3", "D5", "S"],
          ["F6", "D3", "A4", "S"],
          ["-", "D3", "F4", "S"],
          ["G6", "D3", "D4", "S"],
          ["-", "D3", "A3", "S"]
        ]},
        { label: 'D_Theme_Build_4_Roll', vol: 1.1, rows: [
          ["A6", "D3", "D4", "S"],
          ["A6", "D3", "F4", "S"],
          ["A6", "D3", "A4", "S"],
          ["A6", "D3", "D5", "S"],
          ["A6", "D3", "A4", "S"],
          ["A6", "D3", "F4", "S"],
          ["A6", "D3", "D4", "S"],
          ["A6", "D3", "A3", "S"]
        ]},
        { label: 'E_Theme_Solo_1', vol: 1.1, rows: [
          ["D6", "D3", "D4", "K"],
          ["A5", "D3", "F4", "H"],
          ["F6", "D3", "A4", "O"],
          ["D6", "D3", "D5", "H"],
          ["A6", "D3", "A4", "S"],
          ["F6", "D3", "F4", "H"],
          ["G6", "F3", "D4", "O"],
          ["E6", "G3", "F4", "H"]
        ]},
        { label: 'E_Theme_Solo_2', vol: 1.1, rows: [
          ["F6", "D3", "D4", "K"],
          ["D6", "D3", "F4", "H"],
          ["E6", "D3", "A4", "O"],
          ["C6", "D3", "D5", "H"],
          ["D6", "D3", "A4", "S"],
          ["A5", "D3", "F4", "H"],
          ["C6", "F3", "D4", "O"],
          ["D6", "G3", "F4", "H"]
        ]},
        { label: 'E_Theme_Solo_3', vol: 1.1, rows: [
          ["A5", "Bb2", "Bb3", "K"],
          ["F5", "Bb2", "D4", "H"],
          ["D6", "Bb2", "F4", "O"],
          ["Bb5", "Bb2", "Bb4", "H"],
          ["F6", "Bb2", "F4", "S"],
          ["D6", "Bb2", "D4", "H"],
          ["E6", "Bb2", "Bb3", "O"],
          ["C6", "Bb2", "D4", "H"]
        ]},
        { label: 'E_Theme_Solo_4', vol: 1.1, rows: [
          ["D6", "Bb2", "Bb3", "K"],
          ["Bb5", "Bb2", "D4", "H"],
          ["C6", "Bb2", "F4", "O"],
          ["A5", "Bb2", "Bb4", "H"],
          ["Bb5", "Bb2", "F4", "S"],
          ["G5", "Bb2", "D4", "H"],
          ["A5", "Bb2", "Bb3", "O"],
          ["F5", "Bb2", "D4", "H"]
        ]},
        { label: 'E_Theme_Solo_5', vol: 1.1, rows: [
          ["C6", "F2", "F3", "K"],
          ["A5", "F2", "A3", "H"],
          ["F6", "F2", "C4", "O"],
          ["C6", "F2", "F4", "H"],
          ["A6", "F2", "C4", "S"],
          ["F6", "F2", "A3", "H"],
          ["G6", "F2", "F3", "O"],
          ["E6", "F2", "A3", "H"]
        ]},
        { label: 'E_Theme_Solo_6', vol: 1.1, rows: [
          ["F6", "F2", "F3", "K"],
          ["C6", "F2", "A3", "H"],
          ["D6", "F2", "C4", "O"],
          ["A5", "F2", "F4", "H"],
          ["C6", "F2", "C4", "S"],
          ["F5", "F2", "A3", "H"],
          ["G5", "F2", "F3", "O"],
          ["A5", "F2", "A3", "H"]
        ]},
        { label: 'E_Theme_Solo_7', vol: 1.1, rows: [
          ["E6", "C3", "C4", "K"],
          ["C6", "C3", "E4", "H"],
          ["G6", "C3", "G4", "O"],
          ["E6", "C3", "C5", "H"],
          ["C7", "C3", "G4", "S"],
          ["G6", "C3", "E4", "H"],
          ["A6", "C3", "C4", "O"],
          ["F6", "C3", "E4", "H"]
        ]},
        { label: 'E_Theme_Solo_8_Shred', vol: 1.1, rows: [
          ["G6", "D3", "D4", "K"],
          ["F6", "D3", "F4", "S"],
          ["E6", "D3", "A4", "K"],
          ["D6", "D3", "D5", "S"],
          ["C6", "D3", "F5", "K"],
          ["Bb5", "D3", "G5", "S"],
          ["A5", "F3", "A5", "K"],
          ["G5", "G3", "C6", "S"]
        ]},
        { label: 'Outro_Groove_1', vol: 1.0, rows: [
          ["D5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["-", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["-", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["-", "F3", "D4", "O"],
          ["-", "G3", "F4", "H"]
        ]},
        { label: 'Outro_Groove_2', vol: 0.9, rows: [
          ["F5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["-", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["-", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["-", "F3", "D4", "O"],
          ["-", "G3", "F4", "H"]
        ]},
        { label: 'Outro_Groove_3', vol: 0.8, rows: [
          ["A5", "D3", "D4", "K"],
          ["-", "D3", "F4", "H"],
          ["-", "D3", "A4", "O"],
          ["-", "D3", "D5", "H"],
          ["-", "D3", "A4", "S"],
          ["-", "D3", "F4", "H"],
          ["-", "F3", "D4", "O"],
          ["-", "G3", "F4", "H"]
        ]},
        { label: 'Outro_Groove_4', vol: 0.7, rows: [
          ["C6", "D3", "D4", "K"],
          ["-", "D3", "F4", "S"],
          ["A5", "D3", "A4", "K"],
          ["-", "D3", "D5", "S"],
          ["F5", "D3", "A4", "K"],
          ["-", "D3", "F4", "S"],
          ["E5", "F3", "D4", "K"],
          ["C5", "G3", "F4", "S"]
        ]}
      ]
    }
  ];

  private currentTrackIdx = 0;
  private selectedTrackIdx = 0;

      private musicData = {
    perc: {
      'K': { type: 'sine', hz: 50, vol: 0.85, dur: 130 },
      'S': { filter: 'bandpass' as BiquadFilterType, hz: 1500, q: 0.5, vol: 0.35, dur: 100 },
      'H': { filter: 'highpass' as BiquadFilterType, hz: 7000, q: 1.0, vol: 0.08, dur: 50 },
      'O': { filter: 'highpass' as BiquadFilterType, hz: 7000, q: 0.8, vol: 0.15, dur: 80 },
      'KS': ['K', 'S'],
      'KH': ['K', 'H']
    },
    freqs: {
      "C": 261.63, "Db": 277.18, "D": 293.66, "Eb": 311.13, "E": 329.63, "F": 349.23, "Gb": 369.99, "G": 392, "Ab": 415.3, "A": 440, "Bb": 466.16, "B": 493.88,
      "C2": 65.41, "D2": 73.42, "Eb2": 77.78, "F2": 87.31, "G2": 98, "Ab2": 103.83, "Bb2": 116.54,
      "C3": 130.81, "D3": 146.83, "Eb3": 155.56, "F3": 174.61, "G3": 196, "Ab3": 207.65, "Bb3": 233.08, "B3": 246.94,
      "C4": 261.63, "D4": 293.66, "Eb4": 311.13, "F4": 349.23, "G4": 392, "Ab4": 415.3, "Bb4": 466.16, "B4": 493.88,
      "C5": 523.25, "D5": 587.33, "Eb5": 622.25, "F5": 698.46, "G5": 783.99, "Ab5": 830.61, "Bb5": 932.33, "B5": 987.77,
      "C6": 1046.5, "D6": 1174.66, "Eb6": 1244.51, "F6": 1396.91, "G6": 1567.98, "Ab6": 1661.22,
      "C#": 277.18, "D#": 311.13, "F#": 369.99, "G#": 415.3, "A#": 466.16
    }
  };

  public getPlaylist() {
    return this.tracks.map(t => t.name);
  }

  public setTrack(idx: number) {
    if (idx < 0 || idx >= this.tracks.length) return;
    const wasPlaying = this.isPlayingMusic;
    this.stopMusic();
    this.selectedTrackIdx = idx;
    this.currentTrackIdx = idx;
    if (wasPlaying) {
      this.startMusic();
    }
  }

  public getCurrentTrackIdx() {
    return this.selectedTrackIdx;
  }

  private playPerc(type: string, volMult: number) {
    if (!this.enabled || !this.ctx) return;
    const p = (this.musicData.perc as any)[type];
    if (!p) return;
    if (Array.isArray(p)) {
      p.forEach(sub => this.playPerc(sub, volMult));
      return;
    }

    if (p.type === 'sine') {
      this.playTone(p.hz, 'sine', p.dur / 1000, p.vol * volMult);
      return;
    }

    const duration = p.dur / 1000;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = p.filter;
    filter.frequency.setValueAtTime(p.hz, this.ctx.currentTime);
    filter.Q.setValueAtTime(p.q, this.ctx.currentTime);

    gain.gain.setValueAtTime(p.vol * volMult, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  startMusic(isBoss: boolean = false, forceTrackIdx?: number) {
    if (!this.enabled || !this.ctx) return;

    let targetTrackIdx = this.selectedTrackIdx;
    if (forceTrackIdx !== undefined) {
      targetTrackIdx = forceTrackIdx;
    } else if (isBoss) {
      targetTrackIdx = 2; // "Project Neon - The Turrican Core"
    }

    if (this.isPlayingMusic) {
      if (this.currentTrackIdx === targetTrackIdx) {
        return; // Already playing the correct track
      } else {
        this.stopMusic(); // Stop current track to switch
      }
    }

    this.currentTrackIdx = targetTrackIdx;
    this.isPlayingMusic = true;

    const track = this.tracks[this.currentTrackIdx];
    let sectionIdx = 0;
    let rowIdx = 0;
    
    const playStep = () => {
      if (!this.isPlayingMusic || !this.ctx) return;
      
      const section = track.sections[sectionIdx];
      const row = section.rows[rowIdx];
      
      const currentTempo = track.tempo * this.musicTempo;
      const currentStepDuration = (60 / currentTempo) / 4;
      
      if (!this.musicMuted && this.musicVolume > 0) {
        const volMult = this.musicVolume * section.vol;
        
        // CH1, CH2, CH3
        for (let i = 0; i < 3; i++) {
          const note = row[i];
          if (note !== '-') {
            const chanKey = `CH${i+1}` as 'CH1' | 'CH2' | 'CH3';
            const chan = track.channels[chanKey];
            const freq = (this.musicData.freqs as any)[note] * chan.octave;
            this.playTone(freq, chan.type, currentStepDuration * chan.release, chan.volume * volMult);
          }
        }

        // CH4 (Percussion)
        const percNote = row[3];
        if (percNote !== '-') {
          this.playPerc(percNote, volMult);
        }
      }

      rowIdx++;
      if (rowIdx >= section.rows.length) {
        rowIdx = 0;
        sectionIdx++;
        if (sectionIdx >= track.sections.length) {
          sectionIdx = 0;
        }
      }
      
      this.musicInterval = window.setTimeout(playStep, currentStepDuration * 1000);
    };

    playStep();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval !== null) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const audio = new AudioEngine();
