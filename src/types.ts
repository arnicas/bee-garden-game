import type { Curve, Group, InstancedMesh, Quaternion, Vector3 } from 'three';

export type Species = 'daisy' | 'poppy' | 'cornflower';
export type CarriedPollen = Readonly<Partial<Record<Species, number>>>;
export type Phase = 'title' | 'night' | 'learning' | 'flying' | 'landed' | 'paused' | 'returning' | 'failing' | 'won' | 'lost';
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
  /** The stalk's resting curve in local space (base at the origin, head at (0, height, 0)). */
  stalk: Curve<Vector3>;
  /** Cornflowers: the mouths of the disc florets that hold nectar, in the head's
   * local frame (scaled to the flower). Empty for daisies and poppies. */
  nectarSpots: Vector3[];
  /** Daisies in a dry summer: 0–1, how far the head nods over (0 upright). */
  droop: number;
  /** Daisies in a dry summer: petals going brown. */
  browned: boolean;
}
/** A low spot where rain pools: a small clearing in the grass. */
export interface PuddleSpot { x: number; z: number; radius: number }
/** A small ant mound in the grass, with a trail to one flower's stem. */
export interface AntNestSpot { x: number; z: number; flowerId: number }
/** Where a fallen petal lies under a flower; a spare one is a poppy's next to fall. */
export interface PetalSpot { flowerId: number; kind: 'poppy' | 'daisy'; x: number; z: number; spare: boolean }
/** A few mushrooms together at the damp edge of a rain pool. */
export interface MushroomPatchSpot { x: number; z: number; count: number }
/** A ring of fairy ring mushrooms in the open grass. */
export interface FairyRingSpot { x: number; z: number; radius: number }
export interface Meadow {
  flowers: Flower[];
  puddles: PuddleSpot[];
  antNests: AntNestSpot[];
  fairyRings: FairyRingSpot[];
  mushroomPatches: MushroomPatchSpot[];
  petalSpots: PetalSpot[];
  update(time: number, cameraPosition: Vector3, uv: boolean, carriedPollen?: CarriedPollen): void;
  /** Dry pool beds to paint as cracked clay (see ground-paint.ts). */
  setHollows(hollows: readonly { x: number; z: number; radius: number; amount: number }[]): void;
  /** 0–1: how dry the land beyond the meadow looks (see ground-paint.ts). */
  setFarDry(dry: number): void;
  dispose(): void;
}
export interface SummerPreview {
  now: Record<Species, number>;
  next: Record<Species, number>;
  ladybirds: number;
  nextLadybirds: number;
  /** 0 in the first summer. */
  lastSummerLadybirds: number;
  /** How the meadow left behind moves the ground's water (see coverMoisture). */
  coverShift?: number;
}
/** The start page of a new summer: how the meadow changed since the last one. */
export interface SummerStart {
  summer: number;
  /** What last summer's pollination did to the flowers (a lesson, not just a count). */
  flowersLine: string;
  /** The summer's weather and ground (not the bee's doing), shown on its own above the counts, or ''. */
  weatherLine: string;
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
  snailsBefore: number;
  snailsAfter: number;
}
export interface LoreCardView { id: string; kind: 'belief' | 'thought' | 'verse'; lines: string[]; source: string; opacity: number; }
export interface ViewState {
  phase: Phase;
  /** The bee lore card beside the sleeping bee, if one is showing. */
  lore?: LoreCardView | null;
  loreOn?: boolean;
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
  /** On a lost day: how many days in a row have ended this way, this one included (0 otherwise). */
  lossStreak: number;
  /** Water carried for the hive (jar percent), and today's request (0 when it isn't a hot day). */
  water: number;
  waterGoal: number;
  /** Hot, in dry grass that gives little shade. */
  thinShade: boolean;
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
  /** Aphid clusters spotted today. */
  aphidsFound?: number;
  /** Distinct butterflies met today. */
  butterfliesFound: number;
  /** Distinct snails met today. */
  snailsFound: number;
  /** Distinct ant trails found today. */
  antTrailsFound: number;
  /** Small finds today: fairy rings, mushroom clumps, fallen petals, caterpillars. */
  finds: { rings: number; mushrooms: number; petals: number; caterpillars: number; helped?: number };
  /** Seconds spent sipping water today (dew, raindrops, puddles). */
  waterSips: number;
  /** Chose to fly home before the harvest goal. */
  headingHome: boolean;
  /** Near the hive edge facing out, before heading home: the marker shows the way. */
  nearHomeEdge?: boolean;
  /** Carries enough nectar for the flight home. */
  canHeadHome: boolean;
  /** Summers played this session (each round is one day that stands for a summer). */
  summerNumber: number;
  /** On the results screen: this summer's meadow and what next summer brings. */
  summerPreview: SummerPreview | null;
  /** On the start page from the second summer. */
  summerStart: SummerStart | null;
  /** The run of summers (null on test pages without ?arc): which summer, a line about the hive, and the ending once there is one. */
  arc: { summer: number; of: number; hiveLine: string; ending: string | null; endingLine: string; summary: import('./hive-stores').RunSummary | null } | null;
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
  /** Nectar this flower's aphids are taking (shown faded on the bar), and whether a ladybird is eating them. */
  flowerSapped?: number;
  flowerAphids?: 'sapping' | 'eating' | null;
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
  /** 0–1 through the night between summers (only in the night phase). */
  nightProgress: number;
  /** The Queen's results line, remembering earlier summers ('' for a lost day). */
  queenLine: string;
  /** Bold at the front of the message: the name of something just discovered. */
  messageLead: string;
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
  /** Saves a photo of the meadow view (P). */
  photo(): void;
  returnHome(): void;
  skipReturn(): void;
  /** Skips the night between summers to the next morning. */
  skipNight(): void;
  toggleRest(): void;
  /** Turns the bee lore cards on or off. */
  toggleLore(): void;
}
export interface GameUI {
  update(state: ViewState): void;
  dispose(): void;
}
