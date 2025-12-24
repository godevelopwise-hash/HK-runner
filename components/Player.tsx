
import React, { forwardRef, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlayerState, GameStatus, CharacterStyle } from '../types';
import { LANES, JUMP_DURATION, SLIDE_DURATION } from '../constants';
import Synth from '../utils/Synth';

interface PlayerProps {
  gameId?: number;
  state: PlayerState;
  setState: React.Dispatch<React.SetStateAction<PlayerState>>;
  gameStatus: GameStatus;
  isInvincible?: boolean;
  isPoweredUp?: boolean; 
  charStyle?: CharacterStyle;
  onAction?: (action: 'jump' | 'slide') => void;
  isPreview?: boolean; 
}

const JetFlame = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
      const t = state.clock.elapsedTime;
      if (meshRef.current) {
          meshRef.current.scale.y = 1 + Math.sin(t * 60) * 0.2 + Math.cos(t * 20) * 0.1;
          const material = meshRef.current.material as THREE.MeshBasicMaterial;
          material.opacity = 0.7 + Math.sin(t * 45) * 0.2;
      }
      if (glowRef.current) {
          glowRef.current.scale.setScalar(0.8 + Math.sin(t * 30) * 0.1);
      }
  });

  return (
      <group position={[0, -0.45, 0]}>
          <mesh ref={meshRef} position={[0, -0.25, 0]} rotation-x={Math.PI}>
              <coneGeometry args={[0.1, 0.7, 8, 1, true]} />
              <meshBasicMaterial color="#00ffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.1, 0]} rotation-x={Math.PI}>
              <coneGeometry args={[0.05, 0.3, 8]} />
              <meshBasicMaterial color="#ffffff" blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh ref={glowRef} position={[0, -0.1, 0]}>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshBasicMaterial color="#00ffff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <pointLight color="#00ffff" intensity={3} distance={4} decay={2} />
      </group>
  );
};

// Fake blob shadow for the player to ensure grounding without relying on expensive/glitchy road shadows
const BlobShadow = () => {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (ref.current && ref.current.parent) {
            // Keep shadow on the ground (y ~= 0.02) relative to parent which moves up/down
            const parentY = ref.current.parent.position.y;
            ref.current.position.y = 0.02 - parentY;
            
            // Fade out when high
            const opacity = Math.max(0, 0.4 - parentY * 0.15);
            (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
            
            // Scale down when high
            const scale = Math.max(0.5, 1 - parentY * 0.2);
            ref.current.scale.setScalar(scale);
        }
    });
    return (
        <mesh ref={ref} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.35, 32]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.4} depthWrite={false} />
        </mesh>
    );
};

