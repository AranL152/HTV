'use client';

import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Hill as HillType } from '@/types/terrain';

interface HillProps {
  hill: HillType;
  isDragging: boolean;
  onDragStart: (hillId: number, clientY: number, height: number) => void;
}

export default function Hill({ hill, isDragging, onDragStart }: HillProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onDragStart(hill.id, e.nativeEvent.clientY, hill.height);
  };

  const worldX = (hill.center[0] / 100) * 200 - 100;
  const worldZ = (hill.center[1] / 100) * 200 - 100;

  const scale = hovered || isDragging ? 1.3 : 1;

  return (
    <group position={[worldX, hill.height, worldZ]}>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        scale={scale}
      >
        <coneGeometry args={[2, 4, 8]} />
        <meshStandardMaterial
          color={hill.color}
          emissive={hovered || isDragging ? hill.color : '#000000'}
          emissiveIntensity={hovered || isDragging ? 0.3 : 0}
        />
      </mesh>

      {(hovered || isDragging) && (
        <Html distanceFactor={10}>
          <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm whitespace-nowrap pointer-events-none">
            <div className="font-semibold">{hill.label}</div>
            <div className="text-gray-400">
              Height: {((hill.height / hill.originalHeight) * 100).toFixed(0)}%
            </div>
            <div className="text-gray-400">Weight: {hill.weight.toFixed(2)}x</div>
            <div className="text-gray-400">Samples: {hill.sampleCount}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
