import { tuyaApi } from './tuyaClient';
import type { LightGroup, LightGroupState } from '../types/lightGroup';
import { DEFAULT_LIGHT_STATE } from '../types/lightGroup';

interface RawDevice {
  id: string;
  online?: boolean;
  status: Array<{ code: string; value: unknown }>;
}

function getStatus(statuses: RawDevice['status'], code: string) {
  return statuses.find(s => s.code === code);
}

function parseLightState(groupId: string, raw: RawDevice): LightGroupState {
  const switchSt = getStatus(raw.status, 'switch_led');
  const modeSt = getStatus(raw.status, 'work_mode');
  const brightSt =
    getStatus(raw.status, 'bright_value_v2') ?? getStatus(raw.status, 'bright_value');
  const tempSt =
    getStatus(raw.status, 'temp_value_v2') ?? getStatus(raw.status, 'temp_value');
  const colourSt =
    getStatus(raw.status, 'colour_data_v2') ?? getStatus(raw.status, 'colour_data');

  const isOn = switchSt ? Boolean(switchSt.value) : false;
  const mode: 'white' | 'colour' = modeSt?.value === 'colour' ? 'colour' : 'white';

  let brightness = 100;
  if (brightSt && typeof brightSt.value === 'number') {
    // bright_value_v2: 10–1000 → 1–100
    brightness = Math.max(1, Math.min(100, Math.round(((brightSt.value - 10) / 990) * 99 + 1)));
  }

  let colorTemp = 500;
  if (tempSt && typeof tempSt.value === 'number') {
    colorTemp = tempSt.value;
  }

  let hue = 0;
  let sat = 0;
  if (colourSt) {
    try {
      const cd =
        typeof colourSt.value === 'string'
          ? (JSON.parse(colourSt.value) as { h?: number; s?: number })
          : (colourSt.value as { h?: number; s?: number });
      hue = cd.h ?? 0;
      sat = cd.s ?? 0;
    } catch {
      // leave defaults
    }
  }

  return { groupId, isOn, online: raw.online ?? true, brightness, mode, colorTemp, hue, sat };
}

export async function fetchAllGroupStates(): Promise<{
  groups: LightGroup[];
  states: LightGroupState[];
}> {
  const groups = tuyaApi.getLightGroups();
  if (groups.length === 0) return { groups: [], states: [] };

  const states = await Promise.all(
    groups.map(async (group): Promise<LightGroupState> => {
      if (group.deviceIds.length === 0) {
        return { groupId: group.id, ...DEFAULT_LIGHT_STATE };
      }
      try {
        const raw = await tuyaApi.get<RawDevice>(`/v1.0/devices/${group.deviceIds[0]}`);
        return parseLightState(group.id, raw);
      } catch {
        return { groupId: group.id, ...DEFAULT_LIGHT_STATE };
      }
    }),
  );

  return { groups, states };
}

async function sendToAll(
  group: LightGroup,
  commands: { code: string; value: unknown }[],
): Promise<void> {
  await Promise.all(
    group.deviceIds.map(id =>
      tuyaApi.post(`/v1.0/devices/${id}/commands`, { commands }),
    ),
  );
}

export async function setGroupOnOff(group: LightGroup, isOn: boolean): Promise<void> {
  await sendToAll(group, [{ code: 'switch_led', value: isOn }]);
}

export async function setGroupWhite(
  group: LightGroup,
  temp: number,     // 0–1000
  brightness: number, // 1–100
): Promise<void> {
  const tuyaBright = Math.round(10 + ((brightness - 1) / 99) * 990);
  await sendToAll(group, [
    { code: 'switch_led', value: true },
    { code: 'work_mode', value: 'white' },
    { code: 'bright_value_v2', value: tuyaBright },
    { code: 'temp_value_v2', value: temp },
  ]);
}

export async function setGroupColour(
  group: LightGroup,
  h: number,          // 0–360
  s: number,          // 0–1000
  brightness: number, // 1–100
): Promise<void> {
  const v = Math.round(10 + ((brightness - 1) / 99) * 990);
  await sendToAll(group, [
    { code: 'switch_led', value: true },
    { code: 'work_mode', value: 'colour' },
    { code: 'colour_data_v2', value: { h, s, v } },
  ]);
}

export async function setGroupBrightness(
  group: LightGroup,
  brightness: number, // 1–100
): Promise<void> {
  const tuyaBright = Math.round(10 + ((brightness - 1) / 99) * 990);
  await sendToAll(group, [{ code: 'bright_value_v2', value: tuyaBright }]);
}
