export class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;

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
    this.playTone(200, 'triangle', 0.05, 0.05);
  }

  playExplosion() {
    this.playNoise(0.5, 0.3);
    this.playTone(100, 'sawtooth', 0.3, 0.2);
  }

  playPowerup() {
    this.playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 200);
  }

  playStart() {
    [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'square', 0.2, 0.1), i * 150);
    });
  }
}

export const audio = new AudioEngine();
