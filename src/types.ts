import type { Group, InstancedMesh, Quaternion, Vector3 } from 'three';

export type Species = 'daisy' | 'poppy' | 'cornflower';
export type CarriedPollen = Readonly<Partial<Record<Species, number>>>;
export type Phase = 'title' | 'learning' | 'flying' | 'landed' | 'paused' | 'returning' | 'failing' | 'won' | 'lost';
export interface Flower {
  id: number;
  species: Species;
  base: Vector3;
  center: Vector3;
  velocity: Vector3;
  height: number;
  rotation: Quaternion;
  radius: number;
  group: Group;
  pollen: InstancedMesh;
  pollenFraction: number;
  visited: boolean;
  pollenMatch: boolean;
}
export interface Meadow {
  flowers: Flower[];
  update(time: number, cameraPosition: Vector3, uv: boolean, carriedPollen?: CarriedPollen): void;
  dispose(): void;
}
export interface SummerPreview {
  now: Record<Species, number>;
  next: Record<Species, number>;
  ladybirds: number;
  nextLadybirds: number;
  /** 0 in the first summer. */
  lastSummerLadybirds: number;
}
/** The start page of a new summer: how the meadow changed since the last one. */
export interface SummerStart {
  summer: number;
  /** What last summer's pollination did to the flowers (a lesson, not just a count). */
  flowersLine: string;
  /** Flowers pollinated last summer. */
  pollinated: Record<Species, number>;
  before: Record<Species, number>;
  after: Record<Species, number>;
  /** The knock-on effect for aphids and ladybirds. */
  friendsLine: string;
  aphidsBefore: number;
  aphidsAfter: number;
  ladybirdsBefore: number;
  ladybirdsAfter: number;
  butterfliesBefore: number;
  butterfliesAfter: number;
}
export interface ViewState {
  phase: Phase;
  dayProgress: number;
  reducedMotion: boolean;
  resting: boolean;
  restProgress: number;
  quietFade: number;
  scenicFade: number;
  /** 0–1 blend into the lingering overhead meadow view. */
  scenicAmount: number;
  underLeaf: boolean;
  onLeaf: boolean;
  leafTopTarget: boolean;
  onGround: boolean;
  grassCover: number;
  shelterTarget: boolean;
  shelterDistance: number;
  shelterBearing: number;
  weatherStage: 'clear' | 'approaching' | 'rain' | 'clearing';
  rain: number;
  cloudiness: number;
  rainExposure: number;
  cold: number;
  chilled: boolean;
  heat: number;
  sunHeat: number;
  gale: number;
  heatExposure: number;
  shaded: boolean;
  needsShade: boolean;
  lossProgress: number;
  lossFromRain: boolean;
  lossFromHeat: boolean;
  lossFromNight: boolean;
  endingStage: 'none' | 'meadow' | 'home' | 'fade';
  endingFade: number;
  energy: number;
  nectar: number;
  pollen: number;
  nectarGoal: number;
  nectarCapacity: number;
  autoFeeding: boolean;
  pollenGoal: number;
  homeCost: number;
  homeDistance: number;
  homeBearing: number;
  homeX: number;
  homeY: number;
  homeVisible: boolean;
  harvestReady: boolean;
  /** Distinct ladybirds met today. */
  friendsFound: number;
  /** Distinct butterflies met today. */
  butterfliesFound: number;
  /** Chose to fly home before the harvest goal. */
  headingHome: boolean;
  /** Carries enough nectar for the flight home. */
  canHeadHome: boolean;
  /** Summers played this session (each round is one day that stands for a summer). */
  summerNumber: number;
  /** On the results screen: this summer's meadow and what next summer brings. */
  summerPreview: SummerPreview | null;
  /** On the start page from the second summer. */
  summerStart: SummerStart | null;
  canReturn: boolean;
  wind: number;
  windBearing: number;
  flightMode: 'riding' | 'flying' | 'steady';
  sheltered: boolean;
  edgeGust: boolean;
  speed: number;
  load: number;
  uv: boolean;
  muted: boolean;
  flowerName: string;
  flowerSpecies: Species | null;
  flowerNectar: number;
  flowerPollen: number;
  /** Usable nectar/pollen in a fresh flower of the richest kind, for the panel's bars. */
  flowerNectarMax: number;
  flowerPollenMax: number;
  targetX: number;
  targetY: number;
  targetVisible: boolean;
  canLand: boolean;
  landing: boolean;
  canDrink: boolean;
  drinking: boolean;
  satiated: boolean;
  dust: number;
  pollinated: number;
  pollinatedBySpecies: Readonly<Record<Species, number>>;
  flowerPollinated: boolean;
  flowerVisited: boolean;
  pollinationSpecies: Species | null;
  carriedPollen: CarriedPollen;
  visited: number;
  flowerTotal: number;
  elapsed: number;
  message: string;
  hint: string;
  resultScore: number;
}
export interface UIActions {
  start(): void;
  explore(): void;
  resume(): void;
  pause(): void;
  restart(): void;
  toggleSound(): void;
  toggleUV(): void;
  returnHome(): void;
  skipReturn(): void;
  toggleRest(): void;
}
export interface GameUI {
  update(state: ViewState): void;
  dispose(): void;
}
