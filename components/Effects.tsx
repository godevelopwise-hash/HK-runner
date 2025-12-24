import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleData } from '../types';

export const SpeedLines: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 30;
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lines = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 30,
      y: (Math.random() - 0.5) * 15 + 5,
      z: Math.random() * 40 - 20,
      speed: Math.random() * 0.5 + 0.5,
      len: Math.random() * 5 + 5
    }));
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    if (!isActive) {
        meshRef.current.visible = false;
        return;
    }
    meshRef.current.visible = true;

    lines.forEach((line, i) => {
      line.z += line.speed * (delta * 60);
      if (line.z > 10) line.z = -40;

      dummy.position.set(line.x, line.y, line.z);
      dummy.scale.set(0.05, 0.05, line.len);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
};

export const ExplosionSystem: React.FC<{ explosions: ParticleData[], onComplete: (id: number) => void }> = ({ explosions, onComplete }) => {
    return (
        <>
            {explosions.map(ex => {
                // Critical Safety Check: Ensure position exists before rendering
                if (!ex.position) return null;
                return ex.type === 'splash' ? 
                <WaterSplash key={ex.id} position={ex.position} onComplete={() => onComplete(ex.id)} /> :
                <Explosion key={ex.id} data={ex} onComplete={() => onComplete(ex.id)} />
            })}
        </>
    );
};

const WaterSplash: React.FC<{ position: THREE.Vector3, onComplete: () => void }> = ({ position, onComplete }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const [scale, setScale] = useState(0.1);
    const [opacity, setOpacity] = useState(0.8);

    useFrame((state, delta) => {
        setScale(s => s + delta * 10);
        setOpacity(o => o - delta * 2);
        if (opacity <= 0) onComplete();
    });

    if (!position) return null;

    return (
        <mesh position={[position.x, 0.05, position.z]} rotation-x={-Math.PI / 2} ref={ringRef} scale={[scale, scale, 1]}>
            <ringGeometry args={[0.8, 1, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
        </mesh>
    );
};

const Explosion: React.FC<{ data: ParticleData, onComplete: () => void }> = ({ data, onComplete }) => {
    const groupRef = useRef<THREE.Group>(null);
    const materialRef = useRef<THREE.MeshBasicMaterial>(null);
    
    const particles = useMemo(() => {
        if (!data) return [];
        return new Array(data.count).fill(0).map(() => ({
            dir: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize(),
            speed: Math.random() * 0.2 + 0.1,
            scale: Math.random() * 0.3 + 0.1
        }));
    }, [data, data.count]);

    useFrame((state, delta) => {
        if (!groupRef.current || !materialRef.current) return;
        groupRef.current.children.forEach((child, i) => {
            const p = particles[i];
            // Safety check to ensure particle data exists and dir is defined
            if (p && p.dir) {
                child.position.addScaledVector(p.dir, p.speed * (delta * 60));
                child.scale.multiplyScalar(0.9);
            }
        });
        materialRef.current.opacity -= delta * 1.5;
        if (materialRef.current.opacity <= 0) onComplete();
    });

    if (!data || !data.position) return null;

    return (
        <group ref={groupRef} position={data.position}>
            {particles.map((p, i) => (
                <mesh key={i} position={[0,0,0]} scale={[p.scale, p.scale, p.scale]}>
                    <boxGeometry />
                    <meshBasicMaterial ref={materialRef} color={data.color} transparent />
                </mesh>
            ))}
        </group>
    );
}