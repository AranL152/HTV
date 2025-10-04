'use client';

import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Terrain from './Terrain';
import Hill from './Hill';
import Stars from './Stars';
import { useDrag } from '@/hooks/useDrag';
import { adjustWeights } from '@/services/api';
import type { TerrainData } from '@/types/terrain';

interface TerrainMapProps {
  terrainData: TerrainData;
  datasetId: string;
  onTerrainUpdate: (data: TerrainData) => void;
}

export default function TerrainMap({ terrainData, datasetId, onTerrainUpdate }: TerrainMapProps) {
  const dragEndRef = useRef<{ hillId: number; newHeight: number } | null>(null);

  const handleHeightChange = (hillId: number, newHeight: number) => {
    const updatedHills = terrainData.hills.map((hill) => {
      if (hill.id === hillId) {
        const clampedHeight = Math.max(0, Math.min(newHeight, hill.originalHeight * 2));
        dragEndRef.current = { hillId, newHeight: clampedHeight };
        return {
          ...hill,
          height: clampedHeight,
          weight: clampedHeight / hill.originalHeight,
        };
      }
      return hill;
    });

    const newHeightData = generateHeightData(updatedHills, terrainData.gridSize);

    onTerrainUpdate({
      ...terrainData,
      hills: updatedHills,
      heightData: newHeightData,
    });
  };

  const { draggingHillId, startDrag, onDragMove, endDrag } = useDrag(handleHeightChange);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingHillId !== null) {
        onDragMove(e.clientY);
      }
    };

    const handleMouseUp = async () => {
      if (draggingHillId !== null && dragEndRef.current) {
        const { hillId, newHeight } = dragEndRef.current;
        const hill = terrainData.hills.find((h) => h.id === hillId);

        if (hill) {
          const weight = newHeight / hill.originalHeight;
          try {
            await adjustWeights(datasetId, { [hillId]: weight });
          } catch (err) {
            console.error('Failed to adjust weights:', err);
          }
        }

        dragEndRef.current = null;
        endDrag();
      }
    };

    if (draggingHillId !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHillId, onDragMove, endDrag, datasetId, terrainData.hills]);

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 80, 100], fov: 50 }}
        shadows
      >
        <color attach="background" args={['#000000']} />
        <Stars />
        <ambientLight intensity={0.2} />
        <directionalLight
          position={[20, 30, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <OrbitControls
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 6}
          enableDamping
          dampingFactor={0.05}
        />
        <Terrain heightData={terrainData.heightData} gridSize={terrainData.gridSize} />
        {terrainData.hills.map((hill) => (
          <Hill
            key={hill.id}
            hill={hill}
            isDragging={draggingHillId === hill.id}
            onDragStart={startDrag}
          />
        ))}
      </Canvas>
    </div>
  );
}

function generateHeightData(hills: { center: [number, number]; height: number; radius: number }[], gridSize: number): number[][] {
  const heightData: number[][] = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(0));

  for (const hill of hills) {
    const [cx, cz] = hill.center;
    const { height, radius } = hill;

    const gridCx = ((cx + 50) / 100) * gridSize;
    const gridCz = ((cz + 50) / 100) * gridSize;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const dist = Math.sqrt((x - gridCx) ** 2 + (z - gridCz) ** 2);
        const contribution = height * Math.exp(-(dist ** 2) / (2 * (radius / 10) ** 2));
        heightData[x][z] += contribution;
      }
    }
  }

  return heightData;
}
