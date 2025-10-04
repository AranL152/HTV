import { useState, useCallback } from 'react';
import type { TerrainData, Hill } from '@/types/terrain';

function generateHeightData(hills: Hill[], gridSize: number): number[][] {
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

interface UseTerrainResult {
  terrainData: TerrainData | null;
  updateHillHeight: (hillId: number, newHeight: number) => void;
  setTerrainData: (data: TerrainData) => void;
}

export function useTerrain(): UseTerrainResult {
  const [terrainData, setTerrainData] = useState<TerrainData | null>(null);

  const updateHillHeight = useCallback(
    (hillId: number, newHeight: number) => {
      if (!terrainData) return;

      const updatedHills = terrainData.hills.map((hill) => {
        if (hill.id === hillId) {
          const clampedHeight = Math.max(0, Math.min(newHeight, hill.originalHeight * 2));
          return {
            ...hill,
            height: clampedHeight,
            weight: clampedHeight / hill.originalHeight,
          };
        }
        return hill;
      });

      const newHeightData = generateHeightData(updatedHills, terrainData.gridSize);

      setTerrainData({
        ...terrainData,
        hills: updatedHills,
        heightData: newHeightData,
      });
    },
    [terrainData]
  );

  return {
    terrainData,
    updateHillHeight,
    setTerrainData,
  };
}
