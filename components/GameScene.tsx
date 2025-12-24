
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import Player from './Player';
import TrackManager from './TrackManager';
import DynamicSky from './DynamicSky'; // Import the new component
import { ExplosionSystem, SpeedLines } from './Effects';
import { GameStatus, PlayerState, GameSettings, ItemType, ParticleData, CharacterStyle, Upgrades, RegionId } from '../types';
import { INITIAL_SPEED, MAX_SPEED, POWERUP_DURATION, MAGNET_DURATION, PLAYER_Z, LANES, SPEED_LOG_FACTOR, REGIONS_DATA } from '../constants';
import Synth from '../utils/Synth';

const Chaser = React.forwardRef<THREE.Group, { status: GameStatus, lives: number }>(({ status, lives }, ref) => {
    const leftArm = useRef<THREE.Mesh>(null);
    const rightArm = useRef<THREE.Mesh>(null);
    const leftLeg = useRef<THREE.Mesh>(null);
    const rightLeg = useRef<THREE.Mesh>(null);
    const sirenLeft = useRef<THREE.Mesh>(null);
    const sirenRight = useRef<THREE.Mesh>(null);
    const headVisor = useRef<THREE.Mesh>(null);
    
    const targetZ = useMemo(() => lives >= 2 ? 6 : lives === 1 ? 3.5 : 1.5, [lives]);
    
    useFrame((state) => {
        if (!ref || typeof ref === 'function') return;
        const group = (ref as React.MutableRefObject<THREE.Group>).current;
        if (!group) return;

        if (status === GameStatus.PLAYING) {
            const t = state.clock.elapsedTime * 18;
            
            if (leftArm.current) leftArm.current.rotation.x = Math.sin(t) * 0.8;
            if (rightArm.current) rightArm.current.rotation.x = Math.sin(t + Math.PI) * 0.8;
            if (leftLeg.current) leftLeg.current.rotation.x = Math.sin(t + Math.PI) * 1.0;
            if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(t) * 1.0;
            
            group.position.y = 1.5 + Math.sin(t * 2) * 0.1;
            
            const flashSpeed = 15;
            const isRedOn = Math.sin(state.clock.elapsedTime * flashSpeed) > 0;
            if (sirenLeft.current) {
                (sirenLeft.current.material as THREE.MeshStandardMaterial).emissiveIntensity = isRedOn ? 3 : 0;
            }
            if (sirenRight.current) {
                (sirenRight.current.material as THREE.MeshStandardMaterial).emissiveIntensity = !isRedOn ? 3 : 0;
            }
            if (headVisor.current) {
                (headVisor.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 10) * 0.5;
            }
        }
    });

    const materials = useMemo(() => ({
        armorBlack: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.3, metalness: 0.8 }),
        armorGrey: new THREE.MeshStandardMaterial({ color: "#333333", roughness: 0.5, metalness: 0.5 }),
        visorRed: new THREE.MeshStandardMaterial({ color: "#ff0000", emissive: "#ff0000", emissiveIntensity: 2 }),
        lightRed: new THREE.MeshStandardMaterial({ color: "#ff0000", emissive: "#ff0000", emissiveIntensity: 0 }),
        lightBlue: new THREE.MeshStandardMaterial({ color: "#0000ff", emissive: "#0000ff", emissiveIntensity: 0 }),
        joint: new THREE.MeshStandardMaterial({ color: "#222222" })
    }), []);

    return (
        <group ref={ref} position={[0, 1.5, PLAYER_Z + 5]}>
            <mesh castShadow material={materials.armorBlack} position={[0, 0.2, 0]}>
                <boxGeometry args={[0.6, 0.7, 0.35]} />
            </mesh>
            <mesh castShadow material={materials.armorGrey} position={[0, 0.2, 0.18]}>
                <boxGeometry args={[0.4, 0.5, 0.1]} />
            </mesh>
            <group position={[0, 0.75, 0]}>
                <mesh castShadow material={materials.armorBlack}>
                    <boxGeometry args={[0.35, 0.35, 0.35]} />
                </mesh>
                <mesh ref={headVisor} position={[0, 0.05, -0.16]} material={materials.visorRed}>
                    <boxGeometry args={[0.28, 0.08, 0.05]} />
                </mesh>
                <mesh position={[0, 0.18, -0.05]} material={materials.armorGrey}>
                    <boxGeometry args={[0.36, 0.05, 0.4]} />
                </mesh>
            </group>
            <group position={[-0.35, 0.55, 0]}>
                 <mesh material={materials.armorBlack}><boxGeometry args={[0.15, 0.1, 0.2]} /></mesh>
                 <mesh ref={sirenLeft} position={[0, 0.06, 0]} material={materials.lightRed}><boxGeometry args={[0.12, 0.05, 0.15]} /></mesh>
            </group>
            <group position={[0.35, 0.55, 0]}>
                 <mesh material={materials.armorBlack}><boxGeometry args={[0.15, 0.1, 0.2]} /></mesh>
                 <mesh ref={sirenRight} position={[0, 0.06, 0]} material={materials.lightBlue}><boxGeometry args={[0.12, 0.05, 0.15]} /></mesh>
            </group>
            <group position={[-0.4, 0.45, 0]}>
                <mesh ref={leftArm} position={[0, -0.3, 0]} castShadow material={materials.armorGrey}>
                    <boxGeometry args={[0.18, 0.7, 0.18]} />
                    <mesh position={[0, -0.35, 0.1]} material={materials.armorBlack}><boxGeometry args={[0.2, 0.25, 0.2]} /></mesh>
                </mesh>
            </group>
            <group position={[0.4, 0.45, 0]}>
                <mesh ref={rightArm} position={[0, -0.3, 0]} castShadow material={materials.armorGrey}>
                    <boxGeometry args={[0.18, 0.7, 0.18]} />
                    <mesh position={[0, -0.35, 0.1]} material={materials.armorBlack}><boxGeometry args={[0.2, 0.25, 0.2]} /></mesh>
                </mesh>
            </group>
            <group position={[-0.2, -0.2, 0]}>
                <mesh ref={leftLeg} position={[0, -0.4, 0]} castShadow material={materials.armorBlack}>
                    <boxGeometry args={[0.22, 0.9, 0.22]} />
                </mesh>
            </group>
            <group position={[0.2, -0.2, 0]}>
                <mesh ref={rightLeg} position={[0, -0.4, 0]} castShadow material={materials.armorBlack}>
                    <boxGeometry args={[0.22, 0.9, 0.22]} />
                </mesh>
            </group>
        </group>
    );
});


