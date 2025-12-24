
import * as THREE from 'three';
import { ThreeElements } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export enum GameStatus {
  MENU = 'MENU',
  OPTIONS = 'OPTIONS',
  SHOP = 'SHOP',
  CUSTOMIZE = 'CUSTOMIZE',
  MANUAL = 'MANUAL', // 新增說明書狀態
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
  VICTORY = 'VICTORY'
}

export enum PlayerState {
  RUNNING = 'RUNNING',
  JUMPING = 'JUMPING',
  SLIDING = 'SLIDING',
  CRASHED = 'CRASHED'
}

export enum RegionId {
  MONG_KOK = 'MONG_KOK',      // 旺角：霓虹燈、小巴、密集
  SHAM_SHUI_PO = 'SHAM_SHUI_PO', // 深水埗：舊樓、排檔、地攤
  CENTRAL = 'CENTRAL',        // 中環：高樓、玻璃幕牆、寬闊
  THE_PEAK = 'THE_PEAK'       // 山頂：綠樹、欄杆、霧氣
}

export interface RegionConfig {
  id: RegionId;
  name: string;
  description: string;
  atmosphere: {
    skyColor: string;
    fogColor: string;
    fogDensity: number;
    lightColor: string;
    lightIntensity: number;
  };
  road: {
    widthScale: number; // 道路寬度倍率
    texture: 'asphalt' | 'concrete';
  };
  props: {
    hasNeon: boolean;
    hasStalls: boolean; // 排檔
    hasTrees: boolean;
    barrierType: 'railing_green' | 'barrier_metal' | 'none';
  };
  nextRegions: { id: RegionId; weight: number }[]; // 轉場權重
}

export type Lane = -1 | 0 | 1;
export type ItemType = 'bun' | 'lemontea' | 'magnet' | 'bag' | 'oil';

export interface Upgrades {
  extraLife: boolean;
  doubleBuns: boolean;
  jetStart: boolean;
  strongMagnet: boolean;
  // New Outfits
  skinPanda: boolean;
  skinIron: boolean;
  skinDestruction: boolean; // 破壞之王套裝
}

export interface ObstacleData {
  id: string;
  lane: Lane;
  z: number;
  type: 'minibus' | 'taxi' | 'trashbin' | 'waterhorse' | 'foambox' | 'puddle' | 'scaffold' | 'barrier' | 'neon_sign' | 'rock' | 'traffic_cone' | 'pedestrian' | 'bird' | 'ambulance';
  label?: string;
  variant?: 'yellow' | 'white'; // 新增：用於區分救護車顏色
  // 動態移動屬性 (for Pedestrians)
  customX?: number;      // 實時 X 軸位置 (覆蓋 Lane 計算)
  moveSpeed?: number;    // 移動速度
  moveDirection?: 1 | -1;// 1: 向右, -1: 向左
  // 彈飛物理屬性
  isHit?: boolean;
  hitVelocity?: THREE.Vector3;
  hitRotation?: THREE.Vector3;
  hitTime?: number;
}

export interface CoinData {
  id: string;
  lane: Lane;
  z: number;
  collected: boolean;
  type: ItemType;
  isAttracted?: boolean;
  posX?: number;
  posY?: number;
  posZ?: number;
  velocity?: THREE.Vector3;
  scale?: number;
  attractionTime?: number; // 新增：記錄被吸附的時間
}

export interface DecorationData {
  id: string;
  x: number;
  y?: number; // 新增：支援懸空物件的高度設定
  z: number;
  type: 'building' | 'pole' | 'aircon' | 'laundry' | 'poster' | 'tree' | 'stall' | 'neon' | 'sign_board';
  height: number;
  width: number;
  color: string;
  rotation?: number;
  // Sign Board Props
  text?: string;
  textColor?: string;
  isVertical?: boolean;
}

export interface SegmentData {
  id: string;
  z: number;
  region: RegionId; // 該路段所屬區域
  obstacles: ObstacleData[];
  coins: CoinData[];
  decorations: DecorationData[];
}

export interface GameSettings {
  quality: 'low' | 'high';
  volume: boolean;
}

export interface CharacterStyle {
  skin: string;
  shirt: string;
  shorts: string;
  outfit: 'casual' | 'panda' | 'iron' | 'destruction'; // 新增套裝選擇
}

export interface ParticleData {
    id: number;
    position: THREE.Vector3;
    color: string;
    count: number;
    type?: 'splash' | 'spark';
}

export interface LeaderboardEntry {
  name: string;
  score: number; // Distance
  date: string;
  outfit: CharacterStyle['outfit'];
}
