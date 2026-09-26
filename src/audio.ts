// Entire soundscape is synthesized locally: wing harmonics, filtered weather,
// and tiny pentatonic reward notes. Audio starts only after the player's gesture.
function liquidBuffer(ctx: BaseAudioContext, entry: boolean): AudioBuffer {
  const duration = entry ? .14 : 2.4;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 4917, fast = 0, slow = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / ctx.sampleRate, pulse = Math.floor(t / .24), age = entry ? t : t % .24;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    fast += .18 * (noise - fast); slow += .035 * (noise - slow);
    const frequency = (entry ? 310 : 390 + 70 * Math.sin(pulse * 2.4)) + (entry ? 620 : 190) * Math.exp(-age * 30);
    phase += Math.PI * 2 * frequency / ctx.sampleRate;
    const envelope = (1 - Math.exp(-age * 550)) * Math.exp(-age * (entry ? 34 : 27));
    const breath = .65 + .35 * Math.sin(t * Math.PI * 2 / .6);
    const fade = Math.min(1, t / .004, (duration - t) / .008);
    samples[i] = fade * ((entry ? .75 : .30) * Math.sin(phase) * envelope + (fast - slow) * (entry ? envelope * .5 : breath * .16));
  }
  return buffer;
}

function rainBuffer(ctx: BaseAudioContext, leaf: boolean): AudioBuffer {
  const duration = leaf ? 8 : 6.4;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = leaf ? 93731 : 18013;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  if (leaf) {
    // Bake irregular, softly resonant impacts into one retained loop. No nodes
    // or buffers are allocated for individual raindrops during play.
    for (let at = .12; at < duration - .2; at += .06 + random() * .21) {
      const pitch = 460 + random() * 750, strength = .13 + random() * .17;
      const start = Math.floor(at * ctx.sampleRate);
      let phase = 0, smoothNoise = 0;
      for (let i = 0; i < ctx.sampleRate * .15; i++) {
        const age = i / ctx.sampleRate;
        phase += Math.PI * 2 * pitch * (1 + .22 * Math.exp(-age * 80)) / ctx.sampleRate;
        smoothNoise += .22 * ((random() * 2 - 1) - smoothNoise);
        const envelope = (1 - Math.exp(-age * 750)) * Math.exp(-age * 44);
        samples[start + i] += strength * envelope * (.65 * Math.sin(phase) + smoothNoise * 1.3);
      }
    }
  } else {
    let slow = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / ctx.sampleRate, noise = random() * 2 - 1;
      slow += .025 * (noise - slow);
      const edge = Math.min(1, t / .02, (duration - t) / .02);
      samples[i] = .75 * (noise - slow) * (.9 + .1 * Math.sin(t * Math.PI * 2 / 3.2)) * edge;
    }
  }
  return buffer;
}

