
class Synth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null; // New gain node for SFX
  private jetGain: GainNode | null = null; // Specific gain for jet engine
  private jetSource: AudioBufferSourceNode | null = null;
  
  // Siren props
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private isSirenPlaying: boolean = false;

  private enabled: boolean = true;
  
  private bgmInterval: any = null;
  private bgmStep = 0;
  private currentPattern: string = 'NONE';

  init() {
    if (typeof window !== 'undefined' && !this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        
        this.masterGain.connect(this.ctx.destination);
        this.bgmGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        
        this.setVolume(this.enabled);
      }
    }
  }

  setVolume(enabled: boolean) {
    this.enabled = enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(enabled ? 0.3 : 0, this.ctx.currentTime, 0.1);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, rampTo?: number, gainVal: number = 0.5, targetGain: GainNode | null = null) {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    // Use provided target gain or fallback to sfxGain, then master
    gain.connect(targetGain || this.sfxGain || this.masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // --- Siren Logic for Ambulance ---
  startSiren() {
    if (!this.enabled || !this.ctx || this.isSirenPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.isSirenPlaying = true;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();

    // HK Ambulances often have a two-tone "Dee-Doo" sound (High-Low)
    // Approximately 900Hz and 600Hz alternating
    const t = this.ctx.currentTime;
    
    this.sirenOsc.type = 'square'; // Piercing tone
    this.sirenOsc.frequency.setValueAtTime(900, t);
    
    // Use an LFO to modulate pitch between High and Low
    const modulator = this.ctx.createOscillator();
    modulator.type = 'square';
    modulator.frequency.value = 0.8; // Speed of Hi-Lo change (cycles per second)
    const modGain = this.ctx.createGain();
    modGain.gain.value = 150; // Pitch shift amount (+/- 150Hz)
    
    modulator.connect(modGain);
    modGain.connect(this.sirenOsc.frequency);
    modulator.start();

    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain!);
    
    this.sirenGain.gain.setValueAtTime(0, t);
    this.sirenGain.gain.linearRampToValueAtTime(0.2, t + 0.5); // Fade in

    this.sirenOsc.start();
    
    // Store modulator to stop it later
    (this.sirenOsc as any).modulator = modulator;
  }

  stopSiren() {
    if (!this.isSirenPlaying) return;
    this.isSirenPlaying = false;
    
    if (this.sirenGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.sirenGain.gain.cancelScheduledValues(t);
        this.sirenGain.gain.linearRampToValueAtTime(0, t + 0.5); // Fade out
        
        const oldOsc = this.sirenOsc;
        const oldGain = this.sirenGain;
        const oldMod = (oldOsc as any).modulator;

        setTimeout(() => {
            if (oldOsc) oldOsc.stop();
            if (oldMod) oldMod.stop();
            if (oldOsc) oldOsc.disconnect();
            if (oldGain) oldGain.disconnect();
        }, 600);
    }
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  // --- Jet Engine Sound Logic ---
  startJetSound() {
    if (!this.enabled || !this.ctx || this.jetSource) return; // Already playing or disabled
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Create Noise Buffer (2 seconds of random noise)
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    this.jetSource = this.ctx.createBufferSource();
    this.jetSource.buffer = buffer;
    this.jetSource.loop = true;

    // Filter to make it sound like a rumble/engine (Lowpass)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400; // Deep rumble freq
    filter.Q.value = 1;

    this.jetGain = this.ctx.createGain();
    this.jetGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.jetGain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 1.0); // Fade in

    // Connect: Source -> Filter -> Gain -> Master
    this.jetSource.connect(filter);
    filter.connect(this.jetGain);
    this.jetGain.connect(this.masterGain!);

    this.jetSource.start();
  }

  stopJetSound() {
    if (this.jetGain && this.ctx) {
        // Fade out
        this.jetGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.jetGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
        
        const oldSource = this.jetSource;
        const oldGain = this.jetGain;
        
        setTimeout(() => {
            if (oldSource) oldSource.stop();
            if (oldSource) oldSource.disconnect();
            if (oldGain) oldGain.disconnect();
        }, 600);
    }
    this.jetSource = null;
    this.jetGain = null;
  }

  updateBGM(status: string) {
    if (!this.ctx) this.init();
    if (this.currentPattern === status) return;
    this.stopBGM();
    this.currentPattern = status;
    this.bgmStep = 0;
    
    let tempo = 150;
    if (status === 'MENU') { 
      tempo = 200; 
      this.bgmInterval = setInterval(() => this.playMenuTick(), tempo); 
    }
    else if (status === 'PLAYING') { 
      tempo = 130; 
      this.bgmInterval = setInterval(() => this.playPlayingTick(), tempo); 
    }
    else if (status === 'POWERUP') {
      tempo = 105; // 更快的節奏
      this.bgmInterval = setInterval(() => this.playPowerUpTick(), tempo);
    }
    else if (status === 'GAMEOVER') { 
      tempo = 400; 
      this.bgmInterval = setInterval(() => this.playGameOverTick(), tempo); 
    }
    else if (status === 'VICTORY') {
      tempo = 120;
      this.bgmInterval = setInterval(() => this.playVictoryTick(), tempo);
    }
    else if (status === 'PAUSED') {
      // 暫停時不播放 BGM
      this.stopBGM();
    }
  }

  stopBGM() { if (this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; } }

  private playMenuTick() {
    const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 349.23, 392.00, 261.63];
    const bass = [130.81, 130.81, 174.61, 196.00];
    if (this.bgmStep % 2 === 0) this.playTone(bass[Math.floor(this.bgmStep / 4) % bass.length], 'triangle', 0.4, undefined, 0.2, this.bgmGain);
    if (this.bgmStep % 4 === 0) this.playTone(notes[this.bgmStep % notes.length], 'sine', 0.2, undefined, 0.1, this.bgmGain);
    this.bgmStep++;
  }

  private playPlayingTick() {
    const bass = [65.41, 65.41, 73.42, 55.00];
    const lead = [523.25, 0, 587.33, 0, 659.25, 0, 783.99, 0];
    this.playTone(bass[Math.floor(this.bgmStep / 8) % bass.length], 'square', 0.15, undefined, 0.15, this.bgmGain);
    if (this.bgmStep % 2 === 0) this.playTone(50, 'sawtooth', 0.05, 10, 0.3, this.bgmGain);
    if (lead[this.bgmStep % lead.length] > 0 && Math.random() > 0.3) this.playTone(lead[this.bgmStep % lead.length], 'triangle', 0.1, undefined, 0.1, this.bgmGain);
    this.bgmStep++;
  }

  private playPowerUpTick() {
    // 高昂、快速、充滿力量感的 BGM
    const bass = [82.41, 110.00, 123.47, 164.81]; // E2, A2, B2, E3
    const lead = [659.25, 783.99, 880.00, 987.77]; // E5, G5, A5, B5琶音
    
    // 強力的正方形波低音
    if (this.bgmStep % 2 === 0) {
      this.playTone(bass[Math.floor(this.bgmStep / 4) % bass.length], 'square', 0.1, undefined, 0.2, this.bgmGain);
    }
    
    // 快速的高音旋律
    const note = lead[this.bgmStep % lead.length];
    this.playTone(note, 'sine', 0.08, note * 1.05, 0.15, this.bgmGain);
    
    // 節奏鼓點模擬
    if (this.bgmStep % 4 === 0) {
      this.playTone(60, 'sawtooth', 0.05, 10, 0.4, this.bgmGain); // Kick
    }
    if (this.bgmStep % 4 === 2) {
      this.playTone(800, 'square', 0.03, 100, 0.1, this.bgmGain); // Snare/Hat
    }
    
    this.bgmStep++;
  }

  private playGameOverTick() {
    const sadNotes = [196.00, 185.00, 174.61, 164.81];
    this.playTone(sadNotes[this.bgmStep % sadNotes.length], 'sine', 0.8, 50, 0.2, this.bgmGain);
    this.bgmStep++;
  }

  private playVictoryTick() {
    // 勝利音樂：C大調上行琶音
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const index = this.bgmStep % notes.length;
    // 雙重音色：Sine + Triangle
    this.playTone(notes[index], 'sine', 0.3, undefined, 0.3, this.bgmGain);
    this.playTone(notes[index], 'triangle', 0.3, undefined, 0.2, this.bgmGain);
    // 快樂的 Bass
    if (this.bgmStep % 4 === 0) {
        this.playTone(130.81, 'square', 0.4, undefined, 0.2, this.bgmGain);
    }
    this.bgmStep++;
  }

  playJump() { this.playTone(350, 'sine', 0.2, 650); }
  playSlide() { this.playTone(180, 'triangle', 0.2, 40); }
  playCoin() { this.playTone(1100, 'sine', 0.08, 1600); setTimeout(() => this.playTone(1600, 'sine', 0.08), 40); }
  playCrash() { this.playTone(400, 'sawtooth', 0.3, 200, 0.8); this.playTone(100, 'square', 0.4, 10, 0.5); }
  playClash() {
      this.playTone(800, 'sawtooth', 0.15, 200, 0.6);
      this.playTone(120, 'square', 0.2, 10, 0.8);
  }
  
  // 新增：受傷音效 (保留用於無敵狀態下的碰撞或通用效果，但降低音量)
  playDamage() {
    // 沉悶的低頻衝擊
    this.playTone(120, 'sawtooth', 0.2, 20, 0.6);
  }

  // 1. 金屬撞擊 (車輛、鐵閘) - 低沉的咚聲 + 輕微金屬餘音
  playMetalHit() {
      this.playTone(150, 'square', 0.2, 50, 0.8); // 主體撞擊
      setTimeout(() => this.playTone(800, 'sine', 0.3, 200, 0.3), 10); // 金屬泛音
  }

  // 2. 木頭/紙箱撞擊 (棚架、發泡膠箱) - 短促乾燥的聲音
  playWoodHit() {
      this.playTone(200, 'triangle', 0.15, 50, 0.9);
      this.playTone(100, 'square', 0.1, 20, 0.5); // 低頻增加厚度
  }

  // 3. 塑膠撞擊 (水馬、雪糕筒) - 空心感
  playPlasticHit() {
      this.playTone(300, 'sine', 0.2, 100, 0.8); // 較圓潤的聲音
      setTimeout(() => this.playTone(200, 'triangle', 0.1, 50, 0.4), 20);
  }

  // 4. 水聲 (水窪) - 白噪音
  playSplash() {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * 0.3; // 0.3秒
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // 漸弱
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(this.sfxGain);
    noise.start();
  }

  // 5. 鳥類撞擊 - 輕微的撲騰聲 (避免太殘忍)
  playBirdHit() {
      this.playTone(600, 'triangle', 0.15, 300, 0.5);
      this.playTone(200, 'sawtooth', 0.1, 50, 0.3); // 羽毛摩擦感
  }

  // 路人慘叫
  playScream() {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain);
    
    osc.type = 'sawtooth';
    const startFreq = 800 + Math.random() * 200;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.35); 
    
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

export default new Synth();
