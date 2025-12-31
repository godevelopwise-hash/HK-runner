
import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameStatus, PlayerState, SegmentData, ObstacleData, CoinData, DecorationData, ItemType, Lane, RegionId } from '../types';
import { SEGMENT_LENGTH, VISIBLE_SEGMENTS, LANES, PLAYER_Z, REGIONS_DATA } from '../constants';
import Synth from '../utils/Synth';

interface TrackManagerProps {
  gameId: number;
  speed: number;
  gameStatus: GameStatus;
  playerRef: React.RefObject<THREE.Group>;
  playerState: PlayerState;
  currentScoreRef: React.MutableRefObject<number>;
  onCollision: () => void;
  onPuddle: (pos: THREE.Vector3) => void;
  onCoinCollected: (type: ItemType, position: THREE.Vector3) => void;
  onObstacleClash: (position: THREE.Vector3) => void;
  onRegionChange?: (region: RegionId) => void;
  isInvincible: boolean;
  isPoweredUp: boolean;
  isMagnetActive: boolean;
  magnetRange: number;
  quality: 'low' | 'high';
}

// --- Procedural PBR Texture Generators ---

const noise = (ctx: CanvasRenderingContext2D, w: number, h: number, density: number, opacity: number = 0.1) => {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < density; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.globalAlpha = 1.0;
};

const grimeStreaks = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * w;
        const width = Math.random() * 60 + 20;
        const length = Math.random() * h * 0.8;
        ctx.fillRect(x, 0, width, length);
    }
    ctx.globalAlpha = 1.0;
};

const generateBuildingMaterialProps = (style: 'tonglau' | 'commercial' | 'glass', variation: number): THREE.MeshStandardMaterialParameters => {
    const width = 512;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    if (style === 'tonglau') {
        const colors = ['#d6cba0', '#c9d6a0', '#e0c0c0', '#cfcfcf'];
        ctx.fillStyle = colors[variation % colors.length];
        ctx.fillRect(0, 0, width, height);
        grimeStreaks(ctx, width, height);
        
        const rows = 12;
        const cols = 4;
        const winW = width / cols;
        const winH = height / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const wx = c * winW + 15;
                const wy = r * winH + 15;
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(wx, wy, winW - 30, winH - 30);
            }
        }
    } else if (style === 'commercial') {
        ctx.fillStyle = '#444444';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 2;
        const tileSize = 32;
        for(let y=0; y<height; y+=tileSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        for(let x=0; x<width; x+=tileSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    } else {
        const grad = ctx.createLinearGradient(0,0,0,height);
        grad.addColorStop(0, '#1e3a8a'); grad.addColorStop(1, '#60a5fa');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }
    
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width; bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d')!;
    
    if (style === 'tonglau') {
        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(0,0,width,height);
        noise(bCtx, width, height, 5000, 0.2);
        
        const rows = 12; const cols = 4;
        const winW = width / cols; const winH = height / rows;
        bCtx.fillStyle = '#000000';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const wx = c * winW + 15;
                const wy = r * winH + 15;
                bCtx.fillRect(wx, wy, winW - 30, winH - 30);
            }
        }
    } else if (style === 'commercial') {
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0,0,width,height);
        bCtx.strokeStyle = '#000000';
        bCtx.lineWidth = 2;
        const tileSize = 32;
        for(let y=0; y<height; y+=tileSize) { bCtx.beginPath(); bCtx.moveTo(0, y); bCtx.lineTo(width, y); bCtx.stroke(); }
        for(let x=0; x<width; x+=tileSize) { bCtx.beginPath(); bCtx.moveTo(x, 0); bCtx.lineTo(x, height); bCtx.stroke(); }
    } else {
        bCtx.fillStyle = '#202020';
        bCtx.fillRect(0,0,width,height);
    }

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);

    return {
        map: map,
        roughnessMap: bumpMap,
        bumpMap: bumpMap,
        bumpScale: 0.1,
        roughness: 1.0,
        metalness: style === 'glass' ? 0.8 : 0.1,
    };
};

const generateRoadTexture = () => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#404040';
    ctx.fillRect(0, 0, size, size);
    
    noise(ctx, size, size, 50000, 0.15);

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(size * 0.28, 0); ctx.lineTo(size * 0.28, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.29, 0); ctx.lineTo(size * 0.29, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.71, 0); ctx.lineTo(size * 0.71, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.72, 0); ctx.lineTo(size * 0.72, size); ctx.stroke();

    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 10;
    ctx.setLineDash([60, 40]);
    ctx.beginPath(); ctx.moveTo(size * 0.42, 0); ctx.lineTo(size * 0.42, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size * 0.58, 0); ctx.lineTo(size * 0.58, size); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#050505';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    for(let i=0; i<5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random()*size, 0);
        let x = Math.random()*size;
        for(let y=0; y<size; y+=20) {
            x += (Math.random()-0.5)*30;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000000';
    for(let i=0; i<10; i++) {
        const r = Math.random() * 50 + 20;
        ctx.beginPath();
        ctx.arc(Math.random()*size, Math.random()*size, r, 0, Math.PI*2);
        ctx.fill();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1, 4);
    map.anisotropy = 16;
    map.colorSpace = THREE.SRGBColorSpace;

    return { map };
};

const createTaxiTexture = () => {
    const w = 512; const h = 160;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0,0,w,h);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 100px "Arial Black", sans-serif'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', w/2, h/2 + 8);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeRect(6,6,w-12,h-12);

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

const createAmbulanceTexture = (style: 'yellow' | 'white' = 'yellow') => {
    const w = 512; const h = 160;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = style === 'yellow' ? '#facc15' : '#ffffff';
    ctx.fillRect(0,0,w,h);
    
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 80px "Arial Black", sans-serif'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AMBULANCE', w/2, h/2 + 5);
    
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

const HK_SIGNS = [
  { text: "大押", v: true }, { text: "桑拿", v: false }, { text: "跌打", v: true },
  { text: "麻雀", v: false }, { text: "賓館", v: true }, { text: "藥房", v: false },
  { text: "水電", v: true }, { text: "五金", v: false }, { text: "燒臘", v: true },
  { text: "冰室", v: false }, { text: "理髮", v: true }, { text: "洋服", v: false },
  { text: "地產", v: true }, { text: "飯店", v: true }, { text: "時裝", v: false },
  { text: "找換", v: true }, { text: "中醫", v: true }, { text: "雀會", v: false }
];

const signTextureCache: Record<string, THREE.CanvasTexture> = {};

