export class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7; // Increased master volume
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

    playShoot(weaponType = 'pistol') {
        this.resume();
        const t = this.ctx.currentTime;

        // Different sounds for different weapons
        switch (weaponType) {
            case 'shotgun':
                this.playShotgunSound(t);
                break;
            case 'smg':
                this.playSMGSound(t);
                break;
            case 'sniper':
                this.playSniperSound(t);
                break;
            default:
                this.playPistolSound(t);
        }
    }

    playPistolSound(t) {
        // Sharp crack
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.Q.value = 1;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.15);

        // Bass thump
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.6, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    playShotgunSound(t) {
        // Massive boom
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.3);

        // Deep bass
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.9, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    playSMGSound(t) {
        // Quick snap
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1500;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.05);

        // Light thump
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.03);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.03);
    }

    playSniperSound(t) {
        // Massive crack with echo
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const decay = Math.exp(-i / (bufferSize * 0.08));
            const echo = Math.exp(-(i - bufferSize * 0.3) * (i - bufferSize * 0.3) / (bufferSize * bufferSize * 0.01)) * 0.3;
            data[i] = (Math.random() * 2 - 1) * (decay + echo);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.Q.value = 0.5;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.4);

        // Powerful bass
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.8, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    playDamage() {
        this.resume();
        const t = this.ctx.currentTime;

        // Pain grunt / thud sound
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);

        // Impact noise
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 500;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.1);
    }

    playDash() {
        this.resume();
        const t = this.ctx.currentTime;

        // Whoosh sound
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const env = Math.sin(Math.PI * i / bufferSize);
            data[i] = (Math.random() * 2 - 1) * env * 0.5;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, t);
        filter.frequency.linearRampToValueAtTime(2000, t + 0.1);
        filter.frequency.linearRampToValueAtTime(300, t + 0.2);
        filter.Q.value = 2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + 0.2);
    }

    playPickup() {
        this.resume();
        const t = this.ctx.currentTime;

        // Ascending chime
        const frequencies = [400, 600, 800];
        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, t + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.3, t + i * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.15);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.15);
        });
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