const GameScene: React.FC<{
  gameId: number;
  status: GameStatus;
  settings: GameSettings;
  charStyle: CharacterStyle;
  upgrades: Upgrades;
  initialBoost: boolean;
  onGameOver: (score: number) => void;
  onWin: (score: number) => void;
  onHit: (score: number) => void;
  lives: number;
  onCoinCollected: (type: ItemType) => void;
  updateScoreUI: (score: number) => void; 
  updatePowerUpUI: (progress: number) => void; // New prop
  setActiveItemType: React.Dispatch<React.SetStateAction<'lemontea' | 'magnet' | 'both' | null>>;
  onRegionChange?: (region: RegionId) => void;
  onObstacleDestroyed?: () => void;
  isEndlessMode: boolean;
}> = ({ gameId, status, settings, charStyle, upgrades, initialBoost, onGameOver, onWin, onHit, lives, onCoinCollected, updateScoreUI, updatePowerUpUI, setActiveItemType, onRegionChange, onObstacleDestroyed, isEndlessMode }) => {
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isInvincible, setIsInvincible] = useState(false);
  const [isMagnetActive, setIsMagnetActive] = useState(false);
  const [isPoweredUp, setIsPoweredUp] = useState(false);
  const [shake, setShake] = useState(0);
  
  const playerRef = useRef<THREE.Group>(null);
  const chaserRef = useRef<THREE.Group>(null);
  const [playerState, setPlayerState] = useState<PlayerState>(PlayerState.RUNNING);
  const { camera, scene } = useThree();
  const [explosions, setExplosions] = useState<ParticleData[]>([]);
  
  const [currentRegion, setCurrentRegion] = useState<RegionId>(RegionId.SHAM_SHUI_PO);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  
  const scoreRef = useRef(0);
  const powerUpTimeLeft = useRef(0);
  const magnetTimeLeft = useRef(0);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      if (isPoweredUp) {
        Synth.updateBGM('POWERUP');
        if (charStyle.outfit === 'iron') {
            Synth.startJetSound();
        } else {
            Synth.stopJetSound();
        }
      } else {
        Synth.updateBGM('PLAYING');
        Synth.stopJetSound();
      }
    } else {
      Synth.updateBGM(status);
      Synth.stopJetSound();
    }
    
    return () => {
        if (status !== GameStatus.PLAYING || !isPoweredUp || charStyle.outfit !== 'iron') {
            Synth.stopJetSound();
        }
    };
  }, [status, isPoweredUp, charStyle.outfit]);

  useEffect(() => {
    if (gameId > 0) {
        camera.position.set(0, 5, 12);
        scoreRef.current = 0;
        if (initialBoost) {
            powerUpTimeLeft.current = POWERUP_DURATION;
            magnetTimeLeft.current = MAGNET_DURATION;
            setIsPoweredUp(true); setIsInvincible(true); setIsMagnetActive(true);
            setActiveItemType('both'); setSpeed(MAX_SPEED * 1.5);
        } else {
            setSpeed(INITIAL_SPEED);
            powerUpTimeLeft.current = 0; magnetTimeLeft.current = 0;
            setIsPoweredUp(false); setIsInvincible(false); setIsMagnetActive(false);
            setActiveItemType(null);
        }
    }
  }, [gameId, initialBoost, camera, setActiveItemType]);

  // Updated Region Atmosphere and Fog Logic
  useEffect(() => {
      if (!scene) return;
      const config = REGIONS_DATA[currentRegion].atmosphere;
      scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);
      
      if (dirLightRef.current) {
          dirLightRef.current.color.set(config.lightColor);
          dirLightRef.current.intensity = config.lightIntensity;
      }
  }, [currentRegion, scene]);

  useEffect(() => {
    Synth.init();
    // Default initial fog
    scene.fog = new THREE.FogExp2('#4a2c4a', 0.015);
  }, [scene]);

  useFrame((state, delta) => {
    if (playerRef.current) {
        const tx = playerRef.current.position.x * 0.4;
        const isFlying = isPoweredUp && charStyle.outfit === 'iron';
        const targetPos = new THREE.Vector3(tx, isFlying ? 6 : 5, 12);
        
        if (status === GameStatus.PLAYING && shake > 0) {
            targetPos.x += (Math.random() - 0.5) * shake;
            targetPos.y += (Math.random() - 0.5) * shake;
            setShake(s => Math.max(0, s - delta * 4));
        }
        camera.position.lerp(targetPos, 0.08);
        camera.lookAt(playerRef.current.position.x * 0.2, 1.5, -20);
    }

    if (chaserRef.current && playerRef.current) {
        chaserRef.current.position.x = THREE.MathUtils.lerp(chaserRef.current.position.x, playerRef.current.position.x, 0.1);
        const baseDist = lives >= 2 ? 6 : lives === 1 ? 3.5 : 1.5; 
        chaserRef.current.position.z = THREE.MathUtils.lerp(chaserRef.current.position.z, PLAYER_Z + baseDist, 0.1);
    }

    if (status !== GameStatus.PLAYING) return;
    
    if (!isEndlessMode && scoreRef.current >= 10000) {
        scoreRef.current = 10000;
        updateScoreUI(10000);
        onWin(10000);
        return;
    }
    
    const deltaMs = delta * 1000;
    
    if (powerUpTimeLeft.current > 0) {
        powerUpTimeLeft.current -= deltaMs;
        if (powerUpTimeLeft.current <= 0) {
            powerUpTimeLeft.current = 0; 
            setIsPoweredUp(false); 
            setIsInvincible(false); 
        }
    }
    if (magnetTimeLeft.current > 0) {
        magnetTimeLeft.current -= deltaMs;
        if (magnetTimeLeft.current <= 0) { magnetTimeLeft.current = 0; setIsMagnetActive(false); }
    }

    const suitBonus = charStyle.outfit === 'iron' ? 3000 : 0;
    const maxPowerTime = POWERUP_DURATION + suitBonus;
    const maxMagnetTime = MAGNET_DURATION + suitBonus;

    const pProgress = powerUpTimeLeft.current / maxPowerTime;
    const mProgress = magnetTimeLeft.current / maxMagnetTime;
    
    if (powerUpTimeLeft.current > 0 && magnetTimeLeft.current > 0) { 
        setActiveItemType('both'); 
        updatePowerUpUI(pProgress); // Use PowerUp progress as dominant
    } else if (powerUpTimeLeft.current > 0) { 
        setActiveItemType('lemontea'); 
        updatePowerUpUI(pProgress);
    } else if (magnetTimeLeft.current > 0) { 
        setActiveItemType('magnet'); 
        updatePowerUpUI(mProgress);
    } else { 
        setActiveItemType(null); 
        updatePowerUpUI(0);
    }

    if (!isPoweredUp) {
        const logSpeed = INITIAL_SPEED + Math.log(Math.max(1, scoreRef.current)) * SPEED_LOG_FACTOR;
        const targetSpeed = Math.min(logSpeed, MAX_SPEED);
        setSpeed(prev => THREE.MathUtils.lerp(prev, targetSpeed, delta * 0.5));
    } else {
        setSpeed(MAX_SPEED * 1.5);
    }

    const scoreIncrement = speed * 22 * delta * 60 * 0.016; 
    scoreRef.current += scoreIncrement;
    
    updateScoreUI(scoreRef.current);
  });

  const handleItemCollected = (type: ItemType, pos: THREE.Vector3) => {
      onCoinCollected(type);
      Synth.playCoin();
      const colors = { bun: '#d97706', lemontea: '#facc15', magnet: '#3b82f6' };
      setExplosions(p => [...p, { id: Math.random(), position: pos, color: (colors as any)[type] || '#fff', count: 15, type: 'spark' }]);
      const durationBonus = charStyle.outfit === 'iron' ? 3000 : 0;
      if (type === 'lemontea') {
          powerUpTimeLeft.current = POWERUP_DURATION + durationBonus; 
          setIsPoweredUp(true); setIsInvincible(true); setSpeed(MAX_SPEED * 1.5);
      } else if (type === 'magnet') {
          magnetTimeLeft.current = MAGNET_DURATION + durationBonus; 
          setIsMagnetActive(true);
      }
  };

  const handleObstacleClash = (pos: THREE.Vector3) => {
      setShake(0.8);
      Synth.playClash();
      setExplosions(p => [...p, { id: Math.random(), position: pos, color: "#ffcc00", count: 20, type: 'spark' }]);
      if (onObstacleDestroyed) onObstacleDestroyed(); 
  };

  const handleRegionChange = (newRegion: RegionId) => {
      setCurrentRegion(newRegion);
      if (onRegionChange) onRegionChange(newRegion);
  };

  return (
    <>
      <ambientLight intensity={0.65} color="#fff5e6" />
      <directionalLight ref={dirLightRef} position={[50, 80, 40]} intensity={2.8} castShadow shadow-mapSize={[1024, 1024]} color="#fff0d0" />
      
      {/* Background System */}
      <DynamicSky currentRegion={currentRegion} />

      {(status === GameStatus.PLAYING || status === GameStatus.GAMEOVER || status === GameStatus.PAUSED) ? (
          <Chaser ref={chaserRef} status={status} lives={lives} />
      ) : null}

      <Player 
        ref={playerRef} 
        gameId={gameId}
        state={playerState} 
        setState={setPlayerState} 
        gameStatus={status} 
        isInvincible={isInvincible} 
        isPoweredUp={isPoweredUp}
        charStyle={charStyle} 
      />
      <TrackManager 
        gameId={gameId}
        speed={speed} 
        gameStatus={status} 
        playerRef={playerRef} 
        playerState={playerState}
        currentScoreRef={scoreRef} 
        onCollision={() => { 
            if (!isInvincible) { 
                setShake(2.5); 
                onHit(scoreRef.current); 
                setIsInvincible(true); 
                setTimeout(() => setIsInvincible(false), 2000); 
            } 
        }} 
        onPuddle={(pos) => setExplosions(p => [...p, { id: Math.random(), position: pos, color: "#ffffff", count: 1, type: 'splash' }])}
        onCoinCollected={handleItemCollected} 
        onObstacleClash={handleObstacleClash}
        onRegionChange={handleRegionChange}
        isInvincible={isInvincible} 
        isPoweredUp={isPoweredUp}
        isMagnetActive={isMagnetActive} 
        magnetRange={upgrades.strongMagnet ? 10 : 5} 
        quality={settings.quality} 
      />
      <ExplosionSystem explosions={explosions} onComplete={id => setExplosions(p => p.filter(e => e.id !== id))} />
      <SpeedLines isActive={isPoweredUp} />

      {settings.quality === 'high' ? (
        <EffectComposer enableNormalPass={false}>
            <Bloom luminanceThreshold={1.1} mipmapBlur intensity={1.5} radius={0.6} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.3} darkness={0.4} />
        </EffectComposer>
      ) : null}
    </>
  );
};

export default GameScene;
