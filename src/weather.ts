import { MathUtils } from 'three';

export interface MeadowWeather {
  stage: 'clear' | 'approaching' | 'rain' | 'clearing';
  rain: number;
  cloudiness: number;
  sunHeat: number;
}

/** One gentle shower in the middle of the day. The daylight clock owns it,
 * so pausing freezes weather and a deliberate rest can pass the shower. */
export function weatherAt(daySeconds: number, out: MeadowWeather): MeadowWeather {
  const t = Math.max(0, daySeconds);
  out.stage = t < 150 || t >= 270 ? 'clear' : t < 180 ? 'approaching' : t < 240 ? 'rain' : 'clearing';
  out.cloudiness = MathUtils.smoothstep(t, 150, 180) * (1 - MathUtils.smoothstep(t, 240, 270));
  out.rain = MathUtils.smoothstep(t, 180, 192) * (1 - MathUtils.smoothstep(t, 234, 258));
  // A gradual hot spell after the shower, then mild late light. Rest advances
  // this daylight envelope; the bee's exposure still accumulates in real time.
  out.sunHeat = MathUtils.smoothstep(t, 270, 315) * (1 - MathUtils.smoothstep(t, 390, 465)) * (1 - out.cloudiness);
  return out;
}
