'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

interface TerrainProps {
  heightData: number[][];
  gridSize: number;
}

export default function Terrain({ heightData, gridSize }: TerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, gridSize - 1, gridSize - 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [gridSize]);

  useEffect(() => {
    if (!meshRef.current || !heightData) return;

    const positions = geometry.attributes.position;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const index = i * gridSize + j;
        const height = heightData[i]?.[j] ?? 0;
        positions.setY(index, height);
      }
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [heightData, geometry, gridSize]);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#cc0000"
        metalness={0.6}
        roughness={0.3}
      />
    </mesh>
  );
}
