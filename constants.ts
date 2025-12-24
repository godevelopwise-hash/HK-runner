
import { RegionId, RegionConfig } from './types';

export const LANE_WIDTH = 4;
export const LANES: number[] = [-LANE_WIDTH, 0, LANE_WIDTH];
export const SEGMENT_LENGTH = 50;
export const INITIAL_SPEED = 0.4;
export const MAX_SPEED = 1.3;
export const SPEED_LOG_FACTOR = 0.065; // Reduced from 0.085 for smoother difficulty curve

export const TIER_1_DIST = 500;
export const TIER_2_DIST = 1500;

export const PLAYER_Z = 0;
export const VISIBLE_SEGMENTS = 8;
export const JUMP_DURATION = 1100;
export const SLIDE_DURATION = 800;
export const POWERUP_DURATION = 5000; 
export const MAGNET_DURATION = 8000;

// --- 香港區域地圖配置 (Hong Kong Region Map) ---
export const REGIONS_DATA: Record<RegionId, RegionConfig> = {
  [RegionId.MONG_KOK]: {
    id: RegionId.MONG_KOK,
    name: "旺角 MONG KOK",
    description: "霓虹不夜城,小巴與行人橫行霸道。",
    atmosphere: {
      skyColor: "#0f0518", // Dark purple (matches skybox top)
      fogColor: "#4a1d4a", // Matches skybox bottom gradient
      fogDensity: 0.015,   // Slightly reduced to show skyline
      lightColor: "#ff00aa", // 霓虹粉紅光
      lightIntensity: 1.5,
    },
    road: { widthScale: 1.0, texture: 'asphalt' },
    props: { hasNeon: true, hasStalls: false, hasTrees: false, barrierType: 'barrier_metal' },
    nextRegions: [
      { id: RegionId.SHAM_SHUI_PO, weight: 0.35 }, // 35% 留在九龍 (鄰區)
      { id: RegionId.CENTRAL, weight: 0.65 }       // 65% 過海去中環
    ]
  },
  [RegionId.SHAM_SHUI_PO]: {
    id: RegionId.SHAM_SHUI_PO,
    name: "深水埗 SHAM SHUI PO",
    description: "舊樓林立,小心築棚與發泡膠箱。",
    atmosphere: {
      skyColor: "#1a1008", 
      fogColor: "#9a4515", // Orange/Brown dust
      fogDensity: 0.012,
      lightColor: "#ffedd5", // 溫暖夕陽光
      lightIntensity: 1.8,
    },
    road: { widthScale: 0.9, texture: 'asphalt' }, // 路較窄
    props: { hasNeon: false, hasStalls: true, hasTrees: false, barrierType: 'none' },
    nextRegions: [
      { id: RegionId.MONG_KOK, weight: 0.4 },   // 40% 回旺角
      { id: RegionId.CENTRAL, weight: 0.6 }     // 60% 過海
    ]
  },
  [RegionId.CENTRAL]: {
    id: RegionId.CENTRAL,
    name: "中環 CENTRAL",
    description: "寬闊大道與玻璃幕牆,車速較快,設置了路障。",
    atmosphere: {
      skyColor: "#020617", 
      fogColor: "#1e293b", // Navy blue
      fogDensity: 0.006,   // Very clear visibility for skyscrapers
      lightColor: "#e0f2fe", // 冷白光
      lightIntensity: 2.0,
    },
    road: { widthScale: 1.2, texture: 'concrete' }, // 寬路
    props: { hasNeon: false, hasStalls: false, hasTrees: false, barrierType: 'barrier_metal' },
    nextRegions: [
      { id: RegionId.MONG_KOK, weight: 0.6 }, // 60% 過海回九龍 (主要循環)
      { id: RegionId.THE_PEAK, weight: 0.4 }  // 40% 上山頂 (稀有路線)
    ]
  },
  [RegionId.THE_PEAK]: {
    id: RegionId.THE_PEAK,
    name: "山頂 THE PEAK",
    description: "雲端之上的稀有路線,群鳥亂飛,留意積水與石塊。",
    atmosphere: {
      skyColor: "#020617", 
      fogColor: "#d1fae5", // Light mint fog
      fogDensity: 0.001,   // Reduced from 0.018 for better visibility
      lightColor: "#ecfccb", // 陽光穿過樹葉
      lightIntensity: 1.4,
    },
    road: { widthScale: 0.8, texture: 'asphalt' },
    props: { hasNeon: false, hasStalls: false, hasTrees: true, barrierType: 'railing_green' },
    nextRegions: [
      { id: RegionId.CENTRAL, weight: 1.0 } // 100% 下山回中環
    ]
  }
};
