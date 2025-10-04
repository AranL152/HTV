"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { WaveformData } from "@/types";

interface WaveformProps {
  datasetId: string;
  initialData: WaveformData;
  onDataUpdate: (data: WaveformData) => void;
  onClusterClick?: (peakId: number) => void;
}

interface HeightMapProps {
  data: WaveformData;
  hoveredPeak: number | null;
  setHoveredPeak: (id: number | null) => void;
}

function HeightMap({ data, hoveredPeak, setHoveredPeak }: HeightMapProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { raycaster, camera, pointer, gl } = useThree();

  // Early return if no data
  if (!data || !data.peaks || data.peaks.length === 0) {
    return null;
  }

  // Reduced grid size to match reference image - fewer vertices
  const gridSize = 50;
  const terrainWidth = 25;
  const terrainDepth = 20;

  // Generate random positions for markers across the plane - centered distribution
  const generateRandomPositions = useCallback(() => {
    const positions = data.peaks.map((peak, index) => {
      // Use peak ID as seed for consistent random positioning
      const seed = peak.id * 12345;

      // Create centered random distribution (closer to 0.5, 0.5)
      const randomX = 0.5 + Math.sin(seed) * 0.3; // 0.2 to 0.8 (centered around 0.5)
      const randomZ = 0.5 + Math.cos(seed * 1.3) * 0.3; // 0.2 to 0.8 (centered around 0.5)

      // Clamp to ensure we stay within bounds
      const clampedX = Math.max(0.1, Math.min(0.9, randomX));
      const clampedZ = Math.max(0.1, Math.min(0.9, randomZ));

      return {
        id: peak.id,
        x: clampedX,
        z: clampedZ,
        peak: peak,
      };
    });

    console.log("Centered random marker positions:", positions);
    return positions;
  }, [data.peaks]);

  // Generate height map from peaks with mountain range characteristics
  const generateHeightMap = useCallback(() => {
    const heights: number[][] = [];
    const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount), 1);

    console.log("Generating mountain range with peaks:", data.peaks.length);
    console.log("Max sample count:", maxSampleCount);

    for (let z = 0; z < gridSize; z++) {
      heights[z] = [];
      for (let x = 0; x < gridSize; x++) {
        const xPos = x / (gridSize - 1);
        const zPos = z / (gridSize - 1);

        // Calculate height based on proximity to peaks
        let totalHeight = 0;
        let totalWeight = 0;

        data.peaks.forEach((peak, index) => {
          const peakX = peak.x;
          const peakZ = 0.5; // Center depth
          const selectedCount = peak.selectedCount ?? peak.sampleCount;
          const peakHeight = selectedCount / maxSampleCount;

          // Distance from this point to the peak
          const distX = (xPos - peakX) * 2;
          const distZ = (zPos - peakZ) * 2;
          const distance = Math.sqrt(distX * distX + distZ * distZ);

          // Stronger falloff for more dramatic mountain peaks
          const falloff = Math.exp(-distance * distance * 2);

          totalHeight += peakHeight * falloff;
          totalWeight += falloff;
        });

        // Add complex mountain range terrain
        const baseHeight =
          Math.sin(xPos * 1.5) * Math.cos(zPos * 1.5) * 0.6 + // Large mountain waves
          Math.sin(xPos * 3) * Math.cos(zPos * 2.5) * 0.4 + // Medium mountain features
          Math.sin(xPos * 6) * Math.cos(zPos * 4) * 0.3 + // Small mountain details
          Math.sin(xPos * 12) * Math.cos(zPos * 8) * 0.2 + // Fine mountain texture
          Math.sin(xPos * 0.8) * Math.cos(zPos * 0.6) * 0.8; // Very large scale mountain ranges

        // Add valleys and ridges for realistic mountain range
        const valleyDepth = Math.cos(xPos * 2) * Math.sin(zPos * 3) * 0.3;
        const ridgeHeight = Math.sin(xPos * 4 + zPos * 2) * 0.4;

        const finalHeight =
          totalWeight > 0
            ? totalHeight / totalWeight + baseHeight + ridgeHeight - valleyDepth
            : baseHeight + ridgeHeight - valleyDepth;

        heights[z][x] = Math.max(0, finalHeight);
      }
    }

    // Debug: log some height values
    const maxHeight = Math.max(...heights.flat());
    const minHeight = Math.min(...heights.flat());
    console.log(
      `Mountain range height: ${minHeight.toFixed(3)} to ${maxHeight.toFixed(
        3
      )}`
    );
    console.log("Height range:", maxHeight - minHeight);

    return heights;
  }, [data.peaks, gridSize]);

  // Calculate terrain height at specific position
  const getTerrainHeightAt = useCallback(
    (xPos: number, zPos: number, heights: number[][]) => {
      // Convert world position to grid coordinates
      const gridX = Math.round(xPos * (gridSize - 1));
      const gridZ = Math.round(zPos * (gridSize - 1));

      // Clamp to grid bounds
      const clampedX = Math.max(0, Math.min(gridSize - 1, gridX));
      const clampedZ = Math.max(0, Math.min(gridSize - 1, gridZ));

      return heights[clampedZ]?.[clampedX] || 0;
    },
    [gridSize]
  );

  // Create geometry from height map
  const geometry = useMemo(() => {
    const heights = generateHeightMap();
    const geo = new THREE.PlaneGeometry(
      terrainWidth,
      terrainDepth,
      gridSize - 1,
      gridSize - 1
    );

    const positions = geo.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      const x = i % gridSize;
      const z = Math.floor(i / gridSize);
      const height = heights[z]?.[x] || 0;

      // Mountain range scaling - dramatic peaks and valleys
      positions[i * 3 + 2] = height * 3; // Slightly reduced for better proportions
    }

    geo.computeVertexNormals();
    return geo;
  }, [generateHeightMap, gridSize, terrainWidth, terrainDepth]);

  // Handle click for tooltips
  const handlePointerClick = useCallback(
    (event: any) => {
      if (!event.point) return;

      const x = event.point.x / terrainWidth + 0.5;
      const z = event.point.z / terrainDepth + 0.5;

      // Find closest peak
      let closestPeak = data.peaks[0];
      let minDist = Math.sqrt(
        Math.pow(x - closestPeak.x, 2) + Math.pow(z - 0.5, 2)
      );

      data.peaks.forEach((peak) => {
        const dist = Math.sqrt(Math.pow(x - peak.x, 2) + Math.pow(z - 0.5, 2));
        if (dist < minDist) {
          minDist = dist;
          closestPeak = peak;
        }
      });

      // Toggle tooltip if close enough to a peak
      if (minDist < 0.15) {
        if (hoveredPeak === closestPeak.id) {
          setHoveredPeak(null); // Hide if already showing
        } else {
          setHoveredPeak(closestPeak.id); // Show if not showing
        }
      } else {
        setHoveredPeak(null); // Hide if clicking away
      }
    },
    [data.peaks, setHoveredPeak, terrainWidth, terrainDepth, hoveredPeak]
  );

  // Generate heights for marker positioning
  const terrainHeights = useMemo(
    () => generateHeightMap(),
    [generateHeightMap]
  );
  const randomPositions = useMemo(
    () => generateRandomPositions(),
    [generateRandomPositions]
  );

  return (
    <>
      {/* Height map mesh - white wireframe */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onClick={handlePointerClick}
      >
        <meshBasicMaterial
          color="#ffffff"
          wireframe={true}
          transparent={true}
          opacity={1.0}
        />
      </mesh>

      {/* Scattered peak markers across the plane - shorter markers */}
      {randomPositions.map((position) => {
        const peak = position.peak;
        const maxSampleCount = Math.max(
          ...data.peaks.map((p) => p.sampleCount)
        );
        const selectedCount = peak.selectedCount ?? peak.sampleCount;

        // Calculate terrain height at random position
        const terrainHeight = getTerrainHeightAt(
          position.x,
          position.z,
          terrainHeights
        );
        const height = terrainHeight * 3; // Match terrain scaling

        const worldX = (position.x - 0.5) * terrainWidth;
        const worldZ = (position.z - 0.5) * terrainDepth;
        const isHovered = hoveredPeak === peak.id;

        console.log(
          `Peak ${peak.id}: random pos=(${position.x.toFixed(
            2
          )}, ${position.z.toFixed(2)}), terrain height=${terrainHeight.toFixed(
            3
          )}, world height=${height.toFixed(2)}`
        );

        return (
          <group key={peak.id} position={[worldX, height, worldZ]}>
            {/* Shorter marker sphere - white with outline */}
            <mesh>
              <sphereGeometry args={[0.15, 6, 6]} />{" "}
              {/* Smaller and less detailed */}
              <meshBasicMaterial
                color="#ffffff"
                transparent={true}
                opacity={isHovered ? 1.0 : 0.8}
              />
            </mesh>

            {/* Shorter outline sphere */}
            <mesh>
              <sphereGeometry args={[0.17, 6, 6]} /> {/* Smaller outline */}
              <meshBasicMaterial
                color="#000000"
                wireframe={true}
                transparent={true}
                opacity={0.6}
              />
            </mesh>

            {/* Tooltip on click */}
            {isHovered && (
              <Html
                position={[0, 0.5, 0]}
                center
                distanceFactor={8}
                zIndexRange={[100, 0]}
              >
                <div className="bg-black/90 border border-white/30 rounded-lg p-3 text-white text-xs min-w-[200px]">
                  <div className="font-semibold mb-2">{peak.label}</div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-white/70">Contributions:</span>{" "}
                      {selectedCount.toLocaleString()} /{" "}
                      {peak.sampleCount.toLocaleString()}
                    </div>
                    <div>
                      <span className="text-white/70">Percentage:</span>{" "}
                      {((selectedCount / peak.sampleCount) * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className="text-white/70">Position:</span> (
                      {position.x.toFixed(2)}, {position.z.toFixed(2)})
                    </div>
                    <div>
                      <span className="text-white/70">Mountain Height:</span>{" "}
                      {height.toFixed(2)} units
                    </div>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Grid helper - white with outline */}
      <gridHelper
        args={[terrainWidth, 20, "#ffffff", "#000000"]}
        position={[0, -0.1, 0]}
      />

      {/* Enhanced lighting for mountain range */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 25, 15]} intensity={1.8} />
      <directionalLight position={[-15, 20, -10]} intensity={1.0} />
      <directionalLight position={[5, 30, 5]} intensity={0.6} />
    </>
  );
}

function Scene({ data }: { data: WaveformData }) {
  const [hoveredPeak, setHoveredPeak] = useState<number | null>(null);

  // Early return if no data
  if (!data || !data.peaks || data.peaks.length === 0) {
    return (
      <group>
        <ambientLight intensity={0.5} />
        <directionalLight position={[20, 25, 15]} intensity={1.8} />
        <directionalLight position={[-15, 20, -10]} intensity={1.0} />
        <directionalLight position={[5, 30, 5]} intensity={0.6} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={12}
          maxDistance={50}
          panSpeed={2}
          zoomSpeed={3}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          target={[0, 6, 0]}
        />
      </group>
    );
  }

  return (
    <>
      <HeightMap
        data={data}
        hoveredPeak={hoveredPeak}
        setHoveredPeak={setHoveredPeak}
      />

      {/* Blender-style camera controls - 3/4 view only */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0}
        maxDistance={5}
        zoomSpeed={3}
        panSpeed={3}
        minPolarAngle={Math.PI / 6} // 30 degrees minimum
        maxPolarAngle={Math.PI / 2.2} // ~82 degrees maximum
        minAzimuthAngle={-Math.PI / 4} // -45 degrees
        maxAzimuthAngle={Math.PI / 4} // 45 degrees
        target={[0, 6, 0]}
      />
    </>
  );
}

export default function Waveform({
  datasetId,
  initialData,
  onDataUpdate,
  onClusterClick,
}: WaveformProps) {
  const [data, setData] = useState<WaveformData>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [18, 15, 18], fov: 60 }}
        gl={{
          antialias: true,
          alpha: true,
        }}
        style={{
          background: "#000000",
        }}
      >
        <color attach="background" args={["#000000"]} />
        <Scene data={data} />
      </Canvas>

      {/* Debug info */}
      <div className="absolute top-4 left-4 bg-black/80 border border-white/30 rounded p-3 text-xs text-white">
        <div className="font-semibold mb-2">Mountain Range</div>
        <div>Peaks: {data?.peaks?.length || 0}</div>
        <div>
          Max Height:{" "}
          {data?.peaks
            ? Math.max(
                ...data.peaks.map((p) => p.selectedCount ?? p.sampleCount)
              )
            : 0}
        </div>
        <div>Shorter markers on peaks</div>
        <div>Check console for details</div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/80 border border-white/30 rounded p-3">
        <div className="text-xs text-white mb-2 font-semibold">
          Mountain Range Wireframe
        </div>
        <div className="text-xs text-white/80">
          White wireframe terrain with scattered markers
        </div>
        <div className="text-xs text-white/60 mt-2">
          Click on peaks for details
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-black/80 border border-white/30 rounded p-3 text-xs text-white/80 max-w-xs">
        <div className="font-semibold mb-1">View Controls</div>
        <div>• Rotate: Right-click + drag</div>
        <div>• Zoom: Scroll wheel</div>
        <div>• Pan: Middle-click + drag</div>
        <div>• 3/4 view only</div>
      </div>
    </div>
  );
}
