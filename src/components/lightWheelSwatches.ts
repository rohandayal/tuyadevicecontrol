import { hsvToHex } from '../utils/color';
import type { LightWheelSwatch } from './LightCard';

const WHEEL_SIZE = 252;
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;

export const LIGHT_WHEEL_SWATCHES: LightWheelSwatch[] = (() => {
  const result: LightWheelSwatch[] = [];

  const addRing = (r: number, count: number, s01: number, size: number) => {
    for (let i = 0; i < count; i++) {
      const h = Math.round((i * 360) / count);
      const rad = ((h - 90) * Math.PI) / 180;
      result.push({
        left: CX + r * Math.cos(rad) - size / 2,
        top: CY + r * Math.sin(rad) - size / 2,
        size,
        color: hsvToHex(h, s01),
        h,
        s: Math.round(s01 * 1000),
      });
    }
  };

  addRing(105, 24, 1.0, 18);
  addRing(73, 12, 0.55, 20);
  addRing(41, 6, 0.25, 20);
  const sz = 22;
  result.push({ left: CX - sz / 2, top: CY - sz / 2, size: sz, color: '#ffffff', h: 0, s: 0 });

  return result;
})();