export interface EndingAudioMix {
  meadow: number;
  home: number;
  fade: number;
}
export interface WeatherAudioMix {
  rain: number;
  underLeaf: boolean;
  /** 0–1: perched on or hovering just above a broad leaf top. */
  leafTop?: number;
}
const boundedMix = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export class GardenAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private wings?: GainNode;
  private wingOsc?: OscillatorNode;
  private breeze?: GainNode;
  private swarm?: GainNode;
  private hive?: GainNode;
  private rainAir?: GainNode;
  private leafPatter?: GainNode;
  private rainFilter?: BiquadFilterNode;
  private weatherGain?: GainNode;
  private weatherMix = { intensity: 0, sheltered: false, leafTop: 0 };
  private lastDropCheck = 0;
  drops = 0;
  private lossFade: number | undefined;
  private weatherTargets = { air: 0, leaf: 0 };
  private swarmOscillators: OscillatorNode[] = [];
  private loopSources: AudioScheduledSourceNode[] = [];
  private endingMix: EndingAudioMix = { meadow: 0, home: 0, fade: 0 };
  private endingActive = false;
  private endingTargets = { swarm: 0, hive: 0 };
  private disposed = false;
  private sipGain?: GainNode;
  private liquidGain?: GainNode;
  private entryBuffer?: AudioBuffer;
  private entrySource?: AudioBufferSourceNode;
  private sipping = false;
  private touches = 0;
  private masterMeter?: AnalyserNode;
  private sipMeter?: AnalyserNode;
  private weatherMeter?: AnalyserNode;
  private meterSamples = new Float32Array(512);
  private nodes: AudioNode[] = [];
  muted = false;

  async start(): Promise<void> {
    if (this.disposed) return;
    if (this.context) { await this.context.resume(); return; }
    const ctx = this.context = new AudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.34 * (1 - this.endingMix.fade);
    this.master.connect(ctx.destination);
    this.wings = ctx.createGain();
    this.wings.gain.value = 0;
    this.wings.connect(this.master);
    this.wingOsc = ctx.createOscillator();
    this.wingOsc.type = 'triangle';
    this.wingOsc.frequency.value = 165;
    this.wingOsc.connect(this.wings);
    this.wingOsc.start();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = 'sine'; overtone.frequency.value = 331;
    overtoneGain.gain.value = 0.16;
    overtone.connect(overtoneGain).connect(this.wings); overtone.start();
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 7123;
    for (let i = 0; i < length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 430;
    this.breeze = ctx.createGain(); this.breeze.gain.value = 0.018;
    noise.connect(lowpass).connect(this.breeze).connect(this.master); noise.start();
    this.liquidGain = ctx.createGain(); this.liquidGain.gain.value = 1;
    this.liquidGain.connect(this.master);
    this.sipGain = ctx.createGain(); this.sipGain.gain.value = 0;
    const sip = ctx.createBufferSource(); sip.buffer = liquidBuffer(ctx, false); sip.loop = true;
    sip.connect(this.sipGain).connect(this.liquidGain); sip.start();
    this.entryBuffer = liquidBuffer(ctx, true);

    this.weatherGain = ctx.createGain(); this.weatherGain.gain.value = 1;
    this.weatherGain.connect(this.master);
    this.rainAir = ctx.createGain(); this.rainAir.gain.value = 0;
    this.leafPatter = ctx.createGain(); this.leafPatter.gain.value = 0;
    this.rainFilter = ctx.createBiquadFilter(); this.rainFilter.type = 'lowpass'; this.rainFilter.frequency.value = 6200; this.rainFilter.Q.value = .45;
    const rain = ctx.createBufferSource(); rain.buffer = rainBuffer(ctx, false); rain.loop = true;
    rain.connect(this.rainFilter).connect(this.rainAir).connect(this.weatherGain); rain.start();
    const leaf = ctx.createBufferSource(); leaf.buffer = rainBuffer(ctx, true); leaf.loop = true;
    const leafFilter = ctx.createBiquadFilter(); leafFilter.type = 'lowpass'; leafFilter.frequency.value = 2300; leafFilter.Q.value = .4;
    leaf.connect(leafFilter).connect(this.leafPatter).connect(this.weatherGain); leaf.start();
    this.loopSources.push(rain, leaf);
    this.nodes.push(rain, leaf, this.rainFilter, leafFilter, this.rainAir, this.leafPatter, this.weatherGain);

    // Two quiet, slightly separated wing pitches imply a distant swarm. The
    // existing wind noise adds breadth; no source is allocated for each bee.
    this.swarm = ctx.createGain(); this.swarm.gain.value = 0;
    const swarmFilter = ctx.createBiquadFilter(); swarmFilter.type = 'lowpass'; swarmFilter.frequency.value = 460; swarmFilter.Q.value = .45;
    swarmFilter.connect(this.swarm).connect(this.master);
    const swarmA = ctx.createOscillator(), swarmB = ctx.createOscillator();
    swarmA.type = 'triangle'; swarmA.frequency.value = 174;
    swarmB.type = 'sine'; swarmB.frequency.value = 179.3;
    swarmA.connect(swarmFilter); swarmB.connect(swarmFilter); swarmA.start(); swarmB.start();
    const swarmAir = ctx.createGain(); swarmAir.gain.value = .055;
    noise.connect(swarmAir).connect(swarmFilter);
    this.swarmOscillators.push(swarmA, swarmB);

    // A soft fundamental and fifth bring the sound down into the wooden hive.
    // These four cinematic oscillators remain retained and silent between runs.
    this.hive = ctx.createGain(); this.hive.gain.value = 0;
    const hiveFilter = ctx.createBiquadFilter(); hiveFilter.type = 'lowpass'; hiveFilter.frequency.value = 290; hiveFilter.Q.value = .35;
    hiveFilter.connect(this.hive).connect(this.master);
    const hiveLow = ctx.createOscillator(), hiveFifth = ctx.createOscillator();
    hiveLow.type = 'sine'; hiveLow.frequency.value = 109.5;
    hiveFifth.type = 'triangle'; hiveFifth.frequency.value = 164.8;
    hiveLow.connect(hiveFilter); hiveFifth.connect(hiveFilter); hiveLow.start(); hiveFifth.start();
    this.loopSources.push(this.wingOsc, overtone, noise, sip, swarmA, swarmB, hiveLow, hiveFifth);
    this.nodes.push(this.swarm, swarmFilter, swarmA, swarmB, swarmAir, this.hive, hiveFilter, hiveLow, hiveFifth);
    this.nodes.push(this.wingOsc, overtone, overtoneGain, noise, lowpass, this.wings, this.breeze, sip, this.sipGain, this.liquidGain);
    await ctx.resume();
  }

  update(flying: boolean, speed: number, wind: number, touchingNectar: boolean, paused: boolean, ending?: EndingAudioMix, weather?: WeatherAudioMix, lossProgress?: number, strain = 0): void {
    if (this.disposed) return;
    const wasEnding = this.endingActive;
    const wasLosing = this.lossFade !== undefined;
    this.lossFade = lossProgress === undefined ? undefined : boundedMix(lossProgress);
    this.endingActive = ending !== undefined;
    this.endingMix.meadow = boundedMix(ending?.meadow ?? 0);
    this.endingMix.home = boundedMix(ending?.home ?? 0);
    this.endingMix.fade = boundedMix(ending?.fade ?? 0);
    const { meadow, home, fade } = this.endingMix;
    this.endingTargets.swarm = paused || !ending ? 0 : meadow * (1 - home * .65) * .018;
    this.endingTargets.hive = paused || !ending ? 0 : home * .020;
    this.weatherMix.intensity = boundedMix(weather?.rain ?? 0);
    this.weatherMix.sheltered = weather?.underLeaf === true;
    this.weatherMix.leafTop = boundedMix(weather?.leafTop ?? 0);
    const rainLevel = paused || ending ? 0 : this.weatherMix.intensity;
    this.weatherTargets.air = rainLevel * (this.weatherMix.sheltered ? .012 : .028);
    this.weatherTargets.leaf = rainLevel * (this.weatherMix.sheltered ? .068 : .010 + .045 * this.weatherMix.leafTop);
    if (!this.context || !this.wings || !this.wingOsc || !this.breeze) return;
    const t = this.context.currentTime;
    const sipping = touchingNectar && !paused;
    const normalWings = flying ? 0.038 + speed * 0.006 : sipping ? 0.006 : 0.002;
    const cinematicWings = (0.028 + Math.max(0, speed) * .004) * (.14 + home * .86) * (1 - meadow * .72);
    // A heavy load strains the wings in short pulses: pitch dips and the hum swells,
    // fast enough to hear each beat (a slower wind gust never sounds like this).
    const effort = flying && !paused && !ending ? boundedMix(strain) : 0;
    this.wings.gain.setTargetAtTime(paused ? 0 : ending ? cinematicWings : normalWings * (1 + effort * .35), t, effort > .02 ? 0.05 : 0.2);
    this.wingOsc.frequency.setTargetAtTime(158 + speed * 9 - effort * 22, t, effort > .02 ? 0.05 : 0.2);
    this.breeze.gain.setTargetAtTime(paused ? 0 : (0.022 + wind * 0.022) * (ending ? 1 - home * .38 : 1), t, 0.4);
    this.swarm!.gain.setTargetAtTime(this.endingTargets.swarm, t, .32);
    this.hive!.gain.setTargetAtTime(this.endingTargets.hive, t, .40);
    this.rainAir!.gain.setTargetAtTime(this.weatherTargets.air, t, paused ? .04 : .35);
    this.leafPatter!.gain.setTargetAtTime(this.weatherTargets.leaf, t, paused ? .04 : .35);
    this.rainFilter!.frequency.setTargetAtTime(this.weatherMix.sheltered ? 1350 : 6200, t, .3);
    // Individual drops landing on a nearby leaf: bright pings from above,
    // softer and lower from underneath.
    const dropDt = Math.min(.25, Math.max(0, t - this.lastDropCheck)); this.lastDropCheck = t;
    const dropRate = rainLevel * (this.weatherMix.sheltered ? 3.5 : 7 * this.weatherMix.leafTop);
    if (dropRate > 0 && Math.random() < 1 - Math.exp(-dropRate * dropDt)) this.drop(this.weatherMix.sheltered);
    // Small pitch differences breathe without adding LFO sources. A pause mutes
    // every loop; resumption only retargets these same retained nodes.
    this.swarmOscillators[0].frequency.setTargetAtTime(174 + Math.sin(t * .43) * 1.1, t, .4);
    this.swarmOscillators[1].frequency.setTargetAtTime(179.3 + Math.sin(t * .31 + 1.8) * .9, t, .4);
    if (ending || wasEnding || wasLosing || this.lossFade !== undefined) this.master!.gain.setTargetAtTime(this.muted ? 0 : .34 * (1 - Math.max(fade, this.lossFade ?? 0)), t, .08);
    this.sipGain!.gain.setTargetAtTime(sipping ? .22 : 0, t, sipping ? .035 : .02);
    this.liquidGain!.gain.setTargetAtTime(paused ? 0 : 1, t, .02);
    if (sipping && !this.sipping) {
      this.touches++;
      // At most one soft surface-entry plip; repeated frames cannot stack it.
      this.entrySource?.stop();
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = this.entryBuffer!; gain.gain.value = .16;
      source.connect(gain).connect(this.liquidGain!); source.start();
      this.entrySource = source;
      source.onended = () => { source.disconnect(); gain.disconnect(); if (this.entrySource === source) this.entrySource = undefined; };
    }
    this.sipping = sipping;
  }

  /** A soft plucked-silk thrum, for tugs against a spider web. */
  pluck(frequency: number, level = .03): void {
    const ctx = this.context; if (this.disposed || !ctx || !this.master) return;
    const at = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency * 1.04, at); osc.frequency.exponentialRampToValueAtTime(frequency, at + .12);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .32);
    osc.connect(gain).connect(this.master); osc.start(at); osc.stop(at + .34);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private drop(under: boolean): void {
    const ctx = this.context; if (this.disposed || !ctx || !this.weatherGain) return;
    this.drops++;
    const at = ctx.currentTime + Math.random() * .03;
    const base = (under ? 900 : 1500) + Math.random() * (under ? 500 : 1300);
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    // A water drop "plink" rises quickly in pitch as it rings.
    osc.frequency.setValueAtTime(base, at);
    osc.frequency.exponentialRampToValueAtTime(base * 1.55, at + .045);
    const level = (under ? .010 : .018) * (.55 + Math.random() * .45);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, at + (under ? .07 : .11));
    osc.connect(gain).connect(this.weatherGain); osc.start(at); osc.stop(at + .13);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  /** A raindrop striking the bee: a soft, low thud with a small wet splash on top. */
  dropHit(): void {
    const ctx = this.context; if (this.disposed || !ctx || !this.master) return;
    const at = ctx.currentTime;
    const thud = ctx.createOscillator(), thudGain = ctx.createGain();
    thud.type = 'sine'; thud.frequency.setValueAtTime(190, at); thud.frequency.exponentialRampToValueAtTime(62, at + .14);
    thudGain.gain.setValueAtTime(0, at); thudGain.gain.linearRampToValueAtTime(.11, at + .006); thudGain.gain.exponentialRampToValueAtTime(.0001, at + .26);
    thud.connect(thudGain).connect(this.master); thud.start(at); thud.stop(at + .28);
    const splash = ctx.createOscillator(), splashGain = ctx.createGain();
    splash.type = 'triangle'; splash.frequency.setValueAtTime(1150, at + .01); splash.frequency.exponentialRampToValueAtTime(520, at + .09);
    splashGain.gain.setValueAtTime(0, at + .01); splashGain.gain.linearRampToValueAtTime(.025, at + .016); splashGain.gain.exponentialRampToValueAtTime(.0001, at + .12);
    splash.connect(splashGain).connect(this.master); splash.start(at + .01); splash.stop(at + .13);
    for (const [osc, gain] of [[thud, thudGain], [splash, splashGain]] as const) osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  chime(kind: 'land' | 'pollen' | 'nectar' | 'pollinate' | 'win' | 'fail'): void {
    const ctx = this.context; if (this.disposed || !ctx || !this.master) return;
    const notes = kind === 'win' ? [523, 659, 784, 1047] : kind === 'pollinate' ? [659, 784, 1047] : kind === 'fail' ? [220, 165] : kind === 'nectar' ? [784] : kind === 'pollen' ? [587] : [392, 523];
    notes.forEach((frequency, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * .13;
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(kind === 'nectar' ? .018 : .07, at + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .7);
      osc.connect(gain).connect(this.master!); osc.start(at); osc.stop(at + .72);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }

  toggle(): boolean {
    this.muted = !this.muted;
    this.master?.gain.setTargetAtTime(this.muted ? 0 : .34 * (1 - Math.max(this.endingMix.fade, this.lossFade ?? 0)), this.context!.currentTime, .08);
    return this.muted;
  }
  diagnostics() {
    // Meters are installed only by the opt-in game test snapshot.
    if (!this.disposed && this.context && this.master && this.liquidGain && !this.masterMeter) {
      this.masterMeter = this.context.createAnalyser(); this.masterMeter.fftSize = 512;
      this.sipMeter = this.context.createAnalyser(); this.sipMeter.fftSize = 512;
      this.weatherMeter = this.context.createAnalyser(); this.weatherMeter.fftSize = 512;
      this.master.connect(this.masterMeter); this.liquidGain.connect(this.sipMeter);
      this.weatherGain!.connect(this.weatherMeter); // Isolated weather signal, before master mute/fade.
      this.nodes.push(this.masterMeter, this.sipMeter, this.weatherMeter);
    }
    const rms = (meter?: AnalyserNode) => {
      if (this.disposed || !meter) return 0;
      meter.getFloatTimeDomainData(this.meterSamples);
      return Math.sqrt(this.meterSamples.reduce((sum, value) => sum + value * value, 0) / this.meterSamples.length);
    };
    const airGain = this.disposed ? 0 : this.rainAir?.gain.value ?? 0;
    const leafGain = this.disposed ? 0 : this.leafPatter?.gain.value ?? 0;
    return { lossFade: this.lossFade ?? 0, context: this.context?.state ?? 'locked', muted: this.muted, sipping: this.sipping, touches: this.touches, sipRms: rms(this.sipMeter), outputRms: rms(this.masterMeter), sipLoops: this.disposed ? 0 : this.sipGain ? 1 : 0, ending: { active: this.endingActive, ...this.endingMix, ...this.endingTargets }, weather: { ...this.weatherMix, gain: airGain + leafGain, airGain, leafGain, rms: rms(this.weatherMeter), targets: { ...this.weatherTargets } }, loopSources: this.loopSources.length, retainedNodes: this.nodes.length + (!this.disposed && this.master ? 1 : 0) };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.entrySource?.stop();
    // Stop every retained source before disconnecting its graph. Closing the
    // context also terminates any short, already-scheduled reward-note tails.
    this.loopSources.forEach(source => source.stop()); this.loopSources.length = 0;
    this.nodes.forEach(node => node.disconnect()); this.nodes.length = 0;
    this.master?.disconnect(); this.swarmOscillators.length = 0; this.entryBuffer = undefined;
    if (this.context && this.context.state !== 'closed') void this.context.close();
  }
}
