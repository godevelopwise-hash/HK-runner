
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RegionId } from '../types';

interface DynamicSkyProps {
  currentRegion: RegionId;
}

// Global cache to persist textures across region changes
const skyCache: Record<string, THREE.CanvasTexture> = {};

const generateSkyTexture = (region: RegionId): THREE.CanvasTexture => {
  // Check cache first
  if (skyCache[region]) {
      return skyCache[region];
  }

  // Restored higher resolution for better visual quality
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Helper: Random range
  const random = (min: number, max: number) => Math.random() * (max - min) + min;

  // 1. Draw Sky Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  let buildingColor = '#000000';
  let windowColor = '#ffff00';
  let hasStars = true;

  switch (region) {
    case RegionId.MONG_KOK: // Purple/Pink Neon Night
      gradient.addColorStop(0, '#0f0518'); // Deep purple top
      gradient.addColorStop(0.5, '#2c1a30');
      gradient.addColorStop(1, '#4a1d4a'); // Pinkish bottom
      buildingColor = '#1a0b1e';
      break;
    case RegionId.SHAM_SHUI_PO: // Sunset/Dusk Gritty
      gradient.addColorStop(0, '#1a1008'); // Dark brown top
      gradient.addColorStop(0.4, '#4a2510');
      gradient.addColorStop(1, '#9a4515'); // Orange bottom
      buildingColor = '#1f1308';
      hasStars = false;
      break;
    case RegionId.CENTRAL: // Midnight Blue Modern
      gradient.addColorStop(0, '#020617'); // Black blue top
      gradient.addColorStop(0.6, '#0f172a');
      gradient.addColorStop(1, '#1e293b'); // Navy bottom
      buildingColor = '#0b1121';
      windowColor = '#e0f2fe'; // Cool white windows
      break;
    case RegionId.THE_PEAK: // Green/Foggy Night
      gradient.addColorStop(0, '#020617');
      gradient.addColorStop(0.5, '#064e3b'); // Dark Green
      gradient.addColorStop(1, '#d1fae5'); // Foggy bottom
      buildingColor = '#062c20';
      break;
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw Stars (if applicable)
  if (hasStars) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 150; i++) { // Reduced count
          const x = Math.random() * width;
          const y = Math.random() * (height * 0.6); // Only top 60%
          const size = Math.random() * 1.5;
          ctx.globalAlpha = Math.random() * 0.8 + 0.2;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.globalAlpha = 1.0;
  }

  // 3. Draw Background Layers (Mountains or Far Buildings)
  if (region === RegionId.THE_PEAK) {
      // Draw Hills
      ctx.fillStyle = '#063525'; // Darker green hill
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 50) {
          ctx.lineTo(x, height - 150 - Math.sin(x * 0.01) * 50 - Math.random() * 20);
      }
      ctx.lineTo(width, height);
      ctx.fill();
  } else {
      // Draw Distant City Layer
      ctx.fillStyle = buildingColor;
      ctx.globalAlpha = 0.5;
      const layerHeight = height * 0.7; // Horizon line
      let x = 0;
      while (x < width) {
          const w = random(20, 60);
          const h = random(50, 150);
          ctx.fillRect(x, layerHeight - h, w, h + 300); // +300 to extend down
          x += w - 5; // Slight overlap
      }
      ctx.globalAlpha = 1.0;
  }

  // 4. Draw Foreground Skyline
  const horizonY = height * 0.85; // Lower horizon
  
  if (region === RegionId.THE_PEAK) {
       // Close Trees/Bushes Silhouette
       ctx.fillStyle = '#022c22';
       ctx.beginPath();
       ctx.moveTo(0, height);
       for (let x = 0; x <= width; x += 20) {
           const treeH = random(50, 100);
           ctx.lineTo(x, horizonY - treeH);
           ctx.lineTo(x + 10, horizonY);
       }
       ctx.lineTo(width, height);
       ctx.fill();
  } else {
      // City Skyline
      let x = 0;
      while (x < width) {
          const w = region === RegionId.SHAM_SHUI_PO ? random(40, 80) : random(30, 100);
          const h = region === RegionId.CENTRAL ? random(200, 500) : 
                    region === RegionId.MONG_KOK ? random(100, 300) : random(50, 150);
          
          // Building Body
          ctx.fillStyle = buildingColor;
          ctx.fillRect(x, horizonY - h, w, h + 200);

          // Windows / Lights
          const rows = Math.floor(h / 15);
          const cols = Math.floor(w / 10);
          
          if (region === RegionId.CENTRAL) {
              // Modern Strip Lights
              ctx.fillStyle = windowColor;
              if (Math.random() > 0.5) {
                   // Vertical strip
                   ctx.globalAlpha = 0.3;
                   ctx.fillRect(x + 5, horizonY - h + 5, w - 10, h - 10);
              } else {
                   // Random office lights
                   ctx.globalAlpha = 0.5;
                   for (let r = 0; r < rows; r++) {
                       for (let c = 0; c < cols; c++) {
                           if (Math.random() > 0.7) {
                               ctx.fillRect(x + 2 + c * 10, horizonY - h + 5 + r * 15, 6, 8);
                           }
                       }
                   }
              }
          } else if (region === RegionId.MONG_KOK) {
              // Neon Signs
              ctx.globalAlpha = 0.8;
              if (Math.random() > 0.6) {
                  const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0000'];
                  ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                  ctx.fillRect(x + w/2 - 5, horizonY - h + 10, 10, random(20, 50));
                  ctx.shadowBlur = 10;
                  ctx.shadowColor = ctx.fillStyle;
                  ctx.strokeRect(x + 5, horizonY - h + random(10, h/2), w - 10, 20);
                  ctx.shadowBlur = 0;
              }
              // Windows
              ctx.fillStyle = '#fffec8';
              ctx.globalAlpha = 0.4;
              for (let r = 0; r < rows; r++) {
                 if (Math.random() > 0.6) {
                     ctx.fillRect(x + random(2, w-10), horizonY - h + 5 + r * 15, random(4, 8), random(4, 8));
                 }
              }
          } else {
              // Sham Shui Po (Sparse warm lights)
              ctx.fillStyle = '#ffccaa';
              ctx.globalAlpha = 0.3;
               for (let r = 0; r < rows; r++) {
                 if (Math.random() > 0.8) {
                     ctx.fillRect(x + random(2, w-10), horizonY - h + 5 + r * 15, random(4, 8), random(4, 8));
                 }
              }
          }
          
          ctx.globalAlpha = 1.0;
          x += w - random(0, 5); // Overlap
      }
  }

  // 5. Optimized Atmospheric Noise (Pattern Tiling)
  // Instead of iterating 1024*512 pixels, generate a small 128x128 noise pattern and tile it.
  const noiseSize = 128;
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseSize;
  noiseCanvas.height = noiseSize;
  const noiseCtx = noiseCanvas.getContext('2d');
  
  if (noiseCtx) {
      const imgData = noiseCtx.createImageData(noiseSize, noiseSize);
      const buffer = new Uint32Array(imgData.data.buffer);
      for (let i = 0; i < buffer.length; i++) {
          // Subtle grain: random alpha (0-15) on black pixels
          // Uint32 Little Endian: Alpha, Blue, Green, Red
          const alpha = Math.floor(Math.random() * 15);
          buffer[i] = (alpha << 24); // R=0, G=0, B=0
      }
      noiseCtx.putImageData(imgData, 0, 0);
      
      const pattern = ctx.createPattern(noiseCanvas, 'repeat');
      if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
      }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; // Seamless horizontal
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  // Cache the generated texture
  skyCache[region] = texture;
  
  return texture;
};

const DynamicSky: React.FC<DynamicSkyProps> = ({ currentRegion }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  // Memoize texture generation so it only runs when region changes
  const texture = useMemo(() => {
      return generateSkyTexture(currentRegion);
  }, [currentRegion]);

  useFrame((state, delta) => {
      if (meshRef.current) {
          // Make the skybox follow the camera position (infinite sky illusion)
          meshRef.current.position.x = camera.position.x;
          meshRef.current.position.z = camera.position.z;
          
          // Very slow rotation for dynamic feel
          meshRef.current.rotation.y += delta * 0.02;
      }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]} rotation={[0, Math.PI, 0]}>
        {/* Huge Cylinder acts as a panoramic background */}
        <cylinderGeometry args={[200, 200, 100, 32, 1, true]} />
        <meshBasicMaterial 
            map={texture} 
            side={THREE.BackSide} 
            transparent 
            fog={false} // Important: We want the sky to be visible behind the fog
        />
    </mesh>
  );
};

export default DynamicSky;