const createSignTexture = (text: string, color: string, textColor: string, isVertical: boolean, isNeon: boolean) => {
    const cacheKey = `${text}_${color}_${textColor}_${isVertical}_${isNeon}`;
    if (signTextureCache[cacheKey]) {
        return signTextureCache[cacheKey];
    }

    const canvas = document.createElement('canvas');
    const w = isVertical ? 128 : 256;
    const h = isVertical ? 256 : 128;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = isNeon ? '#000000' : color === '#ffffff' ? '#f5f5f5' : color;
    ctx.fillRect(0, 0, w, h);

    const borderWidth = 6;
    ctx.strokeStyle = isNeon ? color : textColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth/2, borderWidth/2, w - borderWidth, h - borderWidth);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = isVertical ? Math.min(w * 0.7, h / (text.length + 0.5)) : h * 0.6;
    ctx.font = `bold ${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
    
    if (isNeon) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff'; 
        ctx.strokeStyle = color;
    } else {
        ctx.fillStyle = textColor;
        ctx.shadowBlur = 0;
    }

    if (isVertical) {
        const startY = (h - (text.length * fontSize)) / 2 + fontSize / 2;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const y = startY + i * fontSize;
            if (isNeon) ctx.strokeText(char, w / 2, y); 
            ctx.fillText(char, w / 2, y);
        }
    } else {
        if (isNeon) ctx.strokeText(text, w / 2, h / 2);
        ctx.fillText(text, w / 2, h / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    
    signTextureCache[cacheKey] = texture;
    
    return texture;
};

// --- Mesh Components ---

const SignMesh = ({ decoration }: { decoration: DecorationData }) => {
    const texture = useMemo(() => {
        if (!decoration.text) return null;
        const isNeon = decoration.type === 'neon';
        const colorMap: any = {
            'signPlasticRed': '#b91c1c',
            'signPlasticWhite': '#ffffff',
            'signPlasticGreen': '#15803d',
            'signPlasticYellow': '#eab308',
            'neonPink': '#ff00ff',
            'neonBlue': '#00ffff',
            'neonSignGreen': '#00ff00',
            'neonSignRed': '#ff0000',
        };
        const baseColor = colorMap[decoration.color] || '#ffffff';
        const txtColor = decoration.textColor || '#ffffff';
        return createSignTexture(decoration.text, baseColor, txtColor, !!decoration.isVertical, isNeon);
    }, [decoration.text, decoration.color, decoration.textColor, decoration.isVertical, decoration.type]);

    const isNeon = decoration.type === 'neon';

    return (
        <group position={[decoration.x, decoration.y ?? decoration.height / 2, decoration.z]} rotation-y={decoration.rotation || 0}>
             <mesh castShadow>
                <boxGeometry args={[decoration.width, decoration.height, 0.2]} />
                <meshStandardMaterial 
                    color={isNeon ? '#000000' : '#ffffff'}
                    map={texture} 
                    emissiveMap={texture} 
                    emissive={isNeon ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)}
                    emissiveIntensity={isNeon ? 2.0 : 0.0}
                    roughness={isNeon ? 0.1 : 0.4}
                    metalness={isNeon ? 0.2 : 0.1}
                />
             </mesh>
             <mesh position={[0, 0, -0.11]}>
                 <boxGeometry args={[decoration.width + 0.1, decoration.height + 0.1, 0.1]} />
                 <meshStandardMaterial color="#222222" roughness={0.8} />
             </mesh>
             {!isNeon && (
                 <group>
                     <mesh position={[-decoration.width/2 + 0.2, decoration.height/2 + 1, 0]}>
                         <cylinderGeometry args={[0.02, 0.02, 2, 8]} />
                         <meshStandardMaterial color="#111111" />
                     </mesh>
                     <mesh position={[decoration.width/2 - 0.2, decoration.height/2 + 1, 0]}>
                         <cylinderGeometry args={[0.02, 0.02, 2, 8]} />
                         <meshStandardMaterial color="#111111" />
                     </mesh>
                 </group>
             )}
        </group>
    );
};

const ObstacleMesh = React.memo(({ obs, geometries, materials, region }: { obs: ObstacleData, geometries: any, materials: any, region: RegionId }) => {
    const groupRef = useRef<THREE.Group>(null);
    const [scaffoldRotation] = useState(() => Math.random() * Math.PI * 2);
    const [wobble] = useState(() => Math.random() * 0.2 - 0.1);
    const trashRot = useMemo(() => new THREE.Euler(Math.random()*0.5, Math.random()*Math.PI, 0), []);
    const isGreenMinibus = useMemo(() => Math.random() > 0.7, []);

    useFrame((state, delta) => {
        if (obs.isHit && groupRef.current) {
             const dt = delta;
             if (obs.hitVelocity) {
                 obs.hitVelocity.y -= 40 * dt; 
                 groupRef.current.position.addScaledVector(obs.hitVelocity, dt);
                 if (obs.hitRotation) {
                    groupRef.current.rotation.x += obs.hitRotation.x * dt;
                    groupRef.current.rotation.y += obs.hitRotation.y * dt;
                    groupRef.current.rotation.z += obs.hitRotation.z * dt;
                 }
             }
        } else if (groupRef.current) {
             if ((obs.type === 'pedestrian' || obs.type === 'bird') && obs.customX !== undefined) {
                 groupRef.current.position.x = obs.customX;
                 if (obs.type === 'pedestrian') {
                     groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.05;
                 }
             }
             if (obs.type === 'minibus' || obs.type === 'taxi' || obs.type === 'ambulance') {
                 groupRef.current.position.z = obs.z;
             }
             
             if (obs.type === 'ambulance') {
                 const flash = Math.sin(state.clock.elapsedTime * 20) > 0;
                 if (materials.lightBlue) materials.lightBlue.emissiveIntensity = flash ? 3 : 0;
                 if (materials.lightRed) materials.lightRed.emissiveIntensity = !flash ? 3 : 0;
             }
        }
    });

    const x = obs.customX ?? (LANES[obs.lane + 1] ?? 0);

    return (
        <group ref={groupRef} position={[x, 0, obs.z]}>
            {obs.type === 'minibus' && (
                <group position={[0, 0, 0]}>
                    <mesh position={[0, 1.2, 0]} geometry={geometries.minibusBody} material={materials.minibusCream} castShadow />
                    <mesh position={[0, 2.05, 0]} geometry={geometries.minibusRoof} material={materials.minibusCream} />
                    <mesh position={[0, 1.3, 0]} geometry={geometries.minibusStripe} material={isGreenMinibus ? materials.minibusGreen : materials.minibusRed} />
                    <mesh position={[0, 2.16, 0]} scale={[1, 1, 0.9]} geometry={geometries.minibusRoof} material={isGreenMinibus ? materials.minibusGreen : materials.minibusRed} />
                    <mesh position={[0, 2.0, 3.4]} geometry={geometries.minibusDestBox} material={materials.minibusSignPlastic} />
                    <mesh position={[0, 1.6, 0.2]} geometry={geometries.minibusWindows} material={materials.vehicleWindow} />
                    <mesh position={[0, 0.4, 3.7]} geometry={geometries.bumper} scale={[1.1, 1, 1]} material={materials.vehicleBumper} />
                    <mesh position={[0, 0.4, -3.7]} geometry={geometries.bumper} scale={[1.1, 1, 1]} material={materials.vehicleBumper} />
                    
                    <mesh position={[1.2, 1.4, 2.5]} geometry={geometries.vehicleMirror} material={materials.vehicleMirror} />
                    <mesh position={[-1.2, 1.4, 2.5]} geometry={geometries.vehicleMirror} material={materials.vehicleMirror} />

                    <mesh position={[0.8, 0.6, 3.75]} geometry={geometries.vehicleLight} material={materials.vehicleLight} />
                    <mesh position={[-0.8, 0.6, 3.75]} geometry={geometries.vehicleLight} material={materials.vehicleLight} />
                    <mesh position={[0.8, 0.6, -3.75]} geometry={geometries.vehicleLight} material={materials.vehicleTailLight} />
                    <mesh position={[-0.8, 0.6, -3.75]} geometry={geometries.vehicleLight} material={materials.vehicleTailLight} />
                    <mesh position={[-1.0, 0.4, 2.2]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[1.0, 0.4, 2.2]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[-1.0, 0.4, -2.2]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[1.0, 0.4, -2.2]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                </group>
            )}
            
            {obs.type === 'taxi' && (
                <group position={[0, 0, 0]}>
                    <mesh position={[0, 0.6, 0]} geometry={geometries.taxiBody} material={materials.taxiRed} castShadow />
                    <mesh position={[0, 1.15, -0.2]} geometry={geometries.taxiCabin} material={materials.taxiSilver} castShadow />
                    <mesh position={[0, 1.15, -0.2]} scale={[1.02, 0.9, 1.02]} geometry={geometries.taxiCabin} material={materials.vehicleWindow} /> 
                    <mesh position={[0, 0.5, 2.41]} geometry={geometries.taxiGrille} material={materials.vehicleBumper} />

                    <mesh position={[0, 0.35, 2.45]} geometry={geometries.licensePlate} material={materials.licensePlateWhite} />
                    <mesh position={[0, 0.35, -2.45]} geometry={geometries.licensePlate} material={materials.licensePlateWhite} />

                    <group position={[0, 1.55, 0.2]}>
                        <mesh geometry={geometries.taxiSign} material={materials.taxiSign} />
                    </group>
                    
                    <mesh position={[-0.4, 1.0, 0.9]} rotation-x={-0.2} geometry={geometries.taxiFlag} material={materials.signPlasticRed} />

                    <mesh position={[0, 0.3, 2.35]} geometry={geometries.bumper} material={materials.vehicleBumper} />
                    <mesh position={[0, 0.3, -2.35]} geometry={geometries.bumper} material={materials.vehicleBumper} />
                    
                    <mesh position={[1.05, 1.0, 1.2]} geometry={geometries.vehicleMirror} material={materials.vehicleMirror} />
                    <mesh position={[-1.05, 1.0, 1.2]} geometry={geometries.vehicleMirror} material={materials.vehicleMirror} />

                    <mesh position={[0.75, 0.65, 2.3]} geometry={geometries.vehicleLight} material={materials.vehicleLight} />
                    <mesh position={[-0.75, 0.65, 2.3]} geometry={geometries.vehicleLight} material={materials.vehicleLight} />
                    <mesh position={[0.75, 0.65, -2.3]} geometry={geometries.vehicleLight} material={materials.vehicleTailLight} />
                    <mesh position={[-0.75, 0.65, -2.3]} geometry={geometries.vehicleLight} material={materials.vehicleTailLight} />
                    
                    <mesh position={[0.75, 0.65, 5.0]} rotation-x={Math.PI/2} geometry={geometries.lightBeam} material={materials.lightBeam} />
                    <mesh position={[-0.75, 0.65, 5.0]} rotation-x={Math.PI/2} geometry={geometries.lightBeam} material={materials.lightBeam} />

                    <mesh position={[-0.9, 0.35, 1.5]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[0.9, 0.35, 1.5]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[-0.9, 0.35, -1.5]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[0.9, 0.35, -1.5]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                </group>
            )}

            {obs.type === 'ambulance' && (
                <group position={[0, 0, 0]}>
                    <mesh position={[0, 1.6, -1.0]} geometry={geometries.sprinterBody} material={obs.variant === 'white' ? materials.ambulanceWhite : materials.ambulanceYellow} castShadow />
                    <mesh position={[0, 1.2, -1.0]} geometry={geometries.sprinterStripeBody} material={materials.minibusRed} />
                    <mesh position={[0, 1.3, 1.6]} geometry={geometries.sprinterCab} material={obs.variant === 'white' ? materials.ambulanceWhite : materials.ambulanceYellow} castShadow />
                    <mesh position={[0, 1.0, 1.6]} geometry={geometries.sprinterStripeCab} material={materials.minibusRed} />
                    <mesh position={[0, 1.6, 1.8]} geometry={geometries.minibusWindows} scale={[0.88, 0.8, 0.25]} material={materials.vehicleWindow} />
                    <mesh position={[0, 0.9, 2.7]} geometry={geometries.sprinterHood} material={obs.variant === 'white' ? materials.ambulanceWhite : materials.ambulanceYellow} castShadow />
                    <mesh position={[0, 0.9, 3.11]} geometry={geometries.sprinterGrille} material={materials.vehicleBumper} />
                    <mesh position={[0, 1.45, 2.6]} rotation-x={-0.4} geometry={geometries.minibusDestBox} scale={[1.4, 0.8, 1]} material={obs.variant === 'white' ? materials.ambulanceTextWhite : materials.ambulanceTextYellow} />
                    <mesh position={[0, 0.4, 3.1]} geometry={geometries.bumper} scale={[1.05, 1, 1]} material={materials.vehicleBumper} />
                    <mesh position={[0, 0.4, -2.8]} geometry={geometries.bumper} scale={[1.15, 1, 1]} material={materials.vehicleBumper} />
                    <mesh position={[1.0, 2.5, -2.7]} geometry={geometries.vehicleLight} material={materials.lightBlue} />
                    <mesh position={[-1.0, 2.5, -2.7]} geometry={geometries.vehicleLight} material={materials.lightRed} />
                    <mesh position={[1.0, 2.5, 0.7]} geometry={geometries.vehicleLight} material={materials.lightBlue} />
                    <mesh position={[-1.0, 2.5, 0.7]} geometry={geometries.vehicleLight} material={materials.lightRed} />
                    <mesh position={[0, 2.2, 1.4]} geometry={geometries.vehicleLight} scale={[3, 0.8, 0.8]} material={materials.lightBlue} />
                    <mesh position={[0.8, 0.8, 3.15]} geometry={geometries.vehicleLight} material={materials.vehicleLight} />
                    <mesh position={[-0.8, 0.8, 3.15]} geometry={geometries.vehicleLight} material={materials.vehicleLight} />
                    <mesh position={[0.8, 0.6, -2.85]} geometry={geometries.vehicleLight} material={materials.vehicleTailLight} />
                    <mesh position={[-0.8, 0.6, -2.85]} geometry={geometries.vehicleLight} material={materials.vehicleTailLight} />
                    <mesh position={[-1.0, 0.4, 1.8]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[1.0, 0.4, 1.8]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[-1.0, 0.4, -2.0]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                    <mesh position={[1.0, 0.4, -2.0]} rotation-z={Math.PI/2} geometry={geometries.vehicleWheel} material={materials.vehicleWheel} />
                </group>
            )}

            {obs.type === 'trashbin' && (
                <group position={[0, 0.7, 0]}>
                    <mesh geometry={geometries.trashBinBody} material={materials.binOrange} castShadow />
                    <mesh position={[0, 0.5, 0]} geometry={geometries.trashBinTop} material={materials.binOrange} />
                    <mesh position={[0, 0.7, 0]} geometry={geometries.trashBinAsh} material={materials.binMetal} />
                    <mesh position={[0, 0.3, 0.42]} geometry={geometries.trashBinHole} material={materials.binBlack} />
                </group>
            )}

            {obs.type === 'waterhorse' && (
                <group position={[0, 0.7, 0]}>
                    <mesh geometry={geometries.waterhorseBody} material={Math.random() > 0.5 ? materials.waterhorseRed : materials.waterhorseWhite} castShadow />
                    <mesh position={[0, -0.4, 0]} geometry={geometries.waterhorseBase} material={materials.binBlack} />
                </group>
            )}

            {obs.type === 'scaffold' && (
                <group position={[0, 3.0, 0]} rotation-y={wobble}>
                    <mesh position={[-0.9, 0, 0]} rotation-z={0.02} geometry={geometries.bambooPole} scale={[1.2, 8, 1.2]} material={materials.bamboo} castShadow />
                    <mesh position={[0.9, 0, 0]} rotation-z={-0.02} geometry={geometries.bambooPole} scale={[1.2, 8, 1.2]} material={materials.bamboo} castShadow />
                    <mesh position={[0, 3.0, 0]} rotation-z={Math.PI/2} geometry={geometries.bambooPole} scale={[1, 3.5, 1]} material={materials.bamboo} castShadow />
                    <mesh position={[0, 1.0, 0]} rotation-z={Math.PI/2 + 0.05} geometry={geometries.bambooPole} scale={[1, 3.5, 1]} material={materials.bamboo} castShadow />
                    <mesh position={[0, -1.8, 0]} rotation-z={Math.PI/2 - 0.02} geometry={geometries.bambooPole} scale={[1, 3.5, 1]} material={materials.bamboo} castShadow />
                    <mesh position={[0, 0.5, 0]} rotation-z={Math.PI/4} geometry={geometries.bambooPole} scale={[1, 9, 1]} material={materials.bamboo} castShadow />
                    <mesh position={[-0.9, 1.0, 0]} geometry={geometries.bambooTie} material={materials.scaffoldTie} />
                    <mesh position={[0.9, 1.0, 0]} geometry={geometries.bambooTie} material={materials.scaffoldTie} />
                    <mesh position={[-0.9, -1.8, 0]} geometry={geometries.bambooTie} material={materials.scaffoldTie} />
                    <mesh position={[0.9, -1.8, 0]} geometry={geometries.bambooTie} material={materials.scaffoldTie} />
                </group>
            )}
            
            {obs.type === 'neon_sign' && (
                <group position={[0, 2.5, 0]}>
                    <mesh geometry={geometries.neonFrame} material={materials.binMetal} />
                    <mesh position={[0, 0, 0.1]} geometry={geometries.neonTubes} material={materials.neonPink} />
                    <mesh position={[0, 0, -0.1]} geometry={geometries.neonTubes} material={materials.neonBlue} />
                </group>
            )}

            {obs.type === 'traffic_cone' && (
                <group position={[0, 0.5, 0]}>
                     <mesh geometry={geometries.coneBody} material={materials.coneOrange} castShadow />
                     <mesh position={[0, 0.15, 0]} scale={[1.02, 0.25, 1.02]} geometry={geometries.coneBody} material={materials.retroReflective} />
                     <mesh position={[0, -0.5, 0]} geometry={geometries.coneBase} material={materials.binBlack} />
                </group>
            )}
             {obs.type === 'foambox' && (
                 <group position={[0, 0.5, 0]}>
                     <mesh geometry={geometries.box} scale={[1.2, 0.8, 1.5]} material={materials.foamWhite} castShadow />
                     <mesh position={[0, 0.41, 0]} geometry={geometries.tape} material={materials.tapeBrown} />
                 </group>
             )}
             {obs.type === 'puddle' && <mesh rotation-x={-Math.PI/2} position={[0, 0.02, 0]} geometry={geometries.puddle} material={materials.water} />}
             {obs.type === 'barrier' && (
                 <group position={[0, 0.6, 0]}>
                     <mesh geometry={geometries.barrier} material={materials.barrierMetal} castShadow />
                     <mesh position={[-1.1, -0.5, 0]} geometry={geometries.barrierLeg} material={materials.binMetal} />
                     <mesh position={[1.1, -0.5, 0]} geometry={geometries.barrierLeg} material={materials.binMetal} />
                </group>
             )}
             {obs.type === 'rock' && <mesh position={[0, 0.55, 0]} geometry={geometries.rock} material={materials.rockGray} castShadow />}
             {obs.type === 'pedestrian' && (
                <group position={[0, 0.8, 0]}>
                    <mesh position={[0, 0.65, 0]} geometry={geometries.pedHead} material={materials.pedSkin} castShadow />
                    <mesh position={[0, 0, 0]} geometry={geometries.pedBody} material={Math.random() > 0.5 ? materials.pedShirtWhite : materials.pedShirtBlue} castShadow />
                    <mesh position={[0.2, 0.1, 0.25]} rotation={[0.5, 0, -0.5]} scale={[0.1, 0.4, 0.1]} geometry={geometries.pedBody} material={Math.random() > 0.5 ? materials.pedShirtWhite : materials.pedShirtBlue} />
                    <mesh position={[-0.2, 0.1, 0.25]} rotation={[0.5, 0, 0.5]} scale={[0.1, 0.4, 0.1]} geometry={geometries.pedBody} material={Math.random() > 0.5 ? materials.pedShirtWhite : materials.pedShirtBlue} />
                    <group position={[0, 0.3, 0.4]} rotation-x={-0.5}>
                        <mesh geometry={geometries.phone} material={materials.phoneCase} />
                        <mesh position={[0, 0, 0.015]} scale={[0.9, 0.9, 1]} geometry={geometries.phone} material={materials.phoneScreen} />
                    </group>
                    <mesh position={[-0.15, -0.6, 0]} geometry={geometries.pedLeg} material={materials.pedPantsBlack} />
                    <mesh position={[0.15, -0.6, 0]} geometry={geometries.pedLeg} material={materials.pedPantsBlack} />
                </group>
            )}
             {obs.type === 'bird' && (
                <group position={[0, 3.0, 0]} rotation-y={obs.moveDirection ? (obs.moveDirection > 0 ? -Math.PI/2 : Math.PI/2) : 0}>
                     <mesh geometry={geometries.birdBody} material={materials.magpieBlack} castShadow />
                     <mesh position={[0, 0.2, 0.2]} geometry={geometries.birdHead} material={materials.magpieBlack} />
                     <mesh position={[0, 0.2, 0.35]} rotation-x={Math.PI/2} geometry={geometries.birdBeak} material={materials.magpieBlack} />
                     <mesh position={[0, 0.1, -0.3]} geometry={geometries.birdTail} material={materials.magpieBlack} />
                     <mesh position={[0.3, 0.1, 0]} geometry={geometries.birdWing} material={materials.magpieBlue} />
                     <mesh position={[-0.3, 0.1, 0]} geometry={geometries.birdWing} material={materials.magpieBlue} />
                     <mesh position={[0, -0.2, 0]} geometry={geometries.birdBody} scale={[0.8, 0.5, 0.8]} material={materials.magpieWhite} />
                </group>
            )}
            
            {Math.random() > 0.7 && (
                <mesh position={[Math.random() - 0.5, 0.02, Math.random() * 2]} rotation={trashRot}>
                    <planeGeometry args={[0.3, 0.4]} />
                    <meshStandardMaterial color="#cccccc" side={THREE.DoubleSide} transparent opacity={0.8} />
                </mesh>
            )}
        </group>
    );
});

const CoinMesh = React.memo(({ coin, segZ, offsetRef, materials, geometries }: { coin: CoinData, segZ: number, offsetRef: React.MutableRefObject<number>, materials: any, geometries: any }) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        
        groupRef.current.rotation.y += delta * 3;

        if (coin.isAttracted && coin.posX !== undefined && coin.posY !== undefined && coin.posZ !== undefined) {
             const localX = coin.posX;
             const localY = coin.posY;
             const localZ = coin.posZ - offsetRef.current - segZ;
             
             groupRef.current.position.set(localX, localY, localZ);
             
             if (coin.scale !== undefined) {
                 groupRef.current.scale.setScalar(coin.scale);
             }
        } else {
             const x = LANES[coin.lane + 1] ?? 0;
             const y = 1.2;
             const z = coin.z;
             groupRef.current.position.set(x, y, z);
             groupRef.current.position.y = y + Math.sin(state.clock.elapsedTime * 5 + x) * 0.2;
             
             // Ensure scale is reset for pooled or new coins
             if (groupRef.current.scale.x !== 1 && !coin.isAttracted) groupRef.current.scale.setScalar(1);
        }
    });

    const isBun = coin.type === 'bun';
    const isLemonTea = coin.type === 'lemontea';
    const isMagnet = coin.type === 'magnet';

    return (
        <group ref={groupRef}>
            {isBun && (
                <group scale={[1.5, 1.5, 1.5]}>
                    <mesh geometry={geometries.bunBase} material={materials.bunDough} castShadow />
                    <mesh geometry={geometries.bunCrust} material={materials.bunCrust} castShadow />
                </group>
            )}
            {isLemonTea && (
                <group scale={[1.8, 1.8, 1.8]}>
                    <mesh geometry={geometries.juiceBox} material={materials.lemonTeaBox} castShadow />
                    <mesh position={[0.05, 0.3, 0]} rotation-z={-0.2} geometry={geometries.straw} material={materials.strawWhite} />
                </group>
            )}
            {isMagnet && (
                <group scale={[1.5, 1.5, 1.5]}>
                    <mesh geometry={geometries.magnetArch} material={materials.magnetRed} castShadow />
                    <mesh position={[-0.3, -0.15, 0]} geometry={geometries.magnetCap} material={materials.magnetSilver} castShadow />
                    <mesh position={[0.3, -0.15, 0]} geometry={geometries.magnetCap} material={materials.magnetSilver} castShadow />
                </group>
            )}
        </group>
    );
});

const TrackManager: React.FC<TrackManagerProps> = ({ gameId, speed, gameStatus, playerRef, playerState, currentScoreRef, onCollision, onPuddle, onCoinCollected, onObstacleClash, onRegionChange, isInvincible, isPoweredUp, isMagnetActive, magnetRange, quality }) => {
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const segmentsGroupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(0);
  const nextSpawnOffsetRef = useRef(0);
  const segmentsDataRef = useRef<SegmentData[]>([]);
  const currentRegionIdRef = useRef<RegionId>(RegionId.SHAM_SHUI_PO); 
  const segmentsSinceTransitionRef = useRef(0);
  const SEGMENTS_PER_REGION = 15; 
  
  // Callbacks Refs to avoid stale closures in useFrame
  const onCollisionRef = useRef(onCollision);
  const onPuddleRef = useRef(onPuddle);
  const onCoinCollectedRef = useRef(onCoinCollected);
  const onObstacleClashRef = useRef(onObstacleClash);

  useEffect(() => {
      onCollisionRef.current = onCollision;
      onPuddleRef.current = onPuddle;
      onCoinCollectedRef.current = onCoinCollected;
      onObstacleClashRef.current = onObstacleClash;
  }, [onCollision, onPuddle, onCoinCollected, onObstacleClash]);

  // Ambulance Spawn logic vars
  const distanceSinceLastAmbulanceRef = useRef(0);
  const nextAmbulanceDistanceRef = useRef(2000 + Math.random() * 500);

  const geometries = useMemo(() => ({
      plane: new THREE.PlaneGeometry(30, SEGMENT_LENGTH),
      planeWide: new THREE.PlaneGeometry(40, SEGMENT_LENGTH),
      sidewalk: new THREE.BoxGeometry(8, 1, SEGMENT_LENGTH),
      railing: new THREE.BoxGeometry(0.1, 1.2, 1),
      building: new THREE.BoxGeometry(1, 1, 1),
      acUnit: new THREE.BoxGeometry(0.8, 0.5, 0.5),
      box: new THREE.BoxGeometry(1, 1, 1),
      stallTop: new THREE.BoxGeometry(3.2, 0.2, 2.2),
      pole: new THREE.CylinderGeometry(0.1, 0.1, 1, 8),
      treeTop: new THREE.DodecahedronGeometry(1.5),
      lampHead: new THREE.BoxGeometry(1, 0.2, 0.4),
      
      minibusBody: new THREE.BoxGeometry(2.2, 1.5, 7),
      minibusRoof: new THREE.BoxGeometry(2.1, 0.1, 6.8),
      minibusStripe: new THREE.BoxGeometry(2.25, 0.2, 7.1),
      minibusDestBox: new THREE.BoxGeometry(1.2, 0.4, 0.2),
      minibusWindows: new THREE.BoxGeometry(2.3, 0.6, 6),
      bumper: new THREE.BoxGeometry(2.0, 0.3, 0.2),
      vehicleLight: new THREE.BoxGeometry(0.4, 0.2, 0.1),
      vehicleWheel: new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16),
      vehicleMirror: new THREE.BoxGeometry(0.1, 0.2, 0.1),
      lightBeam: new THREE.ConeGeometry(0.5, 6, 32, 1, true),
      
      taxiBody: new THREE.BoxGeometry(2.1, 0.9, 4.8),
      taxiCabin: new THREE.BoxGeometry(1.95, 0.6, 2.2),
      taxiSign: new THREE.BoxGeometry(0.9, 0.35, 0.3),
      taxiGrille: new THREE.BoxGeometry(1.6, 0.3, 0.1),
      taxiFlag: new THREE.BoxGeometry(0.25, 0.15, 0.02),
      licensePlate: new THREE.BoxGeometry(0.8, 0.2, 0.05),

      // Sprinter Ambulance Geometries
      sprinterBody: new THREE.BoxGeometry(2.3, 2.3, 3.6), 
      sprinterCab: new THREE.BoxGeometry(2.1, 1.7, 1.4), 
      sprinterHood: new THREE.BoxGeometry(2.1, 1.0, 0.8),
      sprinterStripeBody: new THREE.BoxGeometry(2.35, 0.25, 3.65), 
      sprinterStripeCab: new THREE.BoxGeometry(2.15, 0.25, 1.45),
      sprinterGrille: new THREE.BoxGeometry(1.8, 0.3, 0.05),
      
      trashBinBody: new THREE.CylinderGeometry(0.42, 0.36, 1.0, 8),
      trashBinTop: new THREE.SphereGeometry(0.43, 8, 8, 0, Math.PI * 2, 0, Math.PI/2),
      trashBinAsh: new THREE.CylinderGeometry(0.18, 0.18, 0.05, 8),
      trashBinHole: new THREE.BoxGeometry(0.35, 0.25, 0.12),
      waterhorseBody: new THREE.BoxGeometry(1.5, 1.0, 0.5),
      waterhorseBase: new THREE.BoxGeometry(1.7, 0.25, 0.7),
      bambooPole: new THREE.CylinderGeometry(0.04, 0.04, 1, 6),
      bambooTie: new THREE.SphereGeometry(0.06, 6, 6),
      neonFrame: new THREE.BoxGeometry(2, 2, 0.1),
      neonTubes: new THREE.TorusGeometry(0.8, 0.05, 4, 16),
      coneBody: new THREE.ConeGeometry(0.32, 1.0, 16),
      coneBase: new THREE.BoxGeometry(0.75, 0.05, 0.75),
      puddle: new THREE.CircleGeometry(0.8, 8),
      barrier: new THREE.BoxGeometry(2.8, 1.0, 0.12),
      barrierLeg: new THREE.BoxGeometry(0.12, 0.6, 0.6),
      rock: new THREE.DodecahedronGeometry(0.55),
      tape: new THREE.BoxGeometry(1.21, 0.15, 1.51),
      
      pedHead: new THREE.SphereGeometry(0.15, 8, 8),
      pedBody: new THREE.BoxGeometry(0.35, 0.6, 0.2),
      pedLeg: new THREE.BoxGeometry(0.12, 0.7, 0.12),
      phone: new THREE.BoxGeometry(0.12, 0.2, 0.02),
      
      birdBody: new THREE.SphereGeometry(0.15, 8, 8),
      birdHead: new THREE.SphereGeometry(0.1, 8, 8),
      birdBeak: new THREE.ConeGeometry(0.03, 0.1, 8),
      birdTail: new THREE.BoxGeometry(0.15, 0.05, 0.3),
      birdWing: new THREE.BoxGeometry(0.4, 0.05, 0.2),
      
      bunBase: new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI*2, 0, Math.PI/1.5),
      bunCrust: new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI*2, 0, Math.PI/2.5),
      juiceBox: new THREE.BoxGeometry(0.3, 0.5, 0.2),
      straw: new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8),
      magnetArch: new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI),
      magnetCap: new THREE.BoxGeometry(0.18, 0.18, 0.18),
  }), []);

  // ... (rest of TrackManager logic remains unchanged)
  // Re-pasting buildingMaterials and materials hooks for completeness of the file update
  const buildingMaterials = useMemo(() => {
      return {
          tonglau1: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('tonglau', 0)),
          tonglau2: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('tonglau', 1)),
          tonglau3: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('tonglau', 2)),
          commercial1: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('commercial', 0)),
          commercial2: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('commercial', 1)),
          glass1: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('glass', 0)),
          glass2: new THREE.MeshStandardMaterial(generateBuildingMaterialProps('glass', 1)),
      };
  }, []);

  const materials = useMemo(() => {
    const roadProps = generateRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
        map: roadProps.map,
        roughness: 1.0, 
        metalness: 0.0, 
        envMapIntensity: 0.0,
        color: new THREE.Color("#999999") 
    });

    return {
      asphalt: roadMat,
      concrete: new THREE.MeshStandardMaterial({ color: "#bbbbbb", roughness: 1.0, bumpScale: 0.05, metalness: 0.0, envMapIntensity: 0.0 }), 
      sidewalkDirty: new THREE.MeshStandardMaterial({ color: "#888888", roughness: 1.0, envMapIntensity: 0.0 }),
      sidewalkClean: new THREE.MeshStandardMaterial({ color: "#aaaaaa", roughness: 1.0, envMapIntensity: 0.0 }),
      sidewalkGrass: new THREE.MeshStandardMaterial({ color: "#166534", roughness: 1.0 }),
      
      buildingDark: new THREE.MeshStandardMaterial({ color: "#1c1917", roughness: 0.9 }),
      
      minibusCream: new THREE.MeshPhysicalMaterial({ color: "#fffdd0", roughness: 0.2, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
      minibusRed: new THREE.MeshPhysicalMaterial({ color: "#b91c1c", roughness: 0.3, metalness: 0.1, clearcoat: 0.6 }),
      minibusGreen: new THREE.MeshPhysicalMaterial({ color: "#166534", roughness: 0.3, metalness: 0.1, clearcoat: 0.6 }), 
      minibusSignPlastic: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 1.5 }), 

      taxiRed: new THREE.MeshPhysicalMaterial({ color: "#b91c1c", roughness: 0.1, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05 }), 
      taxiSilver: new THREE.MeshPhysicalMaterial({ color: "#c0c0c0", roughness: 0.2, metalness: 0.6, clearcoat: 0.8 }), 
      taxiSign: new THREE.MeshStandardMaterial({ map: createTaxiTexture(), emissive: "#ffffff", emissiveIntensity: 0.5, roughness: 0.2 }),
      lightBeam: new THREE.MeshBasicMaterial({ color: "#fffbeb", transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),

      // Ambulance Materials
      ambulanceYellow: new THREE.MeshPhysicalMaterial({ color: "#facc15", roughness: 0.2, metalness: 0.1, clearcoat: 0.8 }),
      ambulanceWhite: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.2, metalness: 0.1, clearcoat: 0.8 }),
      ambulanceTextYellow: new THREE.MeshStandardMaterial({ map: createAmbulanceTexture('yellow'), emissive: "#ffffff", emissiveIntensity: 0.8, roughness: 0.2 }),
      ambulanceTextWhite: new THREE.MeshStandardMaterial({ map: createAmbulanceTexture('white'), emissive: "#ffffff", emissiveIntensity: 0.8, roughness: 0.2 }),

      lightRed: new THREE.MeshStandardMaterial({ color: "#ff0000", emissive: "#ff0000", emissiveIntensity: 3.0 }),
      lightBlue: new THREE.MeshStandardMaterial({ color: "#0000ff", emissive: "#0000ff", emissiveIntensity: 3.0 }),

      vehicleWindow: new THREE.MeshPhysicalMaterial({ color: "#050505", roughness: 0.0, metalness: 0.9, transmission: 0.1, opacity: 1.0 }),
      vehicleWheel: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.8 }),
      vehicleMirror: new THREE.MeshStandardMaterial({ color: "#cccccc", roughness: 0.2, metalness: 0.8 }), 
      vehicleLight: new THREE.MeshStandardMaterial({ color: "#fffbeb", emissive: "#fffbeb", emissiveIntensity: 3.0 }),
      vehicleTailLight: new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#ef4444", emissiveIntensity: 2.0 }),
      vehicleBumper: new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.8, metalness: 0.1 }),
      licensePlateWhite: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }),

      binOrange: new THREE.MeshStandardMaterial({ color: "#ea580c", roughness: 0.4 }), 
      binBlack: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.8 }),
      binMetal: new THREE.MeshStandardMaterial({ color: "#9ca3af", metalness: 0.8, roughness: 0.3 }),
      
      coneOrange: new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.5 }),
      coneBase: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.9 }),
      retroReflective: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.5 }),
      
      bamboo: new THREE.MeshStandardMaterial({ color: "#d4a017", roughness: 0.6, bumpScale: 0.1 }), 
      scaffoldTie: new THREE.MeshStandardMaterial({ color: "#000000", roughness: 1.0 }), 
      
      foamWhite: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, emissive: "#eeeeee", emissiveIntensity: 0.1 }), 
      tapeBrown: new THREE.MeshStandardMaterial({ color: "#a16207", roughness: 0.6 }), 
      water: new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.7 }),
      
      pole: new THREE.MeshStandardMaterial({ color: "#333333", metalness: 0.5, roughness: 0.4 }),
      paperbox: new THREE.MeshStandardMaterial({ color: "#b08d57", roughness: 1.0 }),
      
      signPlasticRed: new THREE.MeshStandardMaterial({ color: "#b91c1c", roughness: 0.4, emissive: "#b91c1c", emissiveIntensity: 0.2 }),
      
      barrierRed: new THREE.MeshStandardMaterial({ color: "#b91c1c", roughness: 0.2 }),
      barrierWhite: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2 }),
      barrierMetal: new THREE.MeshStandardMaterial({ color: "#9ca3af", roughness: 0.4, metalness: 0.6 }),
      
      magnetRed: new THREE.MeshStandardMaterial({ color: "#ef4444", metalness: 0.6, roughness: 0.2 }),
      magnetSilver: new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.8, roughness: 0.1 }),
      
      waterhorseRed: new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.3 }),
      waterhorseWhite: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.3 }),
      
      stallCanvas: new THREE.MeshStandardMaterial({ color: "#15803d", side: THREE.DoubleSide, roughness: 0.9 }),
      stallCanvasBlue: new THREE.MeshStandardMaterial({ color: "#1d4ed8", side: THREE.DoubleSide, roughness: 0.9 }),
      
      neonPink: new THREE.MeshStandardMaterial({ color: "#ff00ff", emissive: "#ff00ff", emissiveIntensity: 4.0 }),
      neonBlue: new THREE.MeshStandardMaterial({ color: "#00ffff", emissive: "#00ffff", emissiveIntensity: 4.0 }),
      
      rockGray: new THREE.MeshStandardMaterial({ color: "#57534e", roughness: 1.0 }),
      treeTrunk: new THREE.MeshStandardMaterial({ color: "#451a03" }),
      treeLeaves: new THREE.MeshStandardMaterial({ color: "#14532d" }),
      railingGreen: new THREE.MeshStandardMaterial({ color: "#064e3b", metalness: 0.2 }),
      
      pedSkin: new THREE.MeshStandardMaterial({ color: "#e0ac69" }),
      pedShirtWhite: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
      pedShirtBlue: new THREE.MeshStandardMaterial({ color: "#3b82f6" }),
      pedPantsBlack: new THREE.MeshStandardMaterial({ color: "#1f2937" }),
      phoneScreen: new THREE.MeshStandardMaterial({ color: "#93c5fd", emissive: "#60a5fa", emissiveIntensity: 1.5 }),
      phoneCase: new THREE.MeshStandardMaterial({ color: "#111111" }),
      
      magpieBlack: new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.7 }),
      magpieBlue: new THREE.MeshStandardMaterial({ color: "#1d4ed8", roughness: 0.6 }),
      magpieWhite: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 }),
      
      lemonTeaBox: new THREE.MeshStandardMaterial({ color: "#fbbf24", emissive: "#f59e0b", emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.1 }), 
      strawWhite: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
      bunDough: new THREE.MeshStandardMaterial({ color: "#fde68a", roughness: 0.8 }),
      bunCrust: new THREE.MeshStandardMaterial({ color: "#d97706", roughness: 0.4 }),
      
      pipeGrey: new THREE.MeshStandardMaterial({ color: "#666666", metalness: 0.4 }),
      acUnit: new THREE.MeshStandardMaterial({ color: "#cccccc", metalness: 0.3 }),
    };
  }, []);

  useEffect(() => {
    if (gameId > 0) {
        offsetRef.current = 0;
        nextSpawnOffsetRef.current = SEGMENT_LENGTH;
        segmentsSinceTransitionRef.current = 0;
        currentRegionIdRef.current = RegionId.SHAM_SHUI_PO;
        
        distanceSinceLastAmbulanceRef.current = 0;
        nextAmbulanceDistanceRef.current = 2000 + Math.random() * 500;

        if (onRegionChange) onRegionChange(RegionId.SHAM_SHUI_PO);

        const initial: SegmentData[] = [];
        for (let i = -1; i < VISIBLE_SEGMENTS; i++) {
          initial.push(createSegment(-(i * SEGMENT_LENGTH), i <= 1, 0, currentRegionIdRef.current));
        }
        segmentsDataRef.current = initial;
        setSegments(initial);
    } else if (segments.length === 0) {
        const initial: SegmentData[] = [];
        for (let i = -1; i < VISIBLE_SEGMENTS; i++) {
          initial.push(createSegment(-(i * SEGMENT_LENGTH), true, 0, currentRegionIdRef.current));
        }
        segmentsDataRef.current = initial;
        setSegments(initial);
    }
  }, [gameId]);

  const getNextRegion = (current: RegionId): RegionId => {
      const config = REGIONS_DATA[current];
      const rand = Math.random();
      let cumulativeWeight = 0;
      for (const next of config.nextRegions) {
          cumulativeWeight += next.weight;
          if (rand <= cumulativeWeight) return next.id;
      }
      return config.nextRegions[0].id;
  };

  function createSegment(z: number, isEmpty: boolean = false, scoreAtCreation: number, regionId: RegionId): SegmentData {
    const regionConfig = REGIONS_DATA[regionId];
    const obstacles: ObstacleData[] = [];
    const coins: CoinData[] = [];
    const decorations: DecorationData[] = [];
    const occupiedSlots = new Set<string>();

    const loops = Math.floor(SEGMENT_LENGTH / 10);

    for (let i = 0; i < loops; i++) {
        const decorZ = -(i * 10) - 5;
        const sides = [-1, 1];

        sides.forEach(sideDir => {
             const id = Math.random().toString();
             
             switch (regionId) {
                 case RegionId.MONG_KOK:
                     const mkBuildingOffset = 16;
                     const mkMat = Math.random() > 0.5 ? 'commercial1' : 'commercial2';
                     decorations.push({
                         id: id + 'b',
                         x: sideDir * mkBuildingOffset,
                         z: decorZ,
                         type: 'building',
                         height: 40 + Math.random() * 30, 
                         width: 10 + Math.random() * 4,
                         color: mkMat
                     });
                     if (Math.random() > 0.4) {
                        decorations.push({
                            id: id + 'n',
                            x: sideDir * (mkBuildingOffset - 3),
                            z: decorZ,
                            type: 'neon',
                            height: 2,
                            width: 3,
                            color: Math.random() > 0.5 ? 'neonPink' : 'neonBlue',
                            rotation: sideDir > 0 ? -0.1 : 0.1
                        });
                     }
                     break;

                 case RegionId.SHAM_SHUI_PO:
                     const sspBuildingOffset = 15;
                     const sspRand = Math.random();
                     const sspMat = sspRand > 0.66 ? 'tonglau1' : sspRand > 0.33 ? 'tonglau2' : 'tonglau3';
                     
                     decorations.push({
                         id: id + 'b',
                         x: sideDir * sspBuildingOffset,
                         z: decorZ,
                         type: 'building',
                         height: 20 + Math.random() * 15,
                         width: 8 + Math.random() * 2,
                         color: sspMat
                     });
                     
                     if (Math.random() > 0.3) {
                         decorations.push({
                             id: id + 'ac',
                             x: sideDir * (sspBuildingOffset - 4.5),
                             y: 5 + Math.random() * 10,
                             z: decorZ + (Math.random() - 0.5) * 5,
                             type: 'aircon',
                             height: 0, width: 0, color: 'acUnit'
                         });
                     }

                     if (Math.random() > 0.4) {
                         const signData = HK_SIGNS[Math.floor(Math.random() * HK_SIGNS.length)];
                         const colors = ['signPlasticRed', 'signPlasticWhite', 'signPlasticGreen', 'signPlasticYellow'];
                         const signColor = colors[Math.floor(Math.random() * colors.length)];
                         const textColor = (signColor === 'signPlasticWhite' || signColor === 'signPlasticYellow') ? '#b91c1c' : '#ffffff';
                         const signW = 3.5 + Math.random(); 
                         const signH = signData.v ? (4 + Math.random() * 2) : (1.5 + Math.random()); 
                         decorations.push({
                             id: id + 'sb',
                             x: sideDir * 8.5, 
                             y: 6 + Math.random() * 8, 
                             z: decorZ + (Math.random() * 2 - 1),
                             type: 'sign_board',
                             height: signH, 
                             width: signW, 
                             color: signColor,
                             text: signData.text,
                             textColor: textColor,
                             isVertical: signData.v
                         });
                     }
                     if (Math.random() > 0.5) {
                         decorations.push({
                             id: id + 's',
                             x: sideDir * 10, 
                             z: decorZ + 2,
                             type: 'stall',
                             height: 3,
                             width: 4,
                             color: Math.random() > 0.5 ? 'stallCanvas' : 'stallCanvasBlue'
                         });
                     }
                     break;

                 case RegionId.CENTRAL:
                     const centralBuildingOffset = 20; 
                     const centralMat = Math.random() > 0.5 ? 'glass1' : 'glass2';
                     decorations.push({
                         id: id + 'b',
                         x: sideDir * centralBuildingOffset,
                         z: decorZ,
                         type: 'building',
                         height: 70 + Math.random() * 40, 
                         width: 15 + Math.random() * 5,
                         color: centralMat
                     });
                     if (i % 2 === 0) {
                        decorations.push({
                             id: id + 'p',
                             x: sideDir * 9, 
                             z: decorZ,
                             type: 'pole',
                             height: 6,
                             width: 0,
                             color: 'pole'
                         });
                     }
                     break;

                 case RegionId.THE_PEAK:
                     const peakTreeOffset = 19;
                     if (Math.random() > 0.2) {
                         decorations.push({
                             id: id + 't',
                             x: sideDir * (peakTreeOffset + Math.random() * 5),
                             z: decorZ + Math.random() * 5,
                             type: 'tree',
                             height: 10 + Math.random() * 8, 
                             width: 0,
                             color: 'treeLeaves'
                         });
                     }
                     decorations.push({
                         id: id + 'r',
                         x: sideDir * 7.5, 
                         z: decorZ,
                         type: 'building', 
                         height: 0, 
                         width: 0,
                         color: 'railingGreen' 
                     });
                     break;
             }
        });
    }

    if (!isEmpty) {
        // --- Special Event: Ambulance Spawn ---
        let spawnAmbulance = false;
        if (distanceSinceLastAmbulanceRef.current >= nextAmbulanceDistanceRef.current) {
            spawnAmbulance = true;
            distanceSinceLastAmbulanceRef.current = 0;
            nextAmbulanceDistanceRef.current = 2000 + Math.random() * 500;
        }

        if (spawnAmbulance) {
            const lane = (Math.floor(Math.random() * 3) - 1) as Lane;
            const oz = -25; // Center of segment
            obstacles.push({
                id: `ambulance_${Math.random()}`,
                lane: lane,
                z: oz,
                type: 'ambulance',
                variant: Math.random() > 0.5 ? 'white' : 'yellow', // Randomize variant
            });
            occupiedSlots.add(`${lane}_${oz}`);
            occupiedSlots.add(`${lane}_${oz-5}`);
            occupiedSlots.add(`${lane}_${oz+5}`);
        }

        const globalDifficulty = Math.min(1.0, scoreAtCreation / 5000); 
        let availableTypes: ObstacleData['type'][] = ['barrier'];
        let density = 0.3 + (globalDifficulty * 0.15);

        switch (regionId) {
            case RegionId.MONG_KOK:
                availableTypes = ['minibus', 'waterhorse', 'neon_sign', 'barrier'];
                density = 0.45 + (globalDifficulty * 0.15);
                break;
            case RegionId.SHAM_SHUI_PO:
                availableTypes = ['foambox', 'trashbin', 'scaffold']; 
                density = 0.4 + (globalDifficulty * 0.15);
                break;
            case RegionId.CENTRAL:
                availableTypes = ['taxi', 'traffic_cone', 'waterhorse'];
                density = 0.35 + (globalDifficulty * 0.15);
                break;
            case RegionId.THE_PEAK:
                availableTypes = ['rock', 'puddle', 'barrier', 'bird']; 
                density = 0.35 + (globalDifficulty * 0.15);
                break;
        }

        const obstacleZSteps = [-12, -27, -42]; 
        
        obstacleZSteps.forEach(oz => {
            // Horizontal Birds in The Peak
            if (regionId === RegionId.THE_PEAK && Math.random() < 0.5) { // Increased density from 0.2 to 0.5
                 const direction = Math.random() > 0.5 ? 1 : -1;
                 const startX = direction === 1 ? -25 : 25; // Widened start pos for faster entry
                 if (!occupiedSlots.has(`any_${oz}`)) {
                     obstacles.push({
                         id: Math.random().toString(),
                         lane: 0,
                         z: oz,
                         type: 'bird',
                         customX: startX,
                         moveDirection: direction,
                         moveSpeed: 20 + Math.random() * 15 // Increased speed from 10-15 to 20-35
                     });
                     occupiedSlots.add(`any_${oz}`);
                     return;
                 }
            }

            if (regionId === RegionId.MONG_KOK && Math.random() < 0.15) { 
                const direction = Math.random() > 0.5 ? 1 : -1;
                const startX = direction === 1 ? -9 : 9; 
                const speedVar = 2.5 + Math.random() * 2.5; 
                
                if (!occupiedSlots.has(`any_${oz}`)) {
                    obstacles.push({
                        id: Math.random().toString(),
                        lane: 0, 
                        z: oz,
                        type: 'pedestrian',
                        customX: startX,
                        moveSpeed: speedVar,
                        moveDirection: direction
                    });
                    occupiedSlots.add(`any_${oz}`); 
                    return; 
                }
            }

            if (Math.random() < density) {
                const lane = (Math.floor(Math.random() * 3) - 1) as Lane;
                const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                
                // Bird logic handled above, so skip bird here unless it's a fallback
                if (type === 'bird') return;

                if (!occupiedSlots.has(`${lane}_${oz}`) && !occupiedSlots.has(`any_${oz}`)) {
                    obstacles.push({ 
                        id: Math.random().toString(), 
                        lane, 
                        z: oz, 
                        type, 
                        label: type === 'minibus' ? '旺角' : type === 'taxi' ? 'TAXI' : undefined
                    });
                    
                    occupiedSlots.add(`${lane}_${oz}`);
                    if (['minibus', 'taxi', 'waterhorse', 'barrier', 'scaffold'].includes(type)) {
                        occupiedSlots.add(`${lane}_${oz - 5}`);
                        occupiedSlots.add(`${lane}_${oz + 5}`);
                    }
                }
            }
        });

        for (let j = 0; j < 6; j++) {
            const cz = -5 - (j * 8);
            const lane = (Math.floor(Math.random() * 3) - 1) as Lane;
            if (!occupiedSlots.has(`${lane}_${cz}`) && !occupiedSlots.has(`any_${cz}`)) {
                const rand = Math.random();
                let type: ItemType = 'bun';
                if (rand > 0.96) type = 'magnet';
                else if (rand > 0.92) type = 'lemontea';
                coins.push({ id: Math.random().toString(), lane, z: cz, collected: false, type, isAttracted: false, scale: 1 });
                occupiedSlots.add(`${lane}_${cz}`);
            }
        }
    }
    return { id: Math.random().toString(), z, region: regionId, obstacles, coins, decorations };
  }

  useFrame((state, delta) => {
    if (gameStatus !== GameStatus.PLAYING) {
        Synth.stopSiren();
        return;
    }
    const dt = delta * 60;
    const moveStep = speed * dt;
    offsetRef.current += moveStep;
    
    if (materials.asphalt && materials.asphalt.map) {
        materials.asphalt.map.offset.y -= moveStep * 0.02; 
    }

    if (segmentsGroupRef.current) segmentsGroupRef.current.position.z = offsetRef.current;

    if (offsetRef.current >= nextSpawnOffsetRef.current) {
      nextSpawnOffsetRef.current += SEGMENT_LENGTH;
      segmentsSinceTransitionRef.current += 1;
      
      // Update distance tracker for ambulance
      distanceSinceLastAmbulanceRef.current += SEGMENT_LENGTH;

      if (segmentsSinceTransitionRef.current >= SEGMENTS_PER_REGION) {
          const nextRegion = getNextRegion(currentRegionIdRef.current);
          if (nextRegion !== currentRegionIdRef.current) {
              currentRegionIdRef.current = nextRegion;
              segmentsSinceTransitionRef.current = 0;
              if (onRegionChange) onRegionChange(nextRegion);
          }
      }
      const lastSegmentZ = segmentsDataRef.current[segmentsDataRef.current.length - 1].z;
      const newSegmentZ = lastSegmentZ - SEGMENT_LENGTH;
      const nextSegments = [...segmentsDataRef.current.slice(1)];
      // Use ref.current to get the up-to-date score without re-rendering
      nextSegments.push(createSegment(newSegmentZ, false, currentScoreRef.current, currentRegionIdRef.current));
      segmentsDataRef.current = nextSegments;
      setSegments(nextSegments);
    }

    const px = playerRef.current?.position.x || 0;
    const py = playerRef.current?.position.y || 0;
    const playerTargetY = py + 1.4;

    let isAmbulanceActive = false;

    segmentsDataRef.current.forEach(seg => {
      const segWorldZ = seg.z + offsetRef.current;
      if (segWorldZ > 100 || segWorldZ < -200) return;

      seg.obstacles.forEach(obs => {
          if (obs.isHit) return;

          // Check if ambulance is nearby to play sound
          if (obs.type === 'ambulance') {
             const obsZ = segWorldZ + obs.z;
             if (obsZ > -100 && obsZ < 50) {
                 isAmbulanceActive = true;
             }
          }

          if ((obs.type === 'pedestrian' || obs.type === 'bird') && obs.customX !== undefined && obs.moveDirection && obs.moveSpeed) {
              if (segWorldZ < 80 && segWorldZ > -100) {
                 obs.customX += obs.moveDirection * obs.moveSpeed * delta;
              }
          }

          if (obs.type === 'minibus' || obs.type === 'taxi') {
              const vehicleSpeed = obs.type === 'taxi' ? 15 : 8; 
              obs.z += vehicleSpeed * delta;
          }
          
          if (obs.type === 'ambulance') {
              // Ambulance moves faster than taxi
              const vehicleSpeed = 25; 
              obs.z += vehicleSpeed * delta;
          }

          const obsX = obs.customX ?? (LANES[obs.lane + 1] ?? 0);
          const obsZ = segWorldZ + obs.z;
          const dx = Math.abs(obsX - px);
          const dz = Math.abs(obsZ - PLAYER_Z);
          
          let hitDistZ = 0.8; 
          if (obs.type === 'minibus' || obs.type === 'ambulance') {
             hitDistZ = 3.8; 
          } else if (['taxi', 'waterhorse'].includes(obs.type)) {
             hitDistZ = 2.2;
          } else {
             hitDistZ = Math.max(0.8, speed * 0.7); 
          }
          const hitDistX = (obs.type === 'pedestrian' || obs.type === 'bird') ? 1.0 : 1.4;

          if (dz < hitDistZ && dx < hitDistX) {
              if (obs.type === 'puddle') {
                  if (py < 0.4) {
                      Synth.playSplash();
                      onPuddleRef.current(new THREE.Vector3(obsX, 0, obsZ));
                  }
              } else if (obs.type === 'bird') {
                  if (!isInvincible && py > 1.8) {
                      obs.isHit = true;
                      Synth.playBirdHit();
                      obs.hitVelocity = new THREE.Vector3(0, 5, -20);
                      obs.hitRotation = new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0);
                      obs.hitTime = 0;
                      onObstacleClashRef.current(new THREE.Vector3(obsX, 3.0, obsZ));
                      onCollisionRef.current();
                  }
              } else if (obs.type === 'ambulance') {
                  // Special logic: Ambulance is UNBREAKABLE
                  // It forces a collision event regardless of invincibility
                  // It does NOT get knocked away
                  Synth.playMetalHit(); // Or a heavy crash sound
                  onCollisionRef.current(); 
                  // Do NOT set obs.isHit = true;
              } else {
                  if (isInvincible) {
                      obs.isHit = true;
                      if (obs.type === 'pedestrian') {
                          Synth.playScream();
                      } else if (['minibus', 'taxi', 'trashbin', 'barrier'].includes(obs.type)) {
                          Synth.playMetalHit();
                      } else if (['waterhorse', 'traffic_cone', 'neon_sign'].includes(obs.type)) {
                          Synth.playPlasticHit();
                      } else {
                          Synth.playWoodHit();
                      }
                      obs.hitVelocity = new THREE.Vector3((Math.random() - 0.5) * 20, 15 + Math.random() * 10, -40 - speed * 30);
                      obs.hitRotation = new THREE.Vector3(Math.random() * 15, Math.random() * 15, Math.random() * 15);
                      obs.hitTime = 0;
                      onObstacleClashRef.current(new THREE.Vector3(obsX, 1.5, obsZ));
                  } else {
                      let hit = false;
                      if (obs.type === 'scaffold' && playerState !== PlayerState.SLIDING) hit = true;
                      else if (obs.type === 'barrier' && py < 1.1) hit = true;
                      else if ((['minibus', 'taxi', 'waterhorse'].includes(obs.type)) && py < 2.0) hit = true;
                      else if (obs.type === 'neon_sign') hit = true;
                      else if ((['foambox', 'rock', 'traffic_cone'].includes(obs.type)) && py < 1.6) hit = true;
                      else if (obs.type === 'trashbin' && py < 1.4) hit = true;
                      else if (obs.type === 'pedestrian' && py < 1.6) hit = true;

                      if (hit) {
                          if (obs.type === 'pedestrian') Synth.playScream();
                          else if (['minibus', 'taxi', 'trashbin', 'barrier'].includes(obs.type)) Synth.playMetalHit();
                          else if (['waterhorse', 'traffic_cone', 'neon_sign'].includes(obs.type)) Synth.playPlasticHit();
                          else Synth.playWoodHit();

                          onCollisionRef.current();
                          obs.isHit = true;
                      }
                  }
              }
          }
      });

      seg.coins.forEach(coin => {
          if (coin.collected) return;
          let coinWorldX = 0, coinWorldY = 0, coinWorldZ = 0;
          if (coin.isAttracted) {
              if (coin.posX === undefined) {
                  coin.posX = LANES[coin.lane + 1] ?? 0;
                  coin.posY = 1.2; 
                  coin.posZ = segWorldZ + coin.z; 
                  coin.velocity = new THREE.Vector3(0, 0, 0);
                  coin.attractionTime = 0;
              }
              coin.posZ += moveStep; 
              coin.attractionTime = (coin.attractionTime || 0) + delta;
              if (coin.attractionTime > 0.1) {
                  coin.collected = true;
                  onCoinCollectedRef.current(coin.type, new THREE.Vector3(coin.posX, coin.posY, coin.posZ));
                  return; 
              }
              const cX = coin.posX ?? 0;
              const cY = coin.posY ?? 1.2;
              const cZ = coin.posZ ?? segWorldZ + coin.z;
              const dist = Math.sqrt(Math.pow(cX - px, 2) + Math.pow(cY - playerTargetY, 2) + Math.pow(cZ - PLAYER_Z, 2));
              const pullForce = 0.5 + (1 - Math.min(dist / magnetRange, 1)) * 2.0;
              const targetDir = new THREE.Vector3(px - cX, playerTargetY - cY, PLAYER_Z - cZ).normalize();
              if (coin.velocity) {
                coin.velocity.addScaledVector(targetDir, pullForce * dt);
                coin.velocity.multiplyScalar(0.9);
                if (coin.posX !== undefined) {
                    coin.posX += coin.velocity.x * dt; 
                    coin.posY = (coin.posY || 1.2) + coin.velocity.y * dt; 
                    coin.posZ = (coin.posZ || 0) + coin.velocity.z * dt;
                }
              }
              coin.scale = THREE.MathUtils.lerp(coin.scale || 1, 0.1, 0.4 * dt);
              coinWorldX = coin.posX!; coinWorldY = coin.posY!; coinWorldZ = coin.posZ!;
          } else {
              coinWorldX = LANES[coin.lane + 1] ?? 0; 
              coinWorldY = 1.2; 
              coinWorldZ = segWorldZ + coin.z;
          }
          const rawDist = Math.sqrt(Math.pow(coinWorldX - px, 2) + Math.pow(coinWorldY - playerTargetY, 2) + Math.pow(coinWorldZ - PLAYER_Z, 2));
          const isPlayerAtCollectionHeight = py < 1.2;
          const verticalThreshold = isPoweredUp ? 5.0 : (1.8 + (coin.isAttracted ? 0.8 : 0));
          if (!coin.isAttracted && isMagnetActive && ['bun', 'lemontea'].includes(coin.type) && rawDist < magnetRange && (isPlayerAtCollectionHeight || isPoweredUp)) {
              coin.isAttracted = true;
          }
          const magnetBonus = coin.isAttracted ? 0.8 : 0; 
          const dx = Math.abs(coinWorldX - px); 
          const dy = Math.abs(coinWorldY - playerTargetY); 
          const dz = Math.abs(coinWorldZ - PLAYER_Z);
          
          const isSpecialItem = ['lemontea', 'magnet'].includes(coin.type);
          let hitRadiusX = 1.2 + magnetBonus;
          let hitRadiusZ = 1.0 + magnetBonus;

          if (coin.type === 'magnet') {
              hitRadiusX = 1.0;
              hitRadiusZ = 1.0;
          } else if (coin.type === 'lemontea') {
              hitRadiusX = 1.8;
              hitRadiusZ = 1.8;
          }

          const hitRadiusY = isSpecialItem ? 3.0 : verticalThreshold;
          if (dx < hitRadiusX && dy < hitRadiusY && dz < (hitRadiusZ + moveStep)) {
              if (isSpecialItem || isPlayerAtCollectionHeight || coin.isAttracted || isPoweredUp) {
                  coin.collected = true;
                  onCoinCollectedRef.current(coin.type, new THREE.Vector3(coinWorldX, coinWorldY, coinWorldZ));
              }
          }
      });
    });
    
    // Manage Siren Sound based on active ambulances
    if (isAmbulanceActive) {
        Synth.startSiren();
    } else {
        Synth.stopSiren();
    }

  });

  return (
    <group ref={segmentsGroupRef}>
      {segments.map(seg => {
        const sidewalkX = seg.region === RegionId.THE_PEAK ? 16 : 11;
        return (
        <group key={seg.id} position={[0, 0, seg.z]}>
          <mesh rotation-x={-Math.PI / 2} geometry={seg.region === RegionId.CENTRAL ? geometries.planeWide : geometries.plane} material={seg.region === RegionId.CENTRAL ? materials.concrete : materials.asphalt} />
          <mesh position={[-sidewalkX, 0.2, -25]} geometry={geometries.sidewalk} material={seg.region === RegionId.THE_PEAK ? materials.sidewalkGrass : seg.region === RegionId.CENTRAL ? materials.sidewalkClean : materials.sidewalkDirty} />
          <mesh position={[sidewalkX, 0.2, -25]} geometry={geometries.sidewalk} material={seg.region === RegionId.THE_PEAK ? materials.sidewalkGrass : seg.region === RegionId.CENTRAL ? materials.sidewalkClean : materials.sidewalkDirty} />
          
          {seg.decorations.map(d => (
            <group key={d.id}>
                {d.color === 'railingGreen' ? (
                     <group position={[d.x, d.y ?? d.height / 2, d.z]} rotation-y={d.rotation || 0}>
                         <group position={[0, -d.height/2 + 0.5, 0]}>
                             <mesh geometry={geometries.railing} scale={[1, 1, 10]} rotation-y={0} material={materials.railingGreen} castShadow />
                         </group>
                     </group>
                ) : d.type === 'building' ? (
                     <group position={[d.x, d.y ?? d.height / 2, d.z]} rotation-y={d.rotation || 0}>
                        <mesh scale={[d.width, d.height, 10]} geometry={geometries.building} material={buildingMaterials[d.color as keyof typeof buildingMaterials] || materials.buildingDark} />
                     </group>
                ) : d.type === 'aircon' ? (
                     <mesh position={[d.x, d.y ?? 5, d.z]} geometry={geometries.acUnit} material={materials.acUnit} castShadow />
                ) : d.type === 'stall' ? (
                    <group position={[d.x, d.y ?? d.height / 2, d.z]} rotation-y={d.rotation || 0}>
                        <group position={[0, -d.height/2 + 1.5, 0]}>
                            <mesh geometry={geometries.box} scale={[3, 2, 2]} material={materials.paperbox} castShadow />
                            <mesh position={[0, 1.5, 0]} rotation-z={0.1} geometry={geometries.stallTop} material={(materials as any)[d.color]} />
                        </group>
                    </group>
                ) : d.type === 'neon' ? (
                     <SignMesh decoration={d} />
                ) : d.type === 'sign_board' ? (
                     <SignMesh decoration={d} />
                ) : d.type === 'tree' ? (
                     <group position={[d.x, d.y ?? d.height / 2, d.z]} rotation-y={d.rotation || 0}>
                        <group position={[0, -d.height/2, 0]}>
                            <mesh geometry={geometries.pole} scale={[2, 1, 2]} material={materials.treeTrunk} castShadow />
                            <mesh position={[0, 3, 0]} scale={[1.2, 1.2, 1.2]} geometry={geometries.treeTop} material={materials.treeLeaves} castShadow />
                            <mesh position={[0, 4.5, 0]} scale={[0.8, 0.8, 0.8]} geometry={geometries.treeTop} material={materials.treeLeaves} castShadow />
                        </group>
                     </group>
                ) : d.type === 'pole' ? (
                     <group position={[d.x, d.y ?? d.height / 2, d.z]} rotation-y={d.rotation || 0}>
                        <mesh position={[0, -d.height / 2, 0]} geometry={geometries.pole} material={materials.pole} />
                        <group position={[0, 0.5, 0]}>
                             <mesh position={[-0.5, 0, 0]} geometry={geometries.lampHead} material={materials.pole} />
                             <mesh position={[-0.5, -0.1, 0]} scale={[0.8, 0.1, 1.2]} geometry={geometries.lampHead} material={materials.vehicleLight} />
                        </group>
                     </group>
                ) : (
                     <group position={[d.x, d.y ?? d.height / 2, d.z]} rotation-y={d.rotation || 0}>
                        <mesh position={[0, -d.height / 2, 0]} geometry={geometries.pole} material={materials.pole} />
                     </group>
                )}
            </group>
          ))}

          {seg.obstacles.map(obs => (
            <ObstacleMesh key={obs.id} obs={obs} geometries={geometries} materials={materials} region={seg.region} />
          ))}

          {seg.coins.map(coin => !coin.collected ? (
             <CoinMesh key={coin.id} coin={coin} segZ={seg.z} offsetRef={offsetRef} materials={materials} geometries={geometries} />
          ) : null)}
        </group>
      )})}
    </group>
  );
};

export default TrackManager;