const Player = forwardRef<THREE.Group, PlayerProps>(({ gameId, state, setState, gameStatus, isInvincible, isPoweredUp = false, charStyle, onAction, isPreview = false }, ref) => {
  const [currentLaneIndex, setCurrentLaneIndex] = useState(1);
  const groupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null); 
  
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  const jumpStartTimeRef = useRef<number>(0);
  const touchStartRef = useRef<{x: number, y: number} | null>(null);

  React.useImperativeHandle(ref, () => groupRef.current!);

  useEffect(() => {
    if (!isPreview && gameId && gameId > 0) {
        setCurrentLaneIndex(1);
        if (groupRef.current) {
            groupRef.current.position.set(0, 0, 0);
        }
        setState(PlayerState.RUNNING);
    }
  }, [gameId, setState, isPreview]);

  const moveLeft = useCallback(() => {
    if (gameStatus !== GameStatus.PLAYING || isPreview) return;
    setCurrentLaneIndex((prev) => Math.max(0, prev - 1));
  }, [gameStatus, isPreview]);

  const moveRight = useCallback(() => {
    if (gameStatus !== GameStatus.PLAYING || isPreview) return;
    setCurrentLaneIndex((prev) => Math.min(LANES.length - 1, prev + 1));
  }, [gameStatus, isPreview]);

  const jump = useCallback(() => {
    if (gameStatus !== GameStatus.PLAYING || state !== PlayerState.RUNNING || isPreview) return;
    jumpStartTimeRef.current = performance.now();
    setState(PlayerState.JUMPING);
    Synth.playJump();
    if (onAction) onAction('jump');
    setTimeout(() => {
        setState((prev) => prev === PlayerState.JUMPING ? PlayerState.RUNNING : prev);
    }, JUMP_DURATION);
  }, [gameStatus, state, setState, onAction, isPreview]);

  const slide = useCallback(() => {
    if (gameStatus !== GameStatus.PLAYING || state !== PlayerState.RUNNING || isPreview) return;
    setState(PlayerState.SLIDING);
    Synth.playSlide();
    if (onAction) onAction('slide');
    setTimeout(() => {
        setState((prev) => prev === PlayerState.SLIDING ? PlayerState.RUNNING : prev);
    }, SLIDE_DURATION);
  }, [gameStatus, state, setState, onAction, isPreview]);

  useEffect(() => {
    if (isPreview) return; 

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'a': case 'arrowleft': moveLeft(); break;
        case 'd': case 'arrowright': moveRight(); break;
        case 'w': case 'arrowup': case ' ': jump(); break;
        case 's': case 'arrowdown': case 'shift': slide(); break;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
        if (e.touches && e.touches.length > 0) {
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (!touchStartRef.current) return;
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        
        const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        
        const diffX = touchEnd.x - touchStartRef.current.x;
        const diffY = touchEnd.y - touchStartRef.current.y;
        const minSwipeDistance = 30;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > minSwipeDistance) {
                if (diffX > 0) moveRight();
                else moveLeft();
            }
        } else {
            if (Math.abs(diffY) > minSwipeDistance) {
                if (diffY > 0) slide(); 
                else jump(); 
            }
        }
        touchStartRef.current = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [moveLeft, moveRight, jump, slide, isPreview]);

  const isPanda = charStyle?.outfit === 'panda';
  const isIron = charStyle?.outfit === 'iron';
  const isDestruction = charStyle?.outfit === 'destruction'; 
  const isIronFlight = isPoweredUp && !isPreview && state === PlayerState.RUNNING && isIron;
  const animSpeed = (isPoweredUp && !isIronFlight) ? 22 : 12;

  useFrame((stateCtx, delta) => {
    if (!groupRef.current || !bodyGroupRef.current) return;

    const targetX = isPreview ? 0 : LANES[currentLaneIndex];
    
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.2);

    if (isInvincible && gameStatus === GameStatus.PLAYING) {
      bodyGroupRef.current.visible = Math.floor(stateCtx.clock.elapsedTime * 15) % 2 === 0;
    } else {
      bodyGroupRef.current.visible = true;
    }

    const time = stateCtx.clock.elapsedTime * animSpeed; 
    
    if (state === PlayerState.RUNNING || (gameStatus === GameStatus.MENU) || isPreview) {
        if (isIronFlight) {
            bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(bodyGroupRef.current.rotation.x, -1.2, 0.1); 
            groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 2.0 + Math.sin(time * 0.5) * 0.1, 0.1);
            bodyGroupRef.current.position.y = 0; 
            if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 1.4, 0.1);
            if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 1.4, 0.1);
            if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.2, 0.1);
            if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0.2, 0.1);
            bodyGroupRef.current.rotation.z = Math.sin(time * 0.2) * 0.05;

        } else {
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.7;
            if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.7;
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 0.8;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 0.8;
            
            bodyGroupRef.current.position.y = Math.sin(time * 2) * 0.08;
            bodyGroupRef.current.rotation.y = Math.sin(time) * 0.1; 
            
            if (!isPreview) {
                groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.2);
            }
            const forwardTilt = (isPoweredUp && !isPreview) ? 0.4 : 0.1;
            bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(bodyGroupRef.current.rotation.x, forwardTilt, 0.1);
        }
    }

    if (state === PlayerState.JUMPING) {
        const elapsed = performance.now() - jumpStartTimeRef.current;
        const t = Math.min(elapsed / JUMP_DURATION, 1);
        const jumpHeight = Math.pow(Math.sin(t * Math.PI), 0.8) * 4.2; 
        groupRef.current.position.y = jumpHeight;
        bodyGroupRef.current.rotation.x = -0.3;
        bodyGroupRef.current.rotation.z = Math.sin(t * Math.PI) * 0.1;
    } else if (state === PlayerState.SLIDING) {
        // Corrected sliding position and pose
        bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(bodyGroupRef.current.rotation.x, -Math.PI / 2.5, 0.4);
        bodyGroupRef.current.position.y = THREE.MathUtils.lerp(bodyGroupRef.current.position.y, -0.2, 0.2); // Raised from -0.7 to -0.2 to prevent clipping
        bodyGroupRef.current.scale.y = 0.85; 

        // Pose limbs for slide (Left leg straight, Right leg bent, Arms back)
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 1.4, 0.2);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0.5, 0.2);
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -1.0, 0.1);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -1.0, 0.1);
    } else {
         if (!isIronFlight || state !== PlayerState.RUNNING) {
             bodyGroupRef.current.scale.y = THREE.MathUtils.lerp(bodyGroupRef.current.scale.y, 1, 0.2);
         }
    }
  });

  const materials = useMemo(() => {
    let skinColor = charStyle?.skin || "#e0ac69";
    let shirtColor = charStyle?.shirt || "#ffffff";
    let shortsColor = charStyle?.shorts || "#1e3a8a";
    let hairColor = "#222222";
    
    if (charStyle?.outfit === 'panda') {
        skinColor = "#ffffff"; 
        shirtColor = "#ffffff"; 
        shortsColor = "#111111"; 
        hairColor = "#111111"; 
    } else if (charStyle?.outfit === 'iron') {
        skinColor = "#bf1f1f"; 
        shirtColor = "#bf1f1f"; 
        shortsColor = "#d4af37"; 
        hairColor = "#bf1f1f"; 
    } else if (charStyle?.outfit === 'destruction') {
        skinColor = "#d1d5db"; 
        shirtColor = "#d1d5db"; 
        shortsColor = "#ef4444"; 
        hairColor = "#d1d5db"; 
    }

    return {
      skin: new THREE.MeshStandardMaterial({ color: skinColor }),
      shirt: new THREE.MeshStandardMaterial({ color: shirtColor }),
      shorts: new THREE.MeshStandardMaterial({ color: shortsColor }),
      hair: new THREE.MeshStandardMaterial({ color: hairColor }),
      pandaBlack: new THREE.MeshStandardMaterial({ color: "#111111" }),
      ironGold: new THREE.MeshStandardMaterial({ color: "#d4af37", metalness: 0.8, roughness: 0.2 }),
      ironGlow: new THREE.MeshStandardMaterial({ color: "#00ffff", emissive: "#00ffff", emissiveIntensity: 2.0 }),
      ironRed: new THREE.MeshStandardMaterial({ color: "#991b1b", metalness: 0.5, roughness: 0.4 }),
      ultraSilver: new THREE.MeshStandardMaterial({ color: "#d1d5db", metalness: 0.8, roughness: 0.2 }),
      ultraRed: new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.4 }),
      ultraEyes: new THREE.MeshStandardMaterial({ color: "#fef08a", emissive: "#fef08a", emissiveIntensity: 2.0 }), 
      ultraTimer: new THREE.MeshStandardMaterial({ color: "#3b82f6", emissive: "#3b82f6", emissiveIntensity: 3.0 })
    };
  }, [charStyle]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Fake Shadow Component */}
      <BlobShadow />
      
      <group ref={bodyGroupRef}>
        {isDestruction ? (
            <group position={[0, 2.0, 0]}>
                 <mesh castShadow material={materials.ultraSilver}><sphereGeometry args={[0.28, 16, 16]} /></mesh>
                 <mesh position={[0, 0.2, -0.05]} material={materials.ultraSilver}><boxGeometry args={[0.08, 0.3, 0.3]} /></mesh>
                 <mesh position={[-0.1, 0.05, -0.22]} rotation-z={-0.2} material={materials.ultraEyes} scale={[1,1,0.5]}><sphereGeometry args={[0.08, 16, 16]} /></mesh>
                 <mesh position={[0.1, 0.05, -0.22]} rotation-z={0.2} material={materials.ultraEyes} scale={[1,1,0.5]}><sphereGeometry args={[0.08, 16, 16]} /></mesh>
            </group>
        ) : (
            <mesh position={[0, 1.8, 0]} castShadow material={isIron ? materials.ironRed : materials.skin}><boxGeometry args={[0.35, 0.4, 0.35]} /></mesh>
        )}
        
        {!isDestruction ? (
            isPanda ? (
                <group>
                    <mesh position={[-0.15, 2.05, 0]} castShadow material={materials.pandaBlack}><sphereGeometry args={[0.08]} /></mesh>
                    <mesh position={[0.15, 2.05, 0]} castShadow material={materials.pandaBlack}><sphereGeometry args={[0.08]} /></mesh>
                    <mesh position={[-0.08, 1.85, -0.16]} rotation-y={Math.PI} material={materials.pandaBlack} scale={[1,1,0.2]}><circleGeometry args={[0.04]} /></mesh>
                    <mesh position={[0.08, 1.85, -0.16]} rotation-y={Math.PI} material={materials.pandaBlack} scale={[1,1,0.2]}><circleGeometry args={[0.04]} /></mesh>
                </group>
            ) : isIron ? (
                <group>
                     <mesh position={[0, 2.05, 0]} castShadow material={materials.ironRed}><boxGeometry args={[0.36, 0.15, 0.36]} /></mesh>
                     <mesh position={[-0.08, 1.85, -0.18]} material={materials.ironGlow} scale={[1, 0.2, 1]}><boxGeometry args={[0.06, 0.05, 0.01]} /></mesh>
                     <mesh position={[0.08, 1.85, -0.18]} material={materials.ironGlow} scale={[1, 0.2, 1]}><boxGeometry args={[0.06, 0.05, 0.01]} /></mesh>
                </group>
            ) : (
                 <mesh position={[0, 2.05, 0]} castShadow material={materials.hair}><boxGeometry args={[0.38, 0.15, 0.38]} /></mesh>
            )
        ) : null}

        <mesh position={[0, 1.3, 0]} castShadow material={isDestruction ? materials.ultraSilver : isIron ? materials.ironRed : materials.shirt}><boxGeometry args={[0.5, 0.7, 0.3]} /></mesh>
        
        {isDestruction ? (
            <group position={[0, 1.3, 0]}>
                <mesh position={[0, 0.2, -0.16]} material={materials.ultraRed}><boxGeometry args={[0.4, 0.15, 0.05]} /></mesh>
                <mesh position={[0, 0.2, 0.16]} material={materials.ultraRed}><boxGeometry args={[0.4, 0.15, 0.05]} /></mesh>
                <mesh position={[0, 0.15, -0.18]} rotation-x={Math.PI/2} material={materials.ultraTimer}>
                    <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
                </mesh>
            </group>
        ) : null}

        {isIron ? (
            <group position={[0, 1.38, -0.19]}>
                 <mesh rotation-x={Math.PI/2} material={materials.ironGlow}>
                     <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
                 </mesh>
                 <mesh position={[0, 0, 0.005]} rotation-x={Math.PI/2} material={materials.ironGold}>
                      <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
                 </mesh>
            </group>
        ) : null}

        <mesh position={[0, 0.85, 0]} castShadow material={isDestruction ? materials.ultraRed : isIron ? materials.ironGold : materials.shorts}><boxGeometry args={[0.52, 0.35, 0.32]} /></mesh>

        <group position={[-0.35, 1.55, 0]}>
            <mesh ref={leftArmRef} position={[0, -0.3, 0]} castShadow material={isDestruction ? materials.ultraSilver : isPanda ? materials.pandaBlack : isIron ? materials.ironGold : materials.skin}><boxGeometry args={[0.15, 0.65, 0.15]} /></mesh>
        </group>
        <group position={[0.35, 1.55, 0]}>
            <mesh ref={rightArmRef} position={[0, -0.3, 0]} castShadow material={isDestruction ? materials.ultraSilver : isPanda ? materials.pandaBlack : isIron ? materials.ironGold : materials.skin}><boxGeometry args={[0.15, 0.65, 0.15]} /></mesh>
        </group>

        <group position={[-0.18, 0.7, 0]}>
            <mesh ref={leftLegRef} position={[0, -0.35, 0]} castShadow material={isDestruction ? materials.ultraSilver : isPanda ? materials.pandaBlack : isIron ? materials.ironRed : materials.skin}><boxGeometry args={[0.18, 0.8, 0.18]} /></mesh>
            {isIronFlight ? <JetFlame /> : null}
        </group>
        <group position={[0.18, 0.7, 0]}>
            <mesh ref={rightLegRef} position={[0, -0.35, 0]} castShadow material={isDestruction ? materials.ultraSilver : isPanda ? materials.pandaBlack : isIron ? materials.ironRed : materials.skin}><boxGeometry args={[0.18, 0.8, 0.18]} /></mesh>
            {isIronFlight ? <JetFlame /> : null}
        </group>
      </group>
    </group>
  );
});

export default Player;
