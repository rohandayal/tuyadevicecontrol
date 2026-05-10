export function hsvToHex(h: number, s01: number, v01 = 1): string {
  const c = v01 * s01;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v01 - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) {
    r = c; g = x; b = 0;
  } else if (hh < 2) {
    r = x; g = c; b = 0;
  } else if (hh < 3) {
    r = 0; g = c; b = x;
  } else if (hh < 4) {
    r = 0; g = x; b = c;
  } else if (hh < 5) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  const toH = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

export function hsvToRgb(h: number, s01: number, v01 = 1): { r: number; g: number; b: number } {
  const c = v01 * s01;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v01 - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) {
    r = c; g = x; b = 0;
  } else if (hh < 2) {
    r = x; g = c; b = 0;
  } else if (hh < 3) {
    r = 0; g = c; b = x;
  } else if (hh < 4) {
    r = 0; g = x; b = c;
  } else if (hh < 5) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}
