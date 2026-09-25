import * as THREE from 'three';
import { createMeadow, grassRainCover, meadowGroundHeight, rng } from './world';
import { EVEN_MIX, speciesMixAfter, type DayOutcome, type SpeciesMix } from './meadow-plan';
import { dayReport, morningLine, type DayReport } from './day-report';
import { createUI } from './ui';
import { createBeeRig } from './bee';
import { createNectarDrop } from './nectar';
import { createAtmosphere } from './atmosphere';
import { createHomecoming, ENDING_DURATION, QUIET_ENDING_DURATION } from './homecoming';
import { createRestView, QUIET_AFTER, SCENIC_AFTER } from './rest-view';
import { GardenAudio } from './audio';
import { createPollenFX } from './pollen';
import { createPollinationFX } from './pollination';
import { createWindEffects } from './wind-effects';
import { createShelters, leafSurfaceHeight, leafPlanarDistance, leafUniforms, type LeafShelter } from './shelters';
import { createRain } from './rain';
import { createFlowerRain } from './flower-rain';
import { createWebs, type SpiderWeb } from './webs';
import { createEnergyWash } from './energy-wash';
import { FIXED_WEATHER_PLAN, planWeather, weatherAt, type MeadowWeather, type WeatherPlan } from './weather';
import { edgeExposureAt, flightWindAt, MEADOW_EDGE_FULL, setWindGale, setWindVariation, surfaceHeight } from './wind';
import type { Flower, GameUI, Meadow, Phase, Species, ViewState } from './types';

const NAMES: Record<Species, string> = { daisy: 'Oxeye daisy', poppy: 'Corn poppy', cornflower: 'Cornflower' };
const HOME = new THREE.Vector3(0, 4, 46);
const HOME_EXIT = new THREE.Vector3(0, 4, 30);
const HOME_EXIT_HALF_WIDTH = 8;
const HOME_RETURN_FUEL = 5;
const START = new THREE.Vector3(0, 4.6, 3.5);
const FIXED = 1 / 60;
const NECTAR_GOAL = 45, POLLEN_GOAL = 140;
const NECTAR_CAPACITY = 100;
const ENERGY_PER_NECTAR = 3.5, SIP_ENERGY_RATE = 6;
const REST_DURATION = 6, REST_DAY_RATE = 18;
const LOSS_DURATION = 3.6, QUIET_LOSS_DURATION = 1.5;
/** A fresh 32-bit seed for a new day's meadow or weather. */
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0 || 1;

// A forager leaves the hive with a little fuel, not a full tank: sipping on the
// opening daisy is the first thing to learn. Above the 40% warning so the day
// doesn't open with blue edges, and early rain isn't immediately dangerous.
const START_ENERGY = 60;

const DAY_DURATION = 600, DUSK_START = 540, NIGHT_LOSS_DURATION = 6;
// Per-flower supplies before the 0.5 harvest yield, matched to real flowers (see
// Flower_Facts.md): cornflowers for nectar, poppies for pollen, daisies in between.
const NECTAR_SUPPLY: Record<Species, number> = { poppy: 0, daisy: 26, cornflower: 56 };
const POLLEN_SUPPLY: Record<Species, number> = { poppy: 42, daisy: 28, cornflower: 20 };
// Flower supplies track visible material; counters track usable harvest.
// Keep contact/depletion lively while asking for more flower visits per day.
const POLLEN_YIELD = .5, NECTAR_YIELD = .5;
// How close the bee must be for the E landing cue on a flower: reach beyond the petal radius,
// and height above the petal surface. (Previously 2.25 and 3.2.)
const FLOWER_LANDING_REACH = 1.85;
const FLOWER_LANDING_CLEARANCE = 2.8;
interface FlowerSupply { nectar: number; pollen: number; visited: boolean; pollinated: boolean; }
interface TestControl {
  snapshot(): Record<string, unknown>;
  setPose(position: [number, number, number], yaw?: number, pitch?: number, velocity?: [number, number, number]): void;
  approachFlower(id: number): void;
  setCargo(nectar: number, pollen: number, energy?: number): void;
  flowers(): { id: number; species: Species; center: number[]; base: number[]; rotation: number[]; velocity: number[]; height: number; radius: number; pollenFraction: number; visiblePollen: number; pollenMatch: boolean }[];
  setDayProgress(value: number): void;
  setEndingTime(value: number): void;
  setChill(value: number): void;
  setHeat(value: number): void;
  setQuietTime(value: number): void;
  setWindTime(value: number): void;
  shelters(): { id: number; center: number[]; perch: number[]; topPerch: number[]; rotation: number[]; root: number[]; radius: number }[];
  approachShelter(id: number): void;
  setPollination(counts: Partial<Record<Species, number>>): void;
  webs(): { id: number; center: number[]; normal: number[]; radius: number; torn: boolean }[];
  setWebs(enabled: boolean): void;
}
declare global { interface Window { __BEE_TEST__?: TestControl; } }

