export class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Lower master volume
        this.masterGain.connect(this.ctx.destination);

        this.heartbeatBuffer = null;
        this.loadSounds();
    }

    async loadSounds() {
        try {
            const response = await fetch('./thudding-heartbeat-372487.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.heartbeatBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error('Error loading heartbeat sound:', error);
        }
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playShoot() {
        this.resume();
        const t = this.ctx.currentTime;

        // White Noise Buffer
        const bufferSize = this.ctx.sampleRate * 0.1; // 0.1s duration
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter (Lowpass)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);

        // Envelope
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(t);
        noise.stop(t + 0.1);

        // Kick (Oscillator)
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.1);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.5, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    playReload() {
        this.resume();
        const t = this.ctx.currentTime;

        // Slide
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.25);

        // Click (End)
        setTimeout(() => {
            const click = this.ctx.createOscillator();
            click.type = 'square';
            click.frequency.setValueAtTime(800, this.ctx.currentTime);
            const kGain = this.ctx.createGain();
            kGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            kGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

            click.connect(kGain);
            kGain.connect(this.masterGain);
            click.start();
            click.stop(this.ctx.currentTime + 0.05);
        }, 1200);
    }

    playStep() {
        this.resume();
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.05); // Short thud

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, t); // Quiet
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.05);
    }

    playHeartbeat() {
        this.resume();
        if (!this.heartbeatBuffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.heartbeatBuffer;

        const gain = this.ctx.createGain();
        gain.gain.value = 1.0;

        source.connect(gain);
        gain.connect(this.masterGain);
        source.start();
    }
}