export class Garden {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(61, 1, .015, 175);
  private meadow: Meadow;
  private atmosphere: ReturnType<typeof createAtmosphere>;
  private homecoming: ReturnType<typeof createHomecoming>;
  private bee: ReturnType<typeof createBeeRig>;
  private audio = new GardenAudio();
  private pollenFX: ReturnType<typeof createPollenFX>;
  private pollinationFX: ReturnType<typeof createPollinationFX>;
  private windFX: ReturnType<typeof createWindEffects>;
  private leafShelters: ReturnType<typeof createShelters>;
  private rainFX: ReturnType<typeof createRain>;
  private flowerRain: ReturnType<typeof createFlowerRain>;
  private webs: ReturnType<typeof createWebs>;
  // Spider webs are on in play; test pages leave them out unless ?webs is given,
  // so older flight checks never fly into one by chance.
  private websEnabled = (() => { const p = new URLSearchParams(location.search); return !p.has('test') || p.has('webs'); })();
  private caughtWeb: SpiderWeb | null = null;
  /** 0–1 progress toward tearing free. */
  private webStruggle = 0;
  private webShake = 0;
  /** Brief immunity after breaking free, so the torn web can't catch again. */
  private webGrace = 0;
  private webExit = new THREE.Vector3();
  private energyWash: ReturnType<typeof createEnergyWash>;
  private weather: MeadowWeather = { stage: 'clear', rain: 0, cloudiness: 0, sunHeat: 0, gale: 0 };
  private weatherPlan: WeatherPlan = FIXED_WEATHER_PLAN;
  // Test pages keep the original fixed day (seed 0); ?weather=N replays one day's weather.
  private pinnedWeatherSeed: number | null = (() => {
    const params = new URLSearchParams(location.search);
    return params.has('test') ? 0 : params.has('weather') ? Number(params.get('weather')) >>> 0 : null;
  })();
  private underLeaf: LeafShelter | null = null;
  private onLeaf: LeafShelter | null = null;
  private shelterTarget: LeafShelter | null = null;
  private shelterAssist: LeafShelter | null = null;
  private shelterAroundEdge = false;
  private shelterAssistTop = false;
  private rainCover: LeafShelter | null = null;
  private rainExposure = 0;
  private onGround = false;
  private grassCover = 0;
  private chill = 0;
  private coldDrain = 0;
  private heat = 0;
  private heatExposure = 0;
  private heatDrain = 0;
  private shade = 0;
  private lossAge = 0;
  private lossFromRain = false;
  private lossFromHeat = false;
  private lossFromNight = false;
  private nightfallChecked = false;
  private flightMode: ViewState['flightMode'] = 'riding';
  private flightEffort = 0;
  private loadSway = 0;
  private heavyWobble = 0;
  private heavyStrain = 0;
  private heavyKick = 0;
  private particleAmount = 0;
  private ui: GameUI;
  private abort = new AbortController();
  private phase: Phase = 'title';
  private resumePhase: Phase = 'flying';
  private position = START.clone();
  private velocity = new THREE.Vector3();
  private previousPosition = START.clone();
  private yaw = 0;
  private pitch = -.13;
  private lookRoll = 0;
  private keys = new Set<string>();
  private closingHeldKeys = new Set<string>();
  private mouseDown = false;
  private dragging = false;
  private lastMouse = new THREE.Vector2();
  private time = 0;
  private elapsed = 0;
  private dayElapsed = 0;
  private resting = false;
  private restAge = 0;
  private quietAge = 0;
  private restView = createRestView();
  private quietHeldKeys = new Set<string>();
  private suppressQuietClick = false;
  private quietUnlockExpected = false;
  private returnDayStart = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private frame = 0;
  private raf = 0;
  private pausedCapture = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private uv = false;
  private energy = 100;
  private nectar = 0;
  private pollen = 0;
  private pollinated = 0;
  private pollinatedBySpecies: Record<Species, number> = { poppy: 0, daisy: 0, cornflower: 0 };
  private pollinationSpecies: Species | null = null;
  private pollinationUntil = 0;
  private visited = 0;
  private loose: Partial<Record<Species, number>> = {};
  private pollenOrder: Species[] = [];
  private previousFlowerBySpecies: Partial<Record<Species, number>> = {};
  private supplies = new Map<number, FlowerSupply>();
  private landed: Flower | null = null;
  private landingAssist: Flower | null = null;
  private landingStart = new THREE.Vector3();
  private landingPerch = new THREE.Vector3();
  private landingDestination = new THREE.Vector3();
  private landingElapsed = 0;
  private landingDuration = 1;
  private landingYaw = 0;
  private landingPitch = 0;
  private localPosition = new THREE.Vector3();
  private localPrevious = new THREE.Vector3();
  private crawlDistance = 0;
  private landingAge = 0;
  private takeoffCooldown = 0;
  private target: Flower | null = null;
  private nectarTarget = new THREE.Vector3();
  private canLand = false;
  private landingHint = '';
  private landingLocal = new THREE.Vector3();
  private canDrink = false;
  private drinking = false;
  private autoFeeding = false;
  private satiated = false;
  private drinkChime = 0;
  private pollenChime = 0;
  private notice = '';
  private noticeUntil = 0;
  // 0 none, 1 low-energy notice shown, 2 very-low notice shown; re-armed at 50.
  private lowEnergyWarned = 0;
  private resultScore = 0;
  private returnAge = 0;
  private returnFuel = 0;
  // Test pages keep the original meadow (seed 481); ?meadow=N replays one layout.
  private pinnedMeadowSeed: number | null = (() => {
    const params = new URLSearchParams(location.search);
    return params.has('test') ? 481 : params.has('meadow') ? Number(params.get('meadow')) >>> 0 : null;
  })();
  private seed = this.pinnedMeadowSeed ?? randomSeed();
  private dayPlayed = false;
  /** Counts days played this session; the morning line names it. */
  private dayNumber = 0;
  /** The player chose to fly home before the harvest goal (R). */
  private headingHome = false;
  /** How the last day at the hive went (set when the bee gets home). */
  private report: DayReport | null = null;
  /** The last finished day, which shapes the next meadow's species mix. */
  private previousDay: DayOutcome | null = null;
  private temp = new THREE.Vector3();
  private collisionPrevious = new THREE.Vector3();
  private inverseFlower = new THREE.Quaternion();
  private wind = new THREE.Vector3();
  private windDrain = 0;
  private forward = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private frameTimes: number[] = [];
  private nectarDrop: ReturnType<typeof createNectarDrop>;
  private tongueTip = new THREE.Vector3();
  private tongueApproach = new THREE.Vector3();
  private nectarBend = new THREE.Vector3();
  private fillLight: THREE.PointLight;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.add(this.camera);
    this.atmosphere = createAtmosphere(this.scene);
    this.meadow = createMeadow(this.scene, this.seed, speciesMixAfter(this.previousDay));
    this.leafShelters = createShelters(this.scene, this.meadow.flowers);
    this.rainFX = createRain(this.scene);
    this.flowerRain = createFlowerRain(this.scene, this.meadow.flowers, this.leafShelters.shelters, this.leafShelters.surface);
    this.webs = createWebs(this.scene, this.seed, this.meadow.flowers, this.leafShelters.shelters); this.webs.setVisible(this.websEnabled);
    this.homecoming = createHomecoming(this.scene, this.meadow.flowers, HOME);
    this.bee = createBeeRig(this.camera);
    this.energyWash = createEnergyWash(this.scene);
    this.pollenFX = createPollenFX(this.scene);
    this.pollinationFX = createPollinationFX(this.scene);
    this.windFX = createWindEffects(this.scene);
    this.nectarDrop = createNectarDrop(this.scene);
    this.nectarDrop.clipTongue(this.bee.tongueTipMaterial);
    this.fillLight = new THREE.PointLight('#fcdfa2', .08, 2.5, 2); this.camera.add(this.fillLight);
    this.ui = createUI({ start: () => this.begin(), explore: () => this.explore(), restart: () => this.begin(), resume: () => this.resume(), pause: () => this.pause(), toggleSound: () => this.audio.toggle(), toggleUV: () => { this.uv = !this.uv; }, returnHome: () => this.returnHome(), skipReturn: () => this.skipClosing(), toggleRest: () => this.toggleRest() });
    this.resetSupply(); this.bindInput(); this.resize(); this.updateWorld(0); this.updateView(0); this.installHooks();
    this.raf = requestAnimationFrame(this.tick);
  }

  private resetSupply(): void {
    this.supplies.clear();
    this.pollinated = 0;
    this.pollinatedBySpecies = { poppy: 0, daisy: 0, cornflower: 0 };
    for (const f of this.meadow.flowers) {
      f.pollenFraction = 1;
      f.visited = false;
      this.supplies.set(f.id, { nectar: NECTAR_SUPPLY[f.species], pollen: POLLEN_SUPPLY[f.species], visited: false, pollinated: false });
    }
  }
  private notify(message: string, duration = 4): void { this.notice = message; this.noticeUntil = this.time + duration; }
  /** Replaces the meadow and everything built on its flowers. */
  private rebuildMeadow(seed: number, mix: SpeciesMix): void {
    this.stopRest(); this.clearShelter(); this.leafShelters.dispose(); this.flowerRain.dispose(); this.webs.dispose(); this.caughtWeb = null; this.seed = seed;
    this.pollinationFX.reset(); this.homecoming.dispose(); this.meadow.dispose();
    this.meadow = createMeadow(this.scene, seed, mix);
    this.leafShelters = createShelters(this.scene, this.meadow.flowers);
    this.flowerRain = createFlowerRain(this.scene, this.meadow.flowers, this.leafShelters.shelters, this.leafShelters.surface);
    this.webs = createWebs(this.scene, seed, this.meadow.flowers, this.leafShelters.shelters); this.webs.setVisible(this.websEnabled);
    this.homecoming = createHomecoming(this.scene, this.meadow.flowers, HOME);
    this.resetSupply(); this.landed = null; this.landingAssist = null;
  }

  /** Every day after the first grows a new meadow, its species mix shaped by the
   * day before (see speciesMixAfter). The first day keeps the title-screen meadow. */
  private nextMeadow(): void {
    if (!this.dayPlayed) { this.dayPlayed = true; return; }
    this.previousDay = { pollinatedBySpecies: { ...this.pollinatedBySpecies }, completed: this.phase === 'won', tier: this.phase === 'won' ? this.report?.tier ?? null : this.phase === 'lost' ? 'lost' : null };
    if (this.pinnedMeadowSeed === null) this.rebuildMeadow(randomSeed(), speciesMixAfter(this.previousDay));
  }

  /** Each day gets its own showers, hot spell and wind timing and direction. */
  private rollDayWeather(): void {
    const seed = this.pinnedWeatherSeed ?? randomSeed();
    if (seed === 0) { this.weatherPlan = FIXED_WEATHER_PLAN; setWindVariation(0, 0); return; }
    const random = rng(seed);
    this.weatherPlan = planWeather(random);
    setWindVariation(random() * 240, (random() - .5) * Math.PI * 2);
  }

  private begin(showWelcome = true): void {
    // A finished day (home or not) moves the count on; restarting a day does not.
    if (this.dayNumber === 0 || this.phase === 'won' || this.phase === 'lost') this.dayNumber++;
    this.nextMeadow();
    this.rollDayWeather();
    this.headingHome = false; this.report = null;
    this.phase = 'flying'; this.position.copy(START); this.previousPosition.copy(START); this.velocity.set(0, 0, 0);
    this.yaw = 0; this.pitch = -.13; this.energy = START_ENERGY; this.nectar = 0; this.pollen = 0;
    this.pollinated = 0; this.visited = 0; this.loose = {}; this.pollenOrder = []; this.previousFlowerBySpecies = {};
    this.pollinationSpecies = null; this.pollinationUntil = 0; this.pollinationFX.reset();
    this.elapsed = 0; this.time = 0; this.landed = null; this.landingAssist = null; this.drinking = false; this.autoFeeding = false; this.satiated = false; this.crawlDistance = 0; this.uv = false; this.resultScore = 0;
    this.dayElapsed = 0; this.stopRest(); this.clearShelter(); this.returnDayStart = 0; this.homecoming.reset();
    this.quietAge = 0; this.restView.reset(); this.quietHeldKeys.clear(); this.suppressQuietClick = false; this.quietUnlockExpected = false;
    this.chill = 0; this.coldDrain = 0; this.heat = 0; this.heatExposure = 0; this.heatDrain = 0; this.shade = 0;
    this.lossAge = 0; this.lossFromRain = false; this.lossFromHeat = false; this.lossFromNight = false; this.nightfallChecked = false;
    this.flowerRain.update(0, this.position, 0, this.reducedMotion, false);
    this.flightMode = 'riding'; this.flightEffort = 0; this.loadSway = 0; this.heavyWobble = 0; this.heavyStrain = 0; this.heavyKick = 0; this.lookRoll = 0;
    this.windFX.reset(this.position, this.time);
    this.returnAge = 0; this.returnFuel = 0; this.windDrain = 0; this.takeoffCooldown = 0; this.accumulator = 0; this.keys.clear(); this.closingHeldKeys.clear(); this.mouseDown = false;
    this.pausedCapture = false; this.resetSupply(); this.pollenFX.reset(); this.particleAmount = 0; this.notice = ''; this.noticeUntil = 0; this.lowEnergyWarned = 0;
    this.webs.reset(); this.caughtWeb = null; this.webStruggle = 0; this.webShake = 0; this.webGrace = 0;
    void this.audio.start().catch(() => this.notify('Sound is unavailable. You can still play.'));
    this.canvas.focus({ preventScroll: true });
    if (showWelcome) {
      // Begin on a real moving petal. Reading time advances only the scenery,
      // never daylight, weather, energy, collection or the quiet-rest timer.
      this.updateWorld(0);
      const flower = this.meadow.flowers[0];
      this.position.copy(flower.center).add(new THREE.Vector3(0, .55, 1));
      this.land(flower); this.phase = 'learning';
      this.notice = ''; this.noticeUntil = 0;
      this.bee.snapPose(true); this.camera.fov = 66; this.camera.updateProjectionMatrix();
      this.updateView(0);
    }
  }
  private explore(): void {
    if (this.phase !== 'learning') return;
    this.phase = 'landed'; this.clearInput(); this.quietAge = 0;
    // From the second day, the Queen's words echo how the day before went.
    const morning = this.dayNumber > 1 ? morningLine(this.dayNumber, this.previousDay?.tier ?? null) : '';
    if (morning) this.notify(morning, 8);
    this.canvas.focus({ preventScroll: true });
    this.updateView(0);
  }
  private pause(): void {
    if (this.phase !== 'flying' && this.phase !== 'landed' && this.phase !== 'returning' && this.phase !== 'failing') return;
    this.resumePhase = this.phase; this.phase = 'paused'; this.clearInput(); this.drinking = false;
    this.quietHeldKeys.clear(); this.suppressQuietClick = false; this.quietUnlockExpected = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  private resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = this.resumePhase; this.clearInput(); this.canvas.focus({ preventScroll: true });
  }
  private clearInput(): void { this.keys.clear(); this.mouseDown = false; this.dragging = false; }
  private latchClosingKeys(): void {
    // Arrival can occur while climbing. Release that Space before allowing a
    // fresh press to skip, including native activation of the focused button.
    for (const code of ['Space', 'Enter']) if (this.keys.has(code)) this.closingHeldKeys.add(code);
  }
  private stopRest(): void { this.resting = false; this.restAge = 0; }
  private quietFade(): number { return THREE.MathUtils.smoothstep(this.quietAge, QUIET_AFTER, QUIET_AFTER + 2); }
  private wakeQuiet(): boolean {
    const waking = this.phase === 'landed' && (this.quietFade() > 0 || this.restView.active);
    this.quietAge = 0;
    if (waking) { this.stopRest(); this.clearInput(); }
    return waking;
  }
  private clearShelter(): void { this.underLeaf = null; this.onLeaf = null; this.shelterTarget = null; this.shelterAssist = null; this.shelterAssistTop = false; this.rainCover = null; this.onGround = false; this.grassCover = 0; }
  private toggleRest(): void {
    if (this.phase !== 'landed' || !(this.landed || this.underLeaf || this.onLeaf || this.onGround)) return;
    if (this.onLeaf && this.needsLeafShelter()) {
      const leaf = this.onLeaf;
      this.onLeaf = null; this.phase = 'flying'; this.approachLeaf(leaf);
      return;
    }
    if (this.resting) { this.stopRest(); return; }
    this.clearInput(); this.resting = true; this.restAge = 0;
    this.drinking = false; this.canDrink = false; this.autoFeeding = false;
    this.velocity.set(0, 0, 0); this.crawlDistance = 0;
    this.noticeUntil = this.time;
    this.canvas.focus({ preventScroll: true });
  }
  private bindInput(): void {
    const signal = this.abort.signal;
    window.addEventListener('resize', () => this.resize(), { signal });
    // Catch wake gestures before buttons, pointer lock, or flight controls.
    // Held-key repeats stay consumed until release; waking never launches a bee.
    window.addEventListener('keydown', e => {
      if (this.quietHeldKeys.has(e.code) || this.wakeQuiet()) {
        if (e.code === 'Escape' && document.pointerLockElement === this.canvas) this.quietUnlockExpected = true;
        this.quietHeldKeys.add(e.code); e.preventDefault(); e.stopImmediatePropagation();
      }
    }, { signal, capture: true });
    window.addEventListener('pointerdown', e => {
      this.suppressQuietClick = this.wakeQuiet();
      if (this.suppressQuietClick) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, { signal, capture: true });
    window.addEventListener('click', e => {
      if (this.suppressQuietClick) { this.suppressQuietClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
    }, { signal, capture: true });
    window.addEventListener('auxclick', e => {
      if (this.suppressQuietClick) { this.suppressQuietClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
    }, { signal, capture: true });
    window.addEventListener('keydown', e => {
      if (this.closingHeldKeys.has(e.code)) { e.preventDefault(); return; }
      if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
      if (['Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (this.phase === 'landed' && this.resting && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space'].includes(e.code)) this.stopRest();
      if (e.repeat) return;
      if (e.code === 'Escape') { if (this.phase === 'paused') this.resume(); else this.pause(); }
      if (e.code === 'KeyM') this.audio.toggle();
      if (this.phase === 'returning' || this.phase === 'failing') {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.skipClosing(); }
        return;
      }
      if (e.code === 'Enter' && (this.phase === 'title' || this.phase === 'won' || this.phase === 'lost')) this.begin();
      if (this.phase !== 'flying' && this.phase !== 'landed') return;
      if (e.code === 'KeyQ') this.uv = !this.uv;
      if (this.caughtWeb) { if (e.code === 'Space' || e.code === 'KeyW') this.tugWeb(); return; }
      if (e.code === 'KeyE') {
        if (this.phase === 'flying') this.tryLand();
        else this.toggleRest();
      }
      if (e.code === 'Space' && this.phase === 'landed') this.takeoff();
      if (e.code === 'Space' && (this.landingAssist || this.shelterAssist)) { this.landingAssist = null; this.shelterAssist = null; this.notify('Landing cancelled · Hold Space to rise', 3); }
      if (e.code === 'KeyR') this.returnHome();
    }, { signal });
    window.addEventListener('keyup', e => {
      this.quietHeldKeys.delete(e.code);
      this.keys.delete(e.code);
      if (this.closingHeldKeys.delete(e.code)) e.preventDefault();
    }, { signal });
    window.addEventListener('blur', () => this.pause(), { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); }, { signal });
    this.canvas.addEventListener('pointerdown', e => {
      if (this.phase === 'returning' || this.phase === 'failing') { if (e.button === 0) this.skipClosing(); return; }
      if (this.phase !== 'flying' && this.phase !== 'landed') return;
      if (e.button === 0) this.stopRest();
      this.canvas.focus({ preventScroll: true }); this.mouseDown = e.button === 0;
      this.dragging = true; this.lastMouse.set(e.clientX, e.clientY);
      if (!document.pointerLockElement) {
        const result = this.canvas.requestPointerLock?.();
        if (result) void result.catch(() => { /* Drag-look remains available. */ });
      }
    }, { signal });
    window.addEventListener('pointerup', () => { this.mouseDown = false; this.dragging = false; }, { signal });
    window.addEventListener('pointercancel', () => { this.suppressQuietClick = false; this.clearInput(); }, { signal });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) return;
      this.clearInput();
      if (this.quietUnlockExpected) { this.quietUnlockExpected = false; return; }
      if (this.phase === 'flying' || this.phase === 'landed') this.pause();
    }, { signal });
    window.addEventListener('pointermove', e => {
      if (this.phase !== 'flying' && this.phase !== 'landed') return;
      if (this.quietFade() > 0 || this.restView.active) return;
      if (this.dragging || document.pointerLockElement === this.canvas && (e.movementX || e.movementY)) this.quietAge = 0;
      if (document.pointerLockElement === this.canvas) {
        this.yaw -= e.movementX * .0022; this.pitch -= e.movementY * .0022;
      } else if (this.dragging) {
        this.yaw -= (e.clientX - this.lastMouse.x) * .004; this.pitch -= (e.clientY - this.lastMouse.y) * .004;
      }
      this.lastMouse.set(e.clientX, e.clientY); this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.25);
    }, { signal });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  }
  private resize(): void {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }
  private tick = (stamp: number): void => {
    const dt = this.lastFrame ? Math.min((stamp - this.lastFrame) / 1000, .1) : 0;
    this.lastFrame = stamp; this.frame++;
    if (dt > 0) { this.frameTimes.push(dt * 1000); if (this.frameTimes.length > 240) this.frameTimes.shift(); }
    if (!this.pausedCapture && this.phase !== 'paused') {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED && steps++ < 6) { this.step(FIXED); this.accumulator -= FIXED; }
    }
    this.updateWorld(this.reducedMotion ? 0 : this.time);
    this.updateView(dt);
    this.renderer.render(this.scene, this.camera);
    this.publishDiagnostics();
    this.raf = requestAnimationFrame(this.tick);
  };
  private step(dt: number): void {
    this.time += dt;
    this.previousPosition.copy(this.position);
    if (this.phase === 'failing') {
      this.lossAge += dt;
      if (this.lossProgress() >= 1) this.finishLoss();
      return;
    }
    if (this.phase === 'returning') {
      this.returnAge += dt;
      if (this.returnAge >= (this.reducedMotion ? QUIET_ENDING_DURATION : ENDING_DURATION)) this.finishReturn();
      return;
    }
    if (this.phase !== 'flying' && this.phase !== 'landed') return;
    this.elapsed += dt; this.landingAge += dt; this.takeoffCooldown = Math.max(0, this.takeoffCooldown - dt);
    // Only the daylight clock speeds up: wind, flower sway and metabolic
    // costs keep their ordinary pace while the bee takes a quiet moment.
    const previousDay = this.dayElapsed;
    this.dayElapsed = Math.min(DAY_DURATION, this.dayElapsed + dt * (this.resting ? REST_DAY_RATE : 1));
    if (previousDay < DUSK_START && this.dayElapsed >= DUSK_START) {
      // Wake at sunset so a rest cannot silently skip the final minute.
      this.dayElapsed = DUSK_START; this.stopRest(); this.quietAge = 0; this.restView.reset();
      this.notify(this.harvestReady() || this.headingHome ? 'Sunset · Follow the hive marker home.' : 'Sunset · One minute of daylight. Keep gathering, or press R to head home with what you have.', 9);
    }
    const previousWeather = this.weather.stage, previousGale = this.weather.gale, neededShelter = this.needsLeafShelter();
    this.sampleWeather();
    if (this.onLeaf && (this.resting || !neededShelter) && this.needsLeafShelter()) {
      this.stopRest(); this.notify(this.weather.rain > .05 ? 'Rain on the leaf · E to tuck underneath' : 'Hot sun on the leaf · E to rest in its shade', 5);
    }
    const previousChill = this.chill;
    // This is an arcade exposure model, not a body-temperature simulation.
    // Flowers remain exposed; shelter removes the rain cost immediately and
    // lets accumulated cold recede without creating energy from nothing.
    this.chill = THREE.MathUtils.clamp(this.chill + dt * (this.rainExposure > .01 ? this.rainExposure * .045 : this.rainCover || this.grassCover > .99 ? -.12 : -.055), 0, 1);
    // Keep the early watercolor/notice, but leave time to steer toward shelter:
    // at full exposure, .18 (warning) to .5 is about seven seconds for cold.
    // The steep drain then ramps smoothly; ordinary flight still spends fuel.
    this.coldDrain = this.rainExposure * (.3 + THREE.MathUtils.smoothstep(this.chill, .5, 1) * (1.1 + this.chill * 6.2)) + this.chill * .35;
    if (previousChill < .18 && this.chill >= .18) this.notify('Cold rain is draining your energy. Follow the leaf to shelter.', 6);
    if (previousChill < .62 && this.chill >= .62) this.notify('You are getting soaked. A broad leaf will stop the rain.', 6);
    const previousHeat = this.heat;
    // Short exposure has a grace period. Dense grass and the existing moving
    // canopy cover stop solar heating; leaf tops and blossoms stay exposed.
    const cooling = this.shade * (this.resting ? .22 : .16) + (1 - this.shade) * (this.weather.sunHeat <= .18 ? (this.weather.rain > .01 ? .22 : .07) : 0);
    this.heat = THREE.MathUtils.clamp(this.heat + dt * (this.heatExposure * .035 - cooling), 0, 1);
    // Heat gets the same delayed escalation: about nine seconds from its first
    // warning to the ramp, with the orange wash already visible while reacting.
    this.heatDrain = this.heatExposure * THREE.MathUtils.smoothstep(this.heat, .5, 1) * (1.1 + this.heat * 5.8) + this.heat * .15;
    if (previousHeat < .18 && this.heat >= .18) this.notify('Too much sun · Rest beneath a leaf or in the grass', 5);
    if (previousHeat < .65 && this.heat >= .65) this.notify('Your wings are overheating · Find shade', 5);
    if (this.weather.stage !== previousWeather) {
      if (this.weather.stage === 'approaching') this.notify('A little cloud is gathering. Broad leaves offer shelter.', 7);
      else if (this.weather.stage === 'rain') this.notify('A passing shower. Follow the leaf and press E to tuck underneath.', 7);
      else if (this.weather.stage === 'clearing') this.notify('The shower is passing. The meadow is brightening.', 5);
    }
    if (previousGale < .2 && this.weather.gale >= .2) this.notify('Heavy wind is rising · Fly low, perch or shelter in the grass to save energy.', 7);
    else if (previousGale >= .2 && this.weather.gale < .2) this.notify('The wind is easing.', 4);
    if (this.keys.has('ArrowLeft')) this.yaw += dt * 1.35;
    if (this.keys.has('ArrowRight')) this.yaw -= dt * 1.35;
    if (this.keys.has('ArrowUp')) this.pitch = Math.min(1.25, this.pitch + dt);
    if (this.keys.has('ArrowDown')) this.pitch = Math.max(-1.35, this.pitch - dt);
    flightWindAt(this.position.x, this.position.y, this.position.z, this.time, this.wind);
    this.crawlDistance = 0;
    this.loadSway = 0; this.heavyWobble = 0; this.heavyStrain = 0; this.heavyKick = 0;
    this.windDrain = 0;
    this.updateAppetite();
    this.webGrace = Math.max(0, this.webGrace - dt); this.webShake = Math.max(0, this.webShake - dt * 2.5);
    if (this.caughtWeb) this.struggle(dt);
    else {
      if (this.phase === 'flying') this.fly(dt); else if (!this.resting) this.crawl(dt);
      this.checkWebs();
    }
    this.drinking = false;
    if (this.phase === 'landed' && this.landed && !this.resting) this.forage(dt);
    // Wing work is relative to the air: riding a current saves energy, while
    // holding ground against it needs sustained effort.
    const drain = (this.phase === 'flying' ? .65 + this.flightEffort * .38 + this.load() * .32 + this.windDrain : this.resting ? .025 : .065) + Math.max(this.coldDrain, this.heatDrain);
    // Resolve feeding and expenditure together before clamping. A tiny meal
    // must not make the bee immortal when rain costs more than it restores.
    this.energy -= drain * dt;
    // A full store starts a meal that continues after the first mouthful makes
    // room. Ignore sub-percent deficits while the meter already reads full.
    if (!this.resting && this.nectar >= NECTAR_CAPACITY - 1e-6 && this.energy < 99) this.autoFeeding = true;
    if ((this.resting || this.autoFeeding) && !this.drinking) {
      const consumed = Math.min(this.nectar, dt * SIP_ENERGY_RATE / ENERGY_PER_NECTAR, (100 - this.energy) / ENERGY_PER_NECTAR);
      this.nectar -= consumed; this.energy = Math.min(100, this.energy + consumed * ENERGY_PER_NECTAR);
    } else if (!this.autoFeeding && this.energy < 32 && this.nectar > 0) {
      const consumed = Math.min(this.nectar, dt * 1.2, (32 - this.energy) / ENERGY_PER_NECTAR);
      this.nectar -= consumed; this.energy = Math.min(100, this.energy + consumed * ENERGY_PER_NECTAR);
      if (this.noticeUntil < this.time) this.notify('Using a little stored nectar for energy.');
    }
    if (this.energy >= 99.99 || this.nectar <= 0) this.autoFeeding = false;
    // Low-energy notices arrive with the blue edges, once per dip, and re-arm
    // after a real refuel. Cold and heat already have their own warnings.
    if (this.energy >= 50) this.lowEnergyWarned = 0;
    if ((this.phase === 'flying' || this.phase === 'landed') && !this.drinking && !this.resting) {
      if (this.lowEnergyWarned < 1 && this.energy < 38 && this.chill < .18 && this.heat < .18) {
        this.lowEnergyWarned = 1;
        this.notify(this.nectar > 2
          ? 'Energy is getting low · Stored nectar will help for a while. Sip from a daisy or cornflower to refuel.'
          : 'Energy is getting low · Find a daisy or cornflower and hold F to sip nectar.', 7);
      }
      if (this.lowEnergyWarned < 2 && this.energy < 18) {
        this.lowEnergyWarned = 2;
        this.notify('Almost out of energy · Land on the nearest daisy or cornflower and sip nectar now.', 8);
      }
    }
    if (this.resting) {
      this.restAge += dt;
      if (this.restAge >= REST_DURATION) {
        this.stopRest();
        this.notify(this.onGround ? 'A quiet moment among the grass. Space to fly when you are ready.' : this.onLeaf ? 'A quiet moment on the leaf. Space to fly.' : this.underLeaf ? (this.weather.rain > .05 ? 'A quiet moment beneath the leaf. The shower will pass.' : 'The meadow is waiting. Space to fly out.') : 'A quiet moment on a petal. Ready when you are.', 3);
      }
    }
    this.updateAppetite();
    this.energy = Math.max(0, this.energy);
    if (this.energy <= 0) this.beginLoss();
    else if (this.canReturn()) this.returnHome();
    if ((this.phase === 'flying' || this.phase === 'landed') && this.dayElapsed >= DAY_DURATION && !this.nightfallChecked) {
      this.nightfallChecked = true;
      if (!this.harvestReady()) this.beginLoss(true);
      else this.notify('The last light · Your harvest is ready. Follow the hive marker home.', 9);
    }
    const safePerch = this.phase === 'landed' && this.dayElapsed < DUSK_START && this.energy > 35 && this.chill < .18 && this.rainExposure < .05 && this.heat < .18 && this.heatExposure < .18;
    const idle = safePerch && !this.keys.size && !this.quietHeldKeys.size && !this.mouseDown && !this.dragging && !this.drinking && !this.suppressQuietClick;
    this.quietAge = idle ? this.quietAge + dt : 0;
    this.restView.step(dt, this.quietAge >= SCENIC_AFTER, this.position, this.reducedMotion);
  }
  private lossDuration(): number { return this.reducedMotion ? QUIET_LOSS_DURATION : this.lossFromNight ? NIGHT_LOSS_DURATION : LOSS_DURATION; }
  private lossProgress(): number { return this.phase === 'lost' ? 1 : Math.min(1, this.lossAge / this.lossDuration()); }
  private coldVignette(): number {
    if (this.phase === 'title' || this.phase === 'returning' || this.phase === 'won' || this.phase === 'paused' && this.resumePhase === 'returning') return 0;
    return Math.max(this.chill * .82, THREE.MathUtils.smoothstep(40 - this.energy, 0, 40) * .95);
  }
  private beginLoss(nightfall = false): void {
    this.quietAge = 0; this.restView.reset();
    this.latchClosingKeys();
    this.lossFromNight = nightfall;
    this.lossFromHeat = !nightfall && this.heat > .2 && this.heat > this.chill && this.heatDrain >= this.coldDrain;
    this.lossFromRain = !nightfall && !this.lossFromHeat && (this.coldDrain > .5 || this.chill > .2);
    this.stopRest(); this.phase = 'failing'; this.lossAge = 0;
    this.landingAssist = null; this.shelterAssist = null;
    this.drinking = false; this.canDrink = false; this.autoFeeding = false; this.uv = false;
    this.velocity.set(0, 0, 0); this.clearInput(); this.noticeUntil = 0;
    this.audio.chime('fail');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  private finishLoss(): void {
    if (this.phase !== 'failing') return;
    this.lossAge = this.lossDuration();
    this.phase = 'lost'; this.clearInput();
    this.resultScore = this.pollinated * 80;
  }
  private skipClosing(): void {
    if (this.phase === 'failing') this.finishLoss(); else this.finishReturn();
  }
  private load(): number { return THREE.MathUtils.clamp((this.nectar / NECTAR_CAPACITY + this.pollen / POLLEN_GOAL) * .5, 0, 1); }
  private needsShade(): boolean { return this.weather.sunHeat > .18 || this.heat > .18; }
  private needsLeafShelter(): boolean { return this.weather.rain > .05 || this.needsShade(); }
  private sampleWeather(): void {
    const cinematic = this.phase === 'returning' || this.phase === 'won' || this.phase === 'title' || this.phase === 'paused' && this.resumePhase === 'returning';
    weatherAt(cinematic ? 0 : this.dayElapsed, this.weather, this.weatherPlan);
    setWindGale(this.weather.gale);
    this.rainCover = this.underLeaf;
    if (!this.rainCover) for (const leaf of this.leafShelters.shelters) {
      this.temp.subVectors(this.position, leaf.center).applyQuaternion(this.inverseFlower.copy(leaf.rotation).invert());
      if (leafPlanarDistance(this.temp.x, this.temp.z) < leaf.radius * .8 && this.temp.y < leafSurfaceHeight(this.temp.x, this.temp.z) - .15 && this.temp.y > -1.82) {
        this.rainCover = leaf; break;
      }
    }
    this.grassCover = this.landed || this.onLeaf ? 0 : grassRainCover(this.position.x, this.position.y, this.position.z);
    this.rainExposure = this.rainCover ? 0 : this.weather.rain * (1 - this.grassCover);
    this.shade = this.rainCover ? 1 : this.grassCover;
    this.heatExposure = this.weather.sunHeat * (1 - this.shade);
  }
  private groundAltitude(): number { return Math.max(.6, meadowGroundHeight(this.position.x, this.position.z) + .55); }
  private landOnGround(): void {
    this.phase = 'landed'; this.onGround = true; this.landed = null; this.landingAssist = null;
    this.position.y = this.groundAltitude(); this.previousPosition.copy(this.position);
    this.velocity.set(0, 0, 0); this.flightEffort = 0; this.canDrink = false; this.drinking = false;
    this.audio.chime('land'); this.notify('Sheltered among the grass · E to rest · Space to fly', 5);
  }
  private nearestShelter(): LeafShelter | null {
    let nearest: LeafShelter | null = null, distance = Infinity;
    for (const leaf of this.leafShelters.shelters) {
      const d = this.position.distanceToSquared(leaf.perch);
      if (d < distance) { distance = d; nearest = leaf; }
    }
    return nearest;
  }
  private fly(dt: number): void {
    if (this.shelterAssist) { this.settleOnLeaf(dt); return; }
    if (this.landingAssist) { this.settleOntoFlower(dt); return; }
    const forwardInput = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const lift = Number(this.keys.has('Space')) - Number(this.keys.has('ControlLeft') || this.keys.has('ControlRight'));
    const brake = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    // Forward follows the view. Explicit lift replaces its vertical component,
    // so looking down while holding W can never cancel a Space climb.
    const yaw = this.yaw;
    this.direction.set(-Math.sin(yaw) * Math.cos(this.pitch) * forwardInput + Math.cos(yaw) * side, Math.sin(this.pitch) * forwardInput, -Math.cos(yaw) * Math.cos(this.pitch) * forwardInput - Math.sin(yaw) * side);
    if (this.direction.lengthSq() > 1) this.direction.normalize();
    const steering = this.direction.lengthSq() > 0 || lift !== 0;
    this.flightMode = brake ? 'steady' : steering ? 'flying' : 'riding';
    const loadFactor = 1 - .40 * this.load();
    const speed = (brake ? 1.05 : 3.6) * loadFactor * (1 - this.rainExposure * .12);
    this.direction.multiplyScalar(speed);
    // Loaded wingbeats weave gently across the heading. This adds weight without
    // changing where W points or interfering with explicit Space lift.
    this.loadSway = steering ? Math.sin(this.time * 2.2 + .7) * .22 * this.load() ** 2 * (brake ? .4 : 1) : 0;
    this.direction.x += Math.cos(yaw) * this.loadSway;
    this.direction.z -= Math.sin(yaw) * this.loadSway;
    // Near a full load the bee wobbles in a few directions at once: an uneven
    // side-to-side drift, a sagging bob and small surges, so heavy flight feels
    // laboured. Shift steadies it by half; Space still climbs cleanly. On top of
    // that slow drift, quick strain beats (about 1.2 a second) dip the camera and
    // the wing hum, which reads as effort rather than wind.
    const heavy = THREE.MathUtils.smoothstep(this.load(), .6, 1) * (brake ? .5 : 1);
    if (heavy > 0) {
      const t = this.time;
      const sway = (Math.sin(t * 3.1) * .6 + Math.sin(t * 5.3 + 1.7) * .4) * .4 * heavy;
      const bob = ((Math.sin(t * 4.2 + .4) * .7 + Math.sin(t * 7.7) * .3) * .45 - .12) * heavy;
      const surge = Math.sin(t * 2.6 + 2.1) * .3 * heavy;
      this.direction.x += Math.cos(yaw) * sway - Math.sin(yaw) * surge;
      this.direction.z -= Math.sin(yaw) * sway + Math.cos(yaw) * surge;
      this.direction.y += bob;
      this.heavyWobble = sway;
      this.heavyStrain = Math.max(0, Math.sin(t * 7.5)) ** 4 * heavy;
      this.heavyKick = this.heavyStrain * (Math.sin(t * 3.75) >= 0 ? 1 : -1);
    } else { this.heavyWobble = 0; this.heavyStrain = 0; this.heavyKick = 0; }
    // Shift steadies horizontal travel; explicit climb/descent keeps authority.
    if (lift !== 0) this.direction.y = lift * 3.6 * loadFactor;
    // Strong air costs wing work to steer through, especially into the current.
    // Riding it remains cheap. Low flight reduces the field before this cost
    // is calculated, and perched bees pay no wind cost at all.
    const windSpeed = Math.hypot(this.wind.x, this.wind.z);
    const horizontalSpeed = Math.hypot(this.direction.x, this.direction.z);
    const opposition = Math.max(0, -(this.direction.x * this.wind.x + this.direction.z * this.wind.z) / Math.max(.001, horizontalSpeed * windSpeed));
    this.windDrain = THREE.MathUtils.smoothstep(windSpeed, 2.4, 6.3)
      * (brake ? 1.3 : steering ? .5 + opposition * .85 : .12) * (1 + this.load() * .35);
    // Controls request airspeed, not ground speed. Released controls settle
    // into the local current, retaining momentum through changing gusts.
    // Beyond the flowers, the exposed gust overwhelms hover assistance smoothly.
    // It acts through the same wind/inertia model as ordinary flight.
    const edge = edgeExposureAt(this.position.x, this.position.z);
    this.direction.addScaledVector(this.wind, brake ? .10 + .90 * edge : 1);
    const response = (brake ? 9 : steering ? 3.4 : 1.45) / (1 + this.load() * .85);
    const previousVerticalSpeed = this.velocity.y;
    this.velocity.lerp(this.direction, 1 - Math.exp(-response * dt));
    if (lift !== 0) this.velocity.y = THREE.MathUtils.damp(previousVerticalSpeed, this.direction.y, 8, dt);
    this.flightEffort = this.temp.subVectors(this.velocity, this.wind).length();
    this.position.addScaledVector(this.velocity, dt);
    if (this.position.y <= this.groundAltitude()) {
      this.position.y = this.groundAltitude(); this.velocity.y = Math.max(0, this.velocity.y);
      if (lift <= 0) { this.landOnGround(); return; }
    }
    if (this.position.y > 13) { this.position.y = 13; this.velocity.y = Math.min(0, this.velocity.y); }
    // Gentle collision response on tall stems and blossom bowls, separate from
    // render topology. E explicitly catches petals or starts the landing assist.
    for (const f of this.meadow.flowers) {
      const dx = this.position.x - f.center.x, dz = this.position.z - f.center.z;
      const horizontal = Math.hypot(dx, dz);
      const stemU = THREE.MathUtils.clamp((this.position.y - f.base.y) / f.height, 0, 1);
      const stemX = f.base.x + (f.center.x - f.base.x) * stemU * stemU, stemZ = f.base.z + (f.center.z - f.base.z) * stemU * stemU;
      const stemDX = this.position.x - stemX, stemDZ = this.position.z - stemZ, stemDistance = Math.hypot(stemDX, stemDZ);
      if (stemDistance < .12 && this.position.y < f.center.y - .28) {
        const d = Math.max(stemDistance, .001); this.position.x = stemX + stemDX / d * .13; this.position.z = stemZ + stemDZ / d * .13; this.velocity.multiplyScalar(.65);
      }
      if (horizontal < f.radius + .1 && Math.abs(this.position.y - f.center.y) < .8) {
        this.inverseFlower.copy(f.rotation).invert();
        this.temp.subVectors(this.position, f.center).applyQuaternion(this.inverseFlower);
        this.collisionPrevious.subVectors(this.previousPosition, f.center).applyQuaternion(this.inverseFlower);
        const surface = surfaceHeight(f.species, this.temp.x, this.temp.z, f.radius) + .23;
        if (Math.hypot(this.temp.x, this.temp.z) < f.radius * .96 && this.temp.y < surface && this.collisionPrevious.y >= surface - .03) {
          this.temp.y = surface; this.position.copy(this.temp).applyQuaternion(f.rotation).add(f.center);
          this.velocity.y = Math.max(0, this.velocity.y); this.velocity.multiplyScalar(.85);
        }
      }
    }
    // Canopies have a gentle two-sided collision proxy. Space beneath a leaf
    // guides the bee outward until clear, so takeoff never passes through it.
    for (const leaf of this.leafShelters.shelters) {
      this.inverseFlower.copy(leaf.rotation).invert();
      this.temp.subVectors(this.position, leaf.center).applyQuaternion(this.inverseFlower);
      if (leafPlanarDistance(this.temp.x, this.temp.z) >= leaf.radius + .32) continue;
      this.collisionPrevious.subVectors(this.previousPosition, leaf.center).applyQuaternion(this.inverseFlower);
      const surface = leafSurfaceHeight(this.temp.x, this.temp.z);
      if (this.collisionPrevious.y < surface && this.temp.y > surface - .32) {
        this.temp.y = surface - .32;
        this.position.copy(this.temp).applyQuaternion(leaf.rotation).add(leaf.center);
        this.velocity.y = Math.min(0, this.velocity.y);
        if (lift > 0) { this.position.x -= Math.sin(this.yaw) * 2.4 * dt; this.position.z -= Math.cos(this.yaw) * 2.4 * dt; }
      } else if (this.collisionPrevious.y >= surface && this.temp.y < surface + .29) {
        this.temp.y = surface + .29;
        this.position.copy(this.temp).applyQuaternion(leaf.rotation).add(leaf.center);
        this.velocity.y = Math.max(0, this.velocity.y);
      }
    }
  }
  private crawl(dt: number): void {
    if (this.onGround) {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      this.temp.set(-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side, 0, -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side);
      if (this.temp.lengthSq() > 1) this.temp.normalize();
      // The edge current reaches into the grass too: outward steps fade across the
      // grassy apron and a gentle inward drift carries the bee back toward the flowers.
      const edge = edgeExposureAt(this.position.x, this.position.z);
      if (edge > 0) {
        const r = Math.max(.001, Math.hypot(this.position.x, this.position.z)), ox = this.position.x / r, oz = this.position.z / r;
        const outward = this.temp.x * ox + this.temp.z * oz;
        if (outward > 0) { this.temp.x -= ox * outward * edge; this.temp.z -= oz * outward * edge; }
        this.temp.x -= ox * edge * .6; this.temp.z -= oz * edge * .6;
      }
      this.position.addScaledVector(this.temp, .8 * dt);
      const distance = Math.hypot(this.position.x, this.position.z);
      if (distance > MEADOW_EDGE_FULL) { this.position.x *= MEADOW_EDGE_FULL / distance; this.position.z *= MEADOW_EDGE_FULL / distance; }
      this.position.y = this.groundAltitude(); this.velocity.set(0, 0, 0); this.flightEffort = 0;
      return;
    }
    const f = this.landed; if (!f) return;
    this.localPrevious.copy(this.localPosition);
    const a = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const b = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    this.temp.set(-Math.sin(this.yaw) * a + Math.cos(this.yaw) * b, 0, -Math.cos(this.yaw) * a - Math.sin(this.yaw) * b);
    if (this.temp.lengthSq() > 1) this.temp.normalize();
    this.temp.applyQuaternion(f.rotation.clone().invert()); this.temp.y = 0;
    this.localPosition.addScaledVector(this.temp, .36 * dt);
    const radius = f.radius * .81, dist = Math.hypot(this.localPosition.x, this.localPosition.z);
    if (dist > radius) { this.localPosition.x *= radius / dist; this.localPosition.z *= radius / dist; }
    // Six anther collision proxies with visible passageways between them.
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3, x = Math.sin(angle) * f.radius * .29, z = Math.cos(angle) * f.radius * .29;
      const dx = this.localPosition.x - x, dz = this.localPosition.z - z, d = Math.hypot(dx, dz);
      if (d < .065 && d > .0001) { this.localPosition.x = x + dx / d * .065; this.localPosition.z = z + dz / d * .065; }
    }
    this.localPosition.y = surfaceHeight(f.species, this.localPosition.x, this.localPosition.z, f.radius) + .29;
    this.position.copy(this.localPosition).applyQuaternion(f.rotation).add(f.center);
    this.velocity.subVectors(this.localPosition, this.localPrevious).divideScalar(dt);
    // Only intentional movement across the flower counts. Sway, surface height
    // changes, and pushing against a blocked edge cannot harvest pollen.
    this.crawlDistance = a || b ? Math.hypot(this.localPosition.x - this.localPrevious.x, this.localPosition.z - this.localPrevious.z) : 0;
  }
  private updateAppetite(): void {
    // Hysteresis keeps tiny resting costs from repeatedly unrolling the tongue.
    const wasSatiated = this.satiated;
    if (this.nectar >= NECTAR_CAPACITY - 1e-6 && this.energy >= 99.5) this.satiated = true;
    else if (this.nectar < NECTAR_CAPACITY - .5 || this.energy < 99) this.satiated = false;
    if (this.satiated && !wasSatiated && this.phase === 'landed') this.notify('All topped up. Leave the nectar for another bee.', 3);
  }
  private forage(dt: number): void {
    const f = this.landed!;
    const supply = this.supplies.get(f.id)!;
    const radial = Math.hypot(this.localPosition.x, this.localPosition.z) / f.radius;
    // Walk through the central anthers, allowing a little reach for the legs.
    // The outer landing petals and a stationary bee leave supplies untouched.
    const pollenReach = f.species === 'poppy' ? .43 : .39;
    const storedRoom = Math.max(0, POLLEN_GOAL - this.pollen) / POLLEN_YIELD;
    const coatRoom = Math.max(0, 1 - (this.loose[f.species] || 0)) / .022;
    if (radial < pollenReach && this.crawlDistance > .00001 && supply.pollen > 0 && Math.max(storedRoom, coatRoom) > 0) {
      const walkingTime = Math.min(dt, this.crawlDistance / .36);
      // Contact coats the legs even when the hive's storage pouch is full.
      // Stop taking pollen only when neither the pouch nor the coat needs more.
      const amount = Math.min(supply.pollen, walkingTime * (f.species === 'poppy' ? 9 : 6), Math.max(storedRoom, coatRoom));
      this.pollen = Math.min(POLLEN_GOAL, this.pollen + Math.min(amount, storedRoom) * POLLEN_YIELD); supply.pollen -= amount;
      f.pollenFraction = supply.pollen / POLLEN_SUPPLY[f.species];
      this.particleAmount += amount;
      if (this.particleAmount >= .28) { this.pollenFX.emit(f.center, f.radius); this.particleAmount -= .28; }
      this.loose[f.species] = Math.min(1, (this.loose[f.species] || 0) + amount * .022);
      if (this.pollenOrder[0] !== f.species) {
        const prior = this.pollenOrder.indexOf(f.species);
        if (prior !== -1) this.pollenOrder.splice(prior, 1);
        this.pollenOrder.unshift(f.species);
      }
      this.pollenChime += amount;
      if (this.pollenChime > 8) { this.audio.chime('pollen'); this.pollenChime = 0; }
    }
    this.updateNectarTarget(f);
    this.camera.getWorldDirection(this.forward);
    this.temp.subVectors(this.nectarTarget, this.position);
    const reach = this.temp.length();
    this.canDrink = !this.satiated && f.species !== 'poppy' && supply.nectar > .01 && reach < f.radius * .95 + .20 && this.temp.normalize().dot(this.forward) > .92;
    if (this.canDrink && (this.keys.has('KeyF') || this.mouseDown) && this.landingAge > .3) {
      this.drinking = true;
      // Some of the sip feeds the bee; the remainder is stored for the hive.
      // Full cargo must not block feeding or waste the flower's unused nectar.
      const appetite = Math.min(100 - this.energy, dt * SIP_ENERGY_RATE) / ENERGY_PER_NECTAR;
      const amount = Math.min(supply.nectar, dt * 9, (NECTAR_CAPACITY - this.nectar + appetite) / NECTAR_YIELD);
      const harvest = amount * NECTAR_YIELD;
      const eaten = Math.min(harvest, appetite);
      this.energy = Math.min(100, this.energy + eaten * ENERGY_PER_NECTAR);
      this.nectar = Math.min(NECTAR_CAPACITY, this.nectar + (harvest - eaten));
      supply.nectar = Math.max(0, supply.nectar - amount);
      this.updateAppetite();
      if (this.satiated) { this.drinking = false; this.canDrink = false; }
      this.drinkChime += amount;
      if (this.drinkChime > 9) { this.audio.chime('nectar'); this.drinkChime = 0; }
    }
  }
  private tryLand(): void {
    if (this.landingAssist || this.shelterAssist) return;
    // Key presses may arrive between rendered frames; recheck the current
    // pose instead of using the last frame's aiming target and readiness.
    this.updateTarget();
    if (this.shelterTarget && this.canLand) { this.approachLeaf(this.shelterTarget); return; }
    if (!this.canLand && this.grassCover > .99 && this.takeoffCooldown <= 0) { this.landOnGround(); return; }
    if (!this.target || !this.canLand) { this.notify(this.landingHint); return; }
    const f = this.target;
    // Feet already within reach can catch the petals immediately. Earlier E
    // presses get a short, moving-flower-relative approach instead of a teleport.
    if (this.position.distanceTo(f.center) < f.radius + .8 && this.landingLocal.y <= 1.25) { this.land(f); return; }
    this.landingAssist = f;
    this.landingStart.copy(this.position); this.landingElapsed = 0;
    this.landingYaw = this.yaw; this.landingPitch = this.pitch;
    this.landingPerch.copy(this.landingLocal); this.landingPerch.y = 0;
    if (this.landingPerch.lengthSq() < .01) this.landingPerch.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.landingPerch.normalize().multiplyScalar(f.radius * .57);
    this.landingPerch.y = surfaceHeight(f.species, this.landingPerch.x, this.landingPerch.z, f.radius) + .29;
    this.landingDestination.copy(this.landingPerch).applyQuaternion(f.rotation).add(f.center);
    this.landingDuration = THREE.MathUtils.clamp(this.position.distanceTo(this.landingDestination) / 3, .55, 1.1);
    this.notify('Settling onto the flower · Space to cancel', 2);
  }
  private settleOntoFlower(dt: number): void {
    const f = this.landingAssist!;
    this.landingElapsed += dt;
    const t = Math.min(1, this.landingElapsed / this.landingDuration), ease = t * t * (3 - 2 * t);
    this.landingDestination.copy(this.landingPerch).applyQuaternion(f.rotation).add(f.center);
    this.position.lerpVectors(this.landingStart, this.landingDestination, ease);
    this.position.y += Math.sin(Math.PI * t) * .22;
    this.velocity.subVectors(this.position, this.previousPosition).divideScalar(dt);
    const facing = Math.atan2(this.landingDestination.x - f.center.x, this.landingDestination.z - f.center.z);
    const turn = Math.atan2(Math.sin(facing - this.landingYaw), Math.cos(facing - this.landingYaw));
    this.yaw = this.landingYaw + turn * ease;
    this.pitch = THREE.MathUtils.lerp(this.landingPitch, -.4, ease);
    this.flightMode = 'steady'; this.flightEffort = this.temp.subVectors(this.velocity, this.wind).length();
    if (t >= 1) this.land(f);
  }
  private land(f: Flower): void {
    this.clearShelter();
    this.stopRest();
    this.landingAssist = null;
    this.landed = f; this.phase = 'landed'; this.landingAge = 0;
    this.temp.subVectors(this.position, f.center).applyQuaternion(f.rotation.clone().invert()); this.temp.y = 0;
    if (this.temp.lengthSq() < .01) this.temp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.temp.normalize().multiplyScalar(f.radius * .57); this.localPosition.copy(this.temp);
    this.localPosition.y = surfaceHeight(f.species, this.temp.x, this.temp.z, f.radius) + .29;
    this.position.copy(this.localPosition).applyQuaternion(f.rotation).add(f.center); this.previousPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = Math.atan2(this.position.x - f.center.x, this.position.z - f.center.z);
    this.pitch = -.40;
    const supply = this.supplies.get(f.id)!;
    f.visited = true;
    if (!supply.visited) { supply.visited = true; this.visited++; }
    const prior = this.previousFlowerBySpecies[f.species];
    if (prior !== undefined && prior !== f.id && (this.loose[f.species] || 0) > .01) {
      this.loose[f.species] = 0;
      this.pollenOrder = this.pollenOrder.filter(species => species !== f.species);
      if (!supply.pollinated) {
        supply.pollinated = true; this.pollinated++; this.pollinatedBySpecies[f.species]++; this.audio.chime('pollinate');
        this.pollinationSpecies = f.species; this.pollinationUntil = this.time + 5;
        this.pollinationFX.emit(f, this.position);
      }
      this.notify('Pollen delivered. A little life carried onward.', 3);
    } else {
      this.audio.chime('land');
      this.notify(this.satiated ? 'All topped up. Walk through the center for pollen.' : f.species === 'poppy' ? 'A pollen feast. Crawl toward the dark anthers; poppies offer almost no nectar.' : 'Your feet have found a petal. Crawl with WASD; aim at the golden nectar and hold F.', 6);
    }
    this.previousFlowerBySpecies[f.species] = f.id;
  }
  private takeoff(): void {
    if (this.onGround) {
      this.stopRest(); this.clearShelter(); this.phase = 'flying'; this.position.y += .12;
      this.previousPosition.copy(this.position); this.velocity.set(0, .9, 0);
      this.pitch = Math.max(this.pitch, -.12); this.takeoffCooldown = .5;
      this.notify('Wings open · Hold Space to rise above the grass', 3);
      return;
    }
    const perch = this.landed || this.underLeaf || this.onLeaf;
    if (!perch) return;
    this.stopRest();
    this.phase = 'flying'; this.position.y += this.underLeaf ? .06 : .3; this.previousPosition.copy(this.position); this.velocity.copy(this.onLeaf ? this.onLeaf.topVelocity : perch.velocity); this.velocity.y += this.underLeaf ? .3 : .7;
    if (this.underLeaf) { this.velocity.x -= Math.sin(this.yaw) * 2; this.velocity.z -= Math.cos(this.yaw) * 2; }
    this.landed = null; this.clearShelter(); this.canDrink = false; this.drinking = false;
    this.pitch = Math.max(this.pitch, -.12); this.takeoffCooldown = .8;
    this.notify('Wings open. Find another flower, or check your way home.', 3);
  }
  private approachLeaf(leaf: LeafShelter): void {
    this.stopRest(); this.shelterAssist = leaf; this.landingAssist = null;
    this.shelterAssistTop = !this.needsLeafShelter();
    this.inverseFlower.copy(leaf.rotation).invert();
    this.landingStart.subVectors(this.position, leaf.center).applyQuaternion(this.inverseFlower); this.landingElapsed = 0;
    this.landingYaw = this.yaw; this.landingPitch = this.pitch;
    const startSurface = leafSurfaceHeight(this.landingStart.x, this.landingStart.z);
    this.shelterAroundEdge = this.shelterAssistTop ? this.landingStart.y < startSurface : this.landingStart.y > startSurface;
    this.landingPerch.copy(this.landingStart); this.landingPerch.y = 0;
    if (this.landingPerch.lengthSq() < .01) this.landingPerch.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.landingPerch.normalize().multiplyScalar(leaf.radius + .7);
    const destination = this.shelterAssistTop ? leaf.topPerch : leaf.perch;
    this.landingDuration = this.shelterAroundEdge ? 1.8 : THREE.MathUtils.clamp(this.position.distanceTo(destination) / 3, .5, 1.1);
    this.drinking = false; this.canDrink = false;
    this.notify(this.shelterAssistTop ? 'Settling on the leaf · Space to cancel' : 'Tucking beneath the leaf · Space to cancel', 3);
  }
  private settleOnLeaf(dt: number): void {
    const leaf = this.shelterAssist!;
    this.landingElapsed += dt;
    const t = Math.min(1, this.landingElapsed / this.landingDuration);
    const destination = this.shelterAssistTop ? leaf.topPerch : leaf.perch;
    this.temp.subVectors(destination, leaf.center).applyQuaternion(this.inverseFlower.copy(leaf.rotation).invert());
    // All three segments use the leaf's moving local frame. Cross to the other
    // side outside the pointed rim, then come back in without passing through it.
    if (this.shelterAroundEdge) {
      const nearHeight = this.shelterAssistTop ? Math.min(this.landingStart.y, -.62) : Math.max(this.landingStart.y, .65);
      if (t < .35) {
        this.landingDestination.copy(this.landingPerch); this.landingDestination.y = nearHeight;
        this.position.lerpVectors(this.landingStart, this.landingDestination, THREE.MathUtils.smoothstep(t, 0, .35));
      } else if (t < .65) {
        this.position.copy(this.landingPerch);
        this.position.y = THREE.MathUtils.lerp(nearHeight, this.temp.y, THREE.MathUtils.smoothstep(t, .35, .65));
      } else {
        this.landingDestination.copy(this.landingPerch); this.landingDestination.y = this.temp.y;
        this.position.lerpVectors(this.landingDestination, this.temp, THREE.MathUtils.smoothstep(t, .65, 1));
      }
    } else this.position.lerpVectors(this.landingStart, this.temp, THREE.MathUtils.smoothstep(t, 0, 1));
    this.position.applyQuaternion(leaf.rotation).add(leaf.center);
    this.pitch = THREE.MathUtils.lerp(this.landingPitch, this.shelterAssistTop ? -.32 : -.06, THREE.MathUtils.smoothstep(t, 0, 1));
    this.velocity.subVectors(this.position, this.previousPosition).divideScalar(dt);
    this.flightMode = 'steady'; this.flightEffort = 0;
    if (t >= 1) {
      this.onLeaf = this.shelterAssistTop ? leaf : null;
      this.underLeaf = this.shelterAssistTop ? null : leaf;
      this.shelterAssist = null; this.shelterTarget = null;
      this.phase = 'landed'; this.landed = null; this.target = null; this.canLand = false;
      this.position.copy(destination); this.previousPosition.copy(this.position); this.velocity.set(0, 0, 0);
      this.landingAge = 0; this.clearInput(); this.audio.chime('land');
      this.notify(this.onLeaf ? (this.weather.rain > .05 ? 'Rain on the leaf · E to tuck underneath' : 'A leafy perch · E to rest · Space to fly') : 'Shelter beneath a leaf. E to rest; Space to fly out.', 5);
    }
  }
  private homeCost(): number {
    // The player now pays for the meadow crossing through ordinary flight.
    // Reserve only the short offscreen leg beyond the edge, charged once.
    return HOME_RETURN_FUEL;
  }
  private harvestReady(): boolean { return this.nectar - this.homeCost() >= NECTAR_GOAL && this.pollen >= POLLEN_GOAL && this.energy > 0; }
  private atHomeEdge(): boolean { return this.position.z >= HOME_EXIT.z && Math.abs(this.position.x - HOME_EXIT.x) <= HOME_EXIT_HALF_WIDTH && this.position.y >= 2; }
  /** Enough nectar for the short flight beyond the meadow edge. */
  private canHeadHome(): boolean { return this.nectar >= this.homeCost() && this.energy > 0; }
  // The bee may go home at any time with what it carries. Arriving at the edge
  // ends the day by itself once the harvest goal is met; before that, only
  // after the player has chosen to head home (R), so the edge isn't a trap.
  private canReturn(): boolean { return this.phase === 'flying' && !this.landingAssist && !this.shelterAssist && this.atHomeEdge() && this.canHeadHome() && (this.harvestReady() || this.headingHome); }
  private returnHome(): void {
    if (this.phase !== 'flying' && this.phase !== 'landed') return;
    if (!this.canHeadHome()) { this.notify(`You need ${HOME_RETURN_FUEL} nectar in your jar for the flight home.`, 5); return; }
    if (!this.harvestReady() && !this.headingHome) {
      this.headingHome = true;
      if (!this.atHomeEdge()) {
        this.notify('Heading home early · Follow the hive marker. The hive gets whatever you carry.', 6);
        this.canvas.focus({ preventScroll: true });
        return;
      }
    }
    if (!this.canReturn()) {
      this.notify(this.position.z >= HOME_EXIT.z - 3 && Math.abs(this.position.x) <= HOME_EXIT_HALF_WIDTH && this.position.y < 2 ? 'Hold Space to rise above the grass and fly home.' : 'Follow the hive marker to the meadow edge. Fly there to finish your day.', 6);
      this.canvas.focus({ preventScroll: true });
      return;
    }
    this.returnFuel = this.homeCost(); this.returnDayStart = this.dayProgress(); this.homecoming.begin(this.camera);
    this.quietAge = 0; this.restView.reset();
    this.audio.chime('win');
    this.latchClosingKeys();
    this.stopRest(); this.clearShelter(); this.phase = 'returning'; this.landed = null; this.landingAssist = null; this.returnAge = 0; this.drinking = false; this.uv = false; this.clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  private finishReturn(): void {
    if (this.phase !== 'returning') return;
    this.returnAge = this.reducedMotion ? QUIET_ENDING_DURATION : ENDING_DURATION;
    this.homecoming.pose(this.returnAge, this.time, this.reducedMotion, this.camera);
    this.nectar = Math.max(0, this.nectar - this.returnFuel);
    this.phase = 'won'; this.clearInput();
    this.report = dayReport({ nectar: this.nectar, pollen: this.pollen, pollinatedBySpecies: this.pollinatedBySpecies, visited: this.visited, flowerTotal: this.supplies.size });
    this.resultScore = Math.round(this.nectar * 12 + this.pollen * 15 + this.pollinated * 80 + Math.max(0, 300 - this.elapsed));
  }
  private dayProgress(): number {
    if (this.phase === 'won') return 1;
    if (this.phase === 'returning' || this.phase === 'paused' && this.resumePhase === 'returning') {
      const t = THREE.MathUtils.smoothstep(this.returnAge / (this.reducedMotion ? QUIET_ENDING_DURATION : ENDING_DURATION), 0, 1);
      return THREE.MathUtils.lerp(this.returnDayStart, 1, t);
    }
    return Math.min(1, this.dayElapsed / DAY_DURATION);
  }
  private updateWorld(time: number): void {
    const cinematic = this.phase === 'returning' || this.phase === 'won' || this.phase === 'paused' && this.resumePhase === 'returning';
    if (cinematic) this.homecoming.pose(this.returnAge, time, this.reducedMotion, this.camera);
    const elevated = cinematic || this.restView.active;
    this.meadow.update(time, elevated ? this.camera.position : this.position, this.uv, this.loose);
    this.leafShelters.update(time, elevated ? this.camera.position : this.position);
    if (this.landed) this.position.copy(this.localPosition).applyQuaternion(this.landed.rotation).add(this.landed.center);
    if (this.underLeaf) this.position.copy(this.underLeaf.perch);
    if (this.onLeaf) this.position.copy(this.onLeaf.topPerch);
    if (this.onGround) this.position.y = this.groundAltitude();
    this.sampleWeather();
    this.atmosphere.update(time, elevated ? this.camera.position : this.position, this.uv, this.dayProgress(), this.weather.cloudiness);
  }
  private updateNectarTarget(f: Flower): void { this.nectarTarget.set(0, .15, 0).applyQuaternion(f.rotation).add(f.center); }
  private updateView(dt: number): void {
    const cinematic = this.phase === 'returning' || this.phase === 'won' || this.phase === 'paused' && this.resumePhase === 'returning';
    const closing = this.phase === 'failing' || this.phase === 'lost' || this.phase === 'paused' && this.resumePhase === 'failing';
    flightWindAt(this.position.x, this.position.y, this.position.z, this.time, this.wind);
    if (this.phase === 'title') {
      this.camera.position.set(1.8 + Math.sin(this.time * .04) * .6, 4.6 + Math.sin(this.time * .16) * .08, 5.8);
      this.camera.lookAt(0, 3.35, -5.5);
    } else if (!cinematic) {
      this.camera.position.copy(this.position);
      if (!this.reducedMotion && (this.caughtWeb || this.webShake > 0)) {
        // Tangled: a small constant tremble, jolting with each tug.
        const shake = (this.caughtWeb ? .004 : 0) + this.webShake * .014;
        this.camera.position.x += Math.sin(this.time * 47) * shake;
        this.camera.position.y += Math.sin(this.time * 39 + 1) * shake;
      }
      if (!this.reducedMotion && this.phase === 'flying') this.camera.position.y += Math.sin(this.time * 7.2) * .008 - this.heavyStrain * .035;
      const sideSpeed = this.velocity.x * Math.cos(this.yaw) - this.velocity.z * Math.sin(this.yaw);
      this.lookRoll = THREE.MathUtils.damp(this.lookRoll, this.reducedMotion || this.phase !== 'flying' ? 0 : THREE.MathUtils.clamp(-sideSpeed * .015 + (this.loadSway + this.heavyWobble) * .06 + this.heavyKick * .03, -.075, .075), 5, this.pausedCapture || this.phase === 'paused' ? 0 : dt);
      this.camera.rotation.set(this.pitch, this.yaw, this.lookRoll, 'YXZ');
      if (closing && !this.reducedMotion && !this.lossFromNight) {
        const settle = THREE.MathUtils.smoothstep(this.lossProgress(), 0, 1);
        this.camera.position.y -= settle * .06;
        this.camera.rotation.x -= settle * .16;
        this.camera.rotation.z += settle * .025;
      }
    }
    const fov = this.phase === 'landed' || this.phase === 'learning' ? 66 : 61 + Math.min(3, this.velocity.length() * .7);
    if (!cinematic && !closing && !this.pausedCapture && this.phase !== 'paused' && Math.abs(this.camera.fov - fov) > .02) { this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fov, 5, dt); this.camera.updateProjectionMatrix(); }
    if (!cinematic && !closing) this.restView.pose(this.camera, this.reducedMotion);
    // Hide the little third-person body near the perch so the returning camera
    // cannot pass through it before the first-person forelegs reappear.
    if (!cinematic) this.homecoming.scenery(this.time, this.reducedMotion, this.restView.amount > .01, this.weather.cloudiness < .2 && this.weather.rain < .01, this.restView.amount > .2 ? this.position : undefined);
    this.camera.updateMatrixWorld(true);
    this.updateTarget();
    const target = this.landed || this.target;
    if (this.landed) this.updateNectarTarget(this.landed);
    const hasNectar = !!this.landed && this.landed.species !== 'poppy' && this.supplies.get(this.landed.id)!.nectar > .01;
    this.nectarDrop.pose(this.landed?.id ?? -1, this.nectarTarget, this.landed?.rotation ?? this.scene.quaternion, this.reducedMotion ? 0 : this.time, hasNectar, this.uv);
    const active = this.phase === 'flying' || this.phase === 'landed';
    const nightClose = closing && this.lossFromNight ? Math.max(.0001, this.lossProgress()) : 0;
    this.energyWash.update(!cinematic && (active || closing || this.phase === 'paused') ? Math.max(this.coldVignette(), THREE.MathUtils.smoothstep(this.heat, .08, .9) * .9) : 0, this.camera.aspect, THREE.MathUtils.smoothstep(this.heat - this.chill, 0, .08), nightClose);
    this.rainFX.update(this.reducedMotion ? 0 : this.time, this.camera, this.weather.rain, this.wind, this.rainCover, this.reducedMotion, !cinematic && (active || this.phase === 'failing' || this.phase === 'paused'), this.grassCover);
    // Leaves wet quickly with the rain and dry over about half a minute.
    { const wetTarget = this.weather.rain, rate = wetTarget > this.leafWet ? 1.2 : .08;
      this.leafWet += (wetTarget - this.leafWet) * (1 - Math.exp(-rate * Math.max(0, dt)));
      leafUniforms.uLeafWet.value = this.leafWet; }
    this.flowerRain.update(this.time, this.camera.position, this.weather.rain, this.reducedMotion, !cinematic && (active || this.phase === 'failing' || this.phase === 'paused'));
    // Webs sparkle with morning dew and after rain; dry, they are faint threads.
    { const morningDew = 1 - THREE.MathUtils.smoothstep(this.dayProgress(), .05, .22);
      this.webs.update(Math.max(morningDew * .35, this.leafWet), 1 - this.weather.cloudiness, this.uv); }
    this.windFX.update((active || this.phase === 'title') && !this.pausedCapture ? dt : 0, this.time, this.position, this.camera, this.reducedMotion, !cinematic && !closing && !this.restView.active && (active || this.phase === 'paused' || this.phase === 'title'));
    this.pollenFX.update(active && !this.pausedCapture ? dt : 0, this.position);
    this.pollinationFX.update(active && !this.pausedCapture ? dt : 0, !cinematic && !closing && (active || this.phase === 'paused'), this.reducedMotion);
    this.temp.copy(this.nectarTarget).applyMatrix4(this.camera.matrixWorldInverse);
    this.nectarBend.set(0, .05, 0).applyQuaternion(this.landed?.rotation ?? this.scene.quaternion).add(this.nectarTarget);
    this.tongueApproach.subVectors(this.position, this.nectarTarget).normalize();
    this.nectarBend.addScaledVector(this.tongueApproach, .015).applyMatrix4(this.camera.matrixWorldInverse);
    if (this.reducedMotion) this.bee.snapPose(closing || this.onGround || !!(this.landed || this.underLeaf || this.onLeaf), this.drinking);
    this.bee.update(this.reducedMotion ? 0 : this.time, closing || this.onGround || !!(this.landed || this.underLeaf || this.onLeaf), this.drinking, this.phase !== 'title' && this.phase !== 'won' && this.restView.amount < .01 && (!cinematic || this.homecoming.firstPerson), this.pausedCapture || this.phase === 'paused' ? 0 : dt, this.temp, this.loose, this.satiated || this.resting || !!this.underLeaf || !!this.onLeaf || this.onGround || closing, this.nectarBend, this.pollenOrder[0]);
    this.bee.writeTongueContact(this.tongueTip, this.tongueApproach);
    const touchingNectar = this.nectarDrop.update(active && !this.pausedCapture ? dt : 0, this.tongueTip, this.tongueApproach, this.drinking, this.reducedMotion);
    this.audio.update(this.phase === 'flying', this.flightEffort, Math.min(1.5, this.wind.length() / 2), touchingNectar, !(active || this.phase === 'returning' || this.phase === 'failing') || this.pausedCapture,
      cinematic ? { meadow: this.homecoming.firstPerson ? .1 : 1, home: this.homecoming.firstPerson ? 1 : 0, fade: this.homecoming.stage === 'fade' ? this.homecoming.fade : 0 } : this.restView.active && this.weather.cloudiness < .2 && this.weather.rain < .01 ? { meadow: this.restView.amount * .65, home: 0, fade: 0 } : undefined,
      { rain: this.weather.rain, underLeaf: !!this.rainCover || this.grassCover > .99, leafTop: this.leafTopNearness() }, closing ? this.lossProgress() : undefined, this.phase === 'flying' ? this.heavyStrain : 0);
    let targetVisible = false, x = .5, y = .5;
    if (target || this.shelterTarget) {
      this.projected.copy(this.shelterTarget ? this.shelterTarget.center : this.landed ? this.nectarTarget : target!.center).project(this.camera);
      x = this.projected.x * .5 + .5; y = -.5 * this.projected.y + .5;
      targetVisible = this.projected.z < 1 && this.projected.z > -1 && x > .02 && x < .98 && y > .02 && y < .98;
    }
    const supply = target ? this.supplies.get(target.id)! : null;
    const shelter = this.underLeaf || this.onLeaf || this.nearestShelter();
    const distance = Math.hypot(this.position.x - HOME_EXIT.x, this.position.z - HOME_EXIT.z), homeCost = this.homeCost(), canReturn = this.canReturn(), harvestReady = this.harvestReady();
    this.projected.copy(HOME_EXIT).project(this.camera);
    const homeX = this.projected.x * .5 + .5, homeY = -this.projected.y * .5 + .5;
    const homeVisible = this.projected.z > -1 && this.projected.z < 1 && homeX > .12 && homeX < .84 && homeY > .12 && homeY < .8;
    const edgeGust = edgeExposureAt(this.position.x, this.position.z) > .25;
    let hint = this.flightMode === 'steady' ? 'Holding against the wind · Release Shift to drift' : 'Arrow keys look · W flies where you look · Space rises';
    if (this.phase === 'landed') {
      hint = this.satiated ? 'Energy and nectar full · Walk through pollen, or Space to fly' : this.drinking ? (this.energy < 99.5 ? 'Sipping nectar · Restoring energy…' : 'Sipping nectar…') : target?.species === 'poppy' ? 'Walk through the anthers to collect pollen · Space take off' : supply && supply.nectar < .1 ? 'Nectar gathered · Walk through pollen, or Space to fly' : this.canDrink ? (this.energy < 99.5 ? 'Hold F to restore energy · Walk through the center for pollen' : 'Hold F to sip nectar · Walk through the center for pollen') : 'Walk toward the center for pollen · Aim at the golden nectar to sip';
    } else if (this.canLand) hint = this.shelterTarget ? (!this.needsLeafShelter() ? 'E · Land on the broad leaf' : 'E · Tuck beneath the broad leaf') : this.uv && supply?.visited ? 'Already visited · E to revisit' : `E · Land on ${NAMES[this.target!.species].toLowerCase()}`;
    else if (this.target && this.position.distanceTo(this.target.center) < 3.5) hint = this.landingHint;
    if (edgeGust && this.phase === 'flying') hint = 'An outer gust is carrying you back toward the flowers';
    if (harvestReady && this.phase === 'flying' && !this.canLand && !edgeGust) hint = 'A good day’s work · You’re hauling a lot! Follow the hive marker home';
    else if (this.headingHome && this.phase === 'flying' && !this.canLand && !edgeGust) hint = this.canHeadHome() ? 'Heading home early · Follow the hive marker' : `Heading home · You need ${HOME_RETURN_FUEL} nectar for the flight`;
    if (this.landingAssist) hint = 'Settling onto the flower · Space to cancel';
    if (this.underLeaf) hint = this.weather.rain > .05 ? 'Shelter beneath a leaf · E to rest through the shower · Space to fly out' : 'Shelter beneath a leaf · E to rest · Space to fly out';
    if (this.onLeaf) hint = this.needsLeafShelter() ? (this.weather.rain > .05 ? 'Rain falls on the leaf · E to tuck underneath' : 'Hot sun on the leaf · E to tuck into shade') : 'A leafy perch · E to rest · Space to fly';
    if (this.shelterAssist) hint = this.shelterAssistTop ? 'Settling on the leaf · Space to cancel' : 'Tucking beneath the leaf · Space to cancel';
    if (this.resting) hint = this.nectar > 0 && this.energy < 99.5 ? 'A little stored nectar restores your energy · E to wake' : this.nectar <= 0 && this.energy < 99.5 ? 'Rest saves energy; nectar restores it · E to wake' : 'Watch the sunlight move · E to wake';
    if (this.resting && this.underLeaf && this.weather.rain > .05) hint = 'Safe and dry while the shower passes · E to wake';
    if (this.onGround) hint = this.resting ? 'Resting in sheltered grass · Nectar restores energy · E to wake' : 'Sheltered among the grass · E to rest · Space to fly · WASD to walk';
    else if (this.phase === 'flying' && this.grassCover > .99 && !this.canLand) hint = 'Low grass offers shelter and shade · Settle down to rest · Space to rise';
    if (this.caughtWeb) hint = 'Caught in a web · Tap Space or W to pull free';
    if (this.heat > .18 && this.shade > .99) hint = 'Cooling in the shade · E to rest · Space to fly when ready';
    const view: ViewState = {
      reducedMotion: this.reducedMotion, dayProgress: this.dayProgress(), resting: this.resting, restProgress: this.restAge / REST_DURATION, endingStage: this.homecoming.stage, endingFade: this.homecoming.fade,
      quietFade: active ? this.quietFade() : 0, scenicFade: active ? this.restView.fade(this.reducedMotion) : 0, scenicAmount: active ? this.restView.amount : 0,
      underLeaf: !!this.underLeaf, onLeaf: !!this.onLeaf, leafTopTarget: this.shelterAssist ? this.shelterAssistTop : !!this.onLeaf || !!this.shelterTarget && !this.needsLeafShelter(), onGround: this.onGround, grassCover: this.grassCover, shelterTarget: !!(this.shelterTarget || this.shelterAssist),
      shelterDistance: shelter ? this.position.distanceTo(shelter.perch) * .1 : 0,
      shelterBearing: shelter ? this.yaw - Math.atan2(-(shelter.perch.x - this.position.x), -(shelter.perch.z - this.position.z)) : 0,
      weatherStage: this.weather.stage, rain: this.weather.rain, cloudiness: this.weather.cloudiness, rainExposure: this.rainExposure,
      heat: this.heat, sunHeat: this.weather.sunHeat, gale: this.weather.gale, heatExposure: this.heatExposure, shaded: this.shade > .99, needsShade: this.needsShade(),
      cold: this.coldVignette(), chilled: this.chill > .1, lossProgress: this.lossProgress(), lossFromRain: this.lossFromRain, lossFromHeat: this.lossFromHeat, lossFromNight: this.lossFromNight,
      phase: this.phase, energy: this.energy, nectar: this.nectar, pollen: this.pollen, nectarGoal: NECTAR_GOAL, nectarCapacity: NECTAR_CAPACITY, pollenGoal: POLLEN_GOAL, autoFeeding: (this.autoFeeding || this.resting && this.nectar > 0 && this.energy < 99.5) && !this.drinking && active,
      homeCost, homeDistance: distance * .1, homeBearing: this.yaw - Math.atan2(-(HOME_EXIT.x - this.position.x), -(HOME_EXIT.z - this.position.z)),
      homeX, homeY, homeVisible, harvestReady, headingHome: this.headingHome, canHeadHome: this.canHeadHome(), dayNumber: this.dayNumber,
      canReturn,
      wind: this.wind.length(), windBearing: this.yaw - Math.atan2(-this.wind.x, -this.wind.z), flightMode: this.flightMode, sheltered: !!this.underLeaf || this.position.y < 3.7, edgeGust,
      speed: this.velocity.length(), load: this.load(), uv: this.uv, muted: this.audio.muted,
      flowerName: target ? NAMES[target.species] : '', flowerSpecies: target?.species ?? null, flowerNectar: (supply?.nectar ?? 0) * NECTAR_YIELD, flowerPollen: (supply?.pollen ?? 0) * POLLEN_YIELD,
      targetX: x, targetY: y, targetVisible, canLand: this.canLand, landing: !!(this.landingAssist || this.shelterAssist), canDrink: this.canDrink, drinking: this.drinking, satiated: this.satiated,
      dust: Math.min(1, Object.values(this.loose).reduce((a, b) => a + (b || 0), 0) * .55), pollinated: this.pollinated, visited: this.visited, flowerTotal: this.supplies.size,
      pollinatedBySpecies: this.pollinatedBySpecies,
      carriedPollen: this.loose,
      flowerPollinated: supply?.pollinated ?? false, flowerVisited: supply?.visited ?? false, pollinationSpecies: this.time < this.pollinationUntil ? this.pollinationSpecies : null,
      elapsed: this.elapsed, message: this.noticeUntil > this.time ? this.notice : '', hint, resultScore: this.resultScore,
    };
    this.ui.update(view);
  }
  private updateTarget(): void {
    this.shelterTarget = null;
    if (this.underLeaf || this.onLeaf || this.shelterAssist || this.onGround) { this.target = null; this.canLand = false; return; }
    if (this.landed) { this.target = this.landed; this.canLand = false; return; }
    if (this.landingAssist) { this.target = this.landingAssist; this.canLand = false; return; }
    this.forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    let best: Flower | null = null, bestScore = -Infinity;
    for (const f of this.meadow.flowers) {
      this.temp.subVectors(f.center, this.position); const distance = this.temp.length();
      if (distance > 13) continue;
      const dot = this.temp.normalize().dot(this.forward);
      this.landingLocal.subVectors(this.position, f.center).applyQuaternion(this.inverseFlower.copy(f.rotation).invert());
      const radial = Math.hypot(this.landingLocal.x, this.landingLocal.z);
      const clearance = this.landingLocal.y - surfaceHeight(f.species, this.landingLocal.x, this.landingLocal.z, f.radius);
      // A blossom beneath our feet takes precedence over one farther ahead.
      // Use its tilted local surface, not a cone tied to where we are looking.
      const beneath = radial < f.radius + .15 && clearance >= .05 && clearance < 3.3;
      if (!beneath && dot < .55) continue;
      const score = beneath ? 20 - clearance - radial / f.radius : dot * 5 - distance * .22;
      if (score > bestScore) { best = f; bestScore = score; }
    }
    this.target = best;
    this.canLand = false;
    let leafScore = bestScore;
    for (const leaf of this.leafShelters.shelters) {
      this.temp.subVectors(!this.needsLeafShelter() ? leaf.topPerch : leaf.perch, this.position); const distance = this.temp.length();
      if (distance > 12) continue;
      const dot = this.temp.normalize().dot(this.forward);
      this.landingLocal.subVectors(this.position, leaf.center).applyQuaternion(this.inverseFlower.copy(leaf.rotation).invert());
      const tucked = leafPlanarDistance(this.landingLocal.x, this.landingLocal.z) < leaf.radius * .8 && (!this.needsLeafShelter() ? this.landingLocal.y >= .2 && this.landingLocal.y < 3.2 : this.landingLocal.y < -.2 && this.landingLocal.y > -2);
      if (!tucked && dot < .62) continue;
      const close = distance < leaf.radius + 2.1;
      const score = tucked ? 26 - distance : dot > .94 && close ? 23 - distance * .5 : dot * 5 - distance * .22;
      if (score > leafScore) { leafScore = score; this.shelterTarget = leaf; }
    }
    if (this.shelterTarget) {
      const leaf = this.shelterTarget;
      this.target = null;
      this.landingLocal.subVectors(this.position, leaf.center).applyQuaternion(this.inverseFlower.copy(leaf.rotation).invert());
      this.canLand = this.phase === 'flying' && this.takeoffCooldown <= 0 && this.position.distanceTo(!this.needsLeafShelter() ? leaf.topPerch : leaf.perch) < leaf.radius + 2.1 && this.landingLocal.y > -2.6 && this.landingLocal.y < 3.2;
      this.landingHint = this.takeoffCooldown > 0 ? 'Give your wings a moment after takeoff.' : this.canLand ? (!this.needsLeafShelter() ? 'E · Land on the broad leaf' : 'E · Tuck beneath the broad leaf') : 'Fly closer to the broad leaf, then press E';
      return;
    }
    if (!best) { this.landingHint = 'Move close above a flower, then press E to land.'; return; }
    this.landingLocal.subVectors(this.position, best.center).applyQuaternion(this.inverseFlower.copy(best.rotation).invert());
    const radial = Math.hypot(this.landingLocal.x, this.landingLocal.z);
    const clearance = this.landingLocal.y - surfaceHeight(best.species, this.landingLocal.x, this.landingLocal.z, best.radius);
    const overPetals = radial < best.radius + .15;
    const closeEnough = this.position.distanceTo(best.center) < best.radius + FLOWER_LANDING_REACH && clearance <= FLOWER_LANDING_CLEARANCE;
    if (this.takeoffCooldown > 0) this.landingHint = 'Give your wings a moment after takeoff.';
    else if (clearance < .05) this.landingHint = 'Rise above the petals · Space to climb';
    else if (overPetals && clearance > FLOWER_LANDING_CLEARANCE) this.landingHint = 'Look down at the flower and press W to approach';
    else if (!closeEnough) this.landingHint = 'Look toward the flower and press W to move closer';
    else { this.canLand = this.phase === 'flying'; this.landingHint = `E · Land on ${NAMES[best.species].toLowerCase()}`; }
  }
  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame, elapsed: this.elapsed, score: this.resultScore, targetScore: 1, complete: this.phase === 'won',
      player: { position: { x: this.position.x, y: this.position.y, z: this.position.z }, speed: this.velocity.length() },
      renderer: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures },
      canvas: { clientWidth: this.canvas.clientWidth, clientHeight: this.canvas.clientHeight, width: this.canvas.width, height: this.canvas.height, dpr: this.renderer.getPixelRatio() },
    };
  }
  private installHooks(): void {
    // Inspection and seeded test-state setup are opt-in and excluded from the
    // ordinary player flow. Real-input tests use snapshots only during play.
    if (!import.meta.env.DEV && !new URLSearchParams(location.search).has('test')) return;
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => this.rebuildMeadow(value, EVEN_MIX),
      setState: (name: string) => {
        const states = ['title', 'flight-start', 'active-play', 'windy', 'landed', 'uv', 'pollinated', 'complete', 'failed'];
        if (!states.includes(name)) throw new Error(`Unknown state: ${name}`);
        // Legacy scenarios were written for a full meter; the real opening starts at START_ENERGY.
        this.begin(false); this.energy = 100; this.time = name === 'flight-start' ? 0 : 12;
        if (name === 'windy') { this.time = 26; this.position.set(0, 6.2, 3.5); this.previousPosition.copy(this.position); this.pitch = -.18; }
        if (name === 'title') this.phase = 'title';
        if (name === 'landed' || name === 'uv') { const f = this.meadow.flowers[0]; this.meadow.update(12, this.position, false); this.position.copy(f.center).add(new THREE.Vector3(0, .55, 1)); this.land(f); this.uv = name === 'uv'; }
        if (name === 'pollinated') {
          const f = this.meadow.flowers[3]; this.meadow.update(12, this.position, false);
          this.loose.poppy = .4; this.previousFlowerBySpecies.poppy = 1; this.pollen = 18;
          this.position.copy(f.center).add(new THREE.Vector3(0, .55, 1)); this.land(f);
          this.pollinationFX.update(.65, true, this.reducedMotion);
        }
        if (name === 'complete') { this.phase = 'won'; this.nectar = 55; this.pollen = POLLEN_GOAL; this.pollinated = 2; this.pollinatedBySpecies = { poppy: 1, daisy: 1, cornflower: 0 }; this.visited = 4; this.elapsed = 138; this.resultScore = 1852; }
        if (name === 'failed') { this.energy = 0; this.beginLoss(); this.finishLoss(); }
        this.bee.snapPose(!!this.landed);
        this.windFX.reset(this.position, this.time);
        this.updateWorld(this.reducedMotion ? 0 : this.time); this.updateView(0); this.renderer.render(this.scene, this.camera); this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (value: boolean) => { this.pausedCapture = value; },
      setReducedMotion: (value: boolean) => { this.reducedMotion = value; this.updateWorld(value ? 0 : this.time); this.updateView(0); },
      hideDebugUi: (_value: boolean) => { /* No debug panels in the player interface. */ },
    };
    window.__BEE_TEST__ = {
      snapshot: () => ({ pollenGoal: POLLEN_GOAL, windDrain: this.windDrain, heat: this.heat, heatDrain: this.heatDrain, heatExposure: this.heatExposure, shade: this.shade, needsShade: this.needsShade(), energyWash: this.energyWash.diagnostics(), quietAge: this.quietAge, quietFade: this.quietFade(), restView: this.restView.diagnostics(), onGround: this.onGround, caughtWeb: this.caughtWeb?.id ?? null, webStruggle: this.webStruggle, webs: this.webs.diagnostics(), grassCover: this.grassCover, chill: this.chill, cold: this.coldVignette(), coldDrain: this.coldDrain, lossProgress: this.lossProgress(), lossFromRain: this.lossFromRain, lossFromHeat: this.lossFromHeat, lossFromNight: this.lossFromNight, nightfallChecked: this.nightfallChecked, flowerRain: this.flowerRain.diagnostics(), underLeaf: this.underLeaf?.id, onLeaf: this.onLeaf?.id, leafTopTarget: this.shelterAssist ? this.shelterAssistTop : !!this.onLeaf || !!this.shelterTarget && !this.needsLeafShelter(), shelterTarget: this.shelterTarget?.id, shelterAssist: this.shelterAssist?.id, weather: { ...this.weather }, rainExposure: this.rainExposure, rainEffects: this.rainFX.diagnostics(), resting: this.resting, restAge: this.restAge, dayProgress: this.dayProgress(), dayElapsed: this.dayElapsed, ending: this.homecoming.diagnostics(), returnAge: this.returnAge, returnFuel: this.returnFuel, cameraPosition: this.camera.position.toArray(), cameraQuaternion: this.camera.quaternion.toArray(), phase: this.phase, position: this.position.toArray(), velocity: this.velocity.toArray(), wind: this.wind.toArray(), windTime: this.time, flightMode: this.flightMode, flightEffort: this.flightEffort, loadSway: this.loadSway, heavyWobble: this.heavyWobble, heavyStrain: this.heavyStrain, windEffects: this.windFX.diagnostics(), yaw: this.yaw, pitch: this.pitch, energy: this.energy, nectar: this.nectar, pollen: this.pollen, autoFeeding: this.autoFeeding, satiated: this.satiated, tongue: this.bee.tonguePose(), nectarSurface: this.nectarDrop.diagnostics(), audio: this.audio.diagnostics(), crawlDistance: this.crawlDistance, canLand: this.canLand, canDrink: this.canDrink, drinking: this.drinking, landed: this.landed?.id, landingAssist: this.landingAssist?.id, target: this.target?.id, elapsed: this.elapsed, homeCost: this.homeCost(), canReturn: this.canReturn(), harvestReady: this.harvestReady(), headingHome: this.headingHome, dayNumber: this.dayNumber, report: this.report, atHomeEdge: this.atHomeEdge(), homeExit: HOME_EXIT.toArray(), homeDistance: Math.hypot(this.position.x - HOME_EXIT.x, this.position.z - HOME_EXIT.z) * .1, visited: this.visited, pollinated: this.pollinated, carriedPollen: { ...this.loose }, recentPollen: this.pollenOrder[0] ?? null, forelegPollen: this.bee.pollenCount(), forelegPollenColors: this.bee.pollenColors(), forelegCurl: this.bee.curlAmount(), resultScore: this.resultScore, load: this.load(), localPosition: this.localPosition.toArray(), frameMs: this.frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.frameTimes.length), supplies: Array.from(this.supplies.entries()), diagnostics: window.__THREE_GAME_DIAGNOSTICS__ }),
      setPose: (p, yaw = 0, pitch = -.35, velocity = [0, 0, 0]) => { this.stopRest(); this.clearShelter(); this.landed = null; this.landingAssist = null; this.phase = 'flying'; this.position.fromArray(p); this.previousPosition.copy(this.position); this.yaw = yaw; this.pitch = pitch; this.velocity.fromArray(velocity); },
      approachFlower: (id: number) => { const f = this.meadow.flowers.find(f => f.id === id); if (!f) throw new Error('Unknown flower'); this.stopRest(); this.clearShelter(); this.landed = null; this.landingAssist = null; this.phase = 'flying'; this.position.copy(f.center).add(new THREE.Vector3(0, .55, f.radius + .5)); this.previousPosition.copy(this.position); this.yaw = 0; this.pitch = -.32; this.velocity.set(0,0,0); this.takeoffCooldown = 0; },
      shelters: () => this.leafShelters.shelters.map(leaf => ({ id: leaf.id, center: leaf.center.toArray(), perch: leaf.perch.toArray(), topPerch: leaf.topPerch.toArray(), rotation: leaf.rotation.toArray(), root: leaf.root.toArray(), radius: leaf.radius })),
      approachShelter: id => { const leaf = this.leafShelters.shelters.find(leaf => leaf.id === id); if (!leaf) throw new Error('Unknown shelter'); this.stopRest(); this.clearShelter(); this.landed = null; this.landingAssist = null; this.phase = 'flying'; this.position.copy(leaf.perch).add(new THREE.Vector3(0, -.1, leaf.radius + 1.1)); this.previousPosition.copy(this.position); this.yaw = 0; this.pitch = .03; this.velocity.set(0, 0, 0); this.takeoffCooldown = 0; },
      setPollination: counts => { this.pollinatedBySpecies = { poppy: counts.poppy ?? 0, daisy: counts.daisy ?? 0, cornflower: counts.cornflower ?? 0 }; this.pollinated = Object.values(this.pollinatedBySpecies).reduce((a, b) => a + b, 0); },
      setCargo: (nectar, pollen, energy = 100) => { this.nectar = nectar; this.pollen = pollen; this.energy = energy; },
      setChill: value => { this.chill = THREE.MathUtils.clamp(value, 0, 1); },
      setHeat: value => { this.heat = THREE.MathUtils.clamp(value, 0, 1); },
      setDayProgress: value => { this.dayElapsed = THREE.MathUtils.clamp(value, 0, 1) * DAY_DURATION; this.nightfallChecked = false; },
      setWindTime: value => { this.time = Math.max(0, value); this.windFX.reset(this.position, this.time); this.updateWorld(this.reducedMotion ? 0 : this.time); this.updateView(0); },
      setQuietTime: value => { this.quietAge = Math.max(0, value); },
      setEndingTime: value => { if (this.phase === 'returning') this.returnAge = THREE.MathUtils.clamp(value, 0, this.reducedMotion ? QUIET_ENDING_DURATION : ENDING_DURATION); },
      webs: () => this.webs.webs.map(w => ({ id: w.id, center: w.center.toArray(), normal: w.normal.toArray(), radius: w.radius, torn: w.torn })),
      setWebs: enabled => { this.websEnabled = enabled; this.webs.setVisible(enabled); if (!enabled) this.caughtWeb = null; },
      flowers: () => this.meadow.flowers.map(f => ({ id: f.id, species: f.species, center: f.center.toArray(), base: f.base.toArray(), rotation: f.rotation.toArray(), velocity: f.velocity.toArray(), height: f.height, radius: f.radius, pollenFraction: f.pollenFraction, visiblePollen: f.pollen.count, pollenMatch: f.pollenMatch })),
    };
  }
  private leafWet = 0;

  // ---- Spider webs: flying or walking through one catches the bee. Tapping
  // Space or W (or holding either) pulls it free at an energy cost; a heavy load
  // makes that harder, very low energy easier. A web never ends the day itself.
  private checkWebs(): void {
    if (!this.websEnabled || this.webGrace > 0 || this.landingAssist || this.shelterAssist || this.landed || this.underLeaf || this.onLeaf) return;
    if (this.phase !== 'flying' && !(this.phase === 'landed' && this.onGround)) return;
    for (const web of this.webs.webs) {
      if (web.torn) continue;
      const d0 = this.temp.subVectors(this.previousPosition, web.center).dot(web.normal);
      const d1 = this.temp.subVectors(this.position, web.center).dot(web.normal);
      if (d0 === d1 || d0 * d1 > 0) continue;
      this.temp.lerpVectors(this.previousPosition, this.position, d0 / (d0 - d1));
      if (this.temp.distanceTo(web.center) > web.radius * .92) continue;
      this.catchInWeb(web, Math.sign(d0) || 1);
      return;
    }
  }
  private catchInWeb(web: SpiderWeb, side: number): void {
    this.caughtWeb = web; this.webStruggle = 0; this.webShake = 1;
    this.webExit.copy(web.normal).multiplyScalar(-side);
    // Hang just in front of the silk, so its threads cross the view.
    this.position.copy(this.temp).addScaledVector(web.normal, side * .06); this.previousPosition.copy(this.position);
    this.stopRest(); this.onGround = false; this.phase = 'flying'; this.velocity.set(0, 0, 0);
    this.drinking = false; this.canDrink = false;
    this.audio.pluck(196, .05);
    this.notify('Caught in a spider’s web! Struggling free costs energy.', 5);
  }
  private webPull(): number { return (1 - .45 * this.load()) * (this.energy < 20 ? 1.6 : 1); }
  private struggle(dt: number): void {
    this.velocity.set(0, 0, 0); this.flightEffort = .7; this.flightMode = 'flying';
    if (this.keys.has('Space') || this.keys.has('KeyW')) { this.webStruggle += dt * .1 * this.webPull(); this.energy -= dt * .45; }
    else this.webStruggle = Math.max(0, this.webStruggle - dt * .04);
    // A bee this tired slips out as the silk gives way.
    if (this.webStruggle >= 1 || this.energy < 6) this.freeFromWeb();
  }
  private tugWeb(): void {
    this.webStruggle += .16 * this.webPull(); this.energy = Math.max(0, this.energy - .8); this.webShake = 1;
    this.audio.pluck(180 + this.webStruggle * 140, .035);
    if (this.webStruggle >= 1) this.freeFromWeb();
  }
  private freeFromWeb(): void {
    const web = this.caughtWeb; if (!web) return;
    this.webs.tear(web.id); this.caughtWeb = null; this.webStruggle = 0; this.webGrace = 1.2; this.webShake = .6;
    this.position.addScaledVector(this.webExit, .16); this.previousPosition.copy(this.position);
    this.velocity.copy(this.webExit).multiplyScalar(1.6); this.velocity.y += .7;
    this.audio.pluck(520, .03);
    this.notify('Free! The web tears as you pull through.', 3);
  }

  // 0–1: how close the bee is to the top of a broad leaf (perched on it, or just
  // above it), so rain on that leaf can be heard as close drops.
  private leafTopNearness(): number {
    if (this.onLeaf) return 1;
    let best = 0;
    for (const leaf of this.leafShelters.shelters) {
      const dy = this.position.y - leaf.center.y;
      if (dy < -.1) continue;
      const planar = Math.hypot(this.position.x - leaf.center.x, this.position.z - leaf.center.z) / leaf.radius;
      const near = (1 - THREE.MathUtils.smoothstep(planar, .8, 1.7)) * (1 - THREE.MathUtils.smoothstep(dy, 1.2, 4.5));
      if (near > best) best = near;
    }
    return best;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf); this.abort.abort(); this.ui.dispose(); this.audio.dispose(); this.bee.dispose(); this.pollenFX.dispose(); this.pollinationFX.dispose(); this.windFX.dispose(); this.atmosphere.dispose(); this.meadow.dispose();
    this.nectarDrop.dispose(); this.energyWash.dispose(); this.renderer.dispose();
    this.homecoming.dispose();
    this.leafShelters.dispose(); this.rainFX.dispose(); this.flowerRain.dispose(); this.webs.dispose();
    delete window.__BEE_TEST__; delete window.__THREE_GAME_TEST_HOOKS__; delete window.__THREE_GAME_DIAGNOSTICS__;
  }
}
