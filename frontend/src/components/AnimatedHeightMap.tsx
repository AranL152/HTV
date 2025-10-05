"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AnimatedHeightMapProps {
  width?: number;
  height?: number;
  segments?: number;
}

export default function AnimatedHeightMap({
  width = 30,
  height = 20,
  segments = 30,
}: AnimatedHeightMapProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const frameCountRef = useRef(0);

  // Create animated height map geometry
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, segments, segments);
    return geo;
  }, [width, height, segments]);

  // Very slow animated height map
  useFrame((state) => {
    if (!meshRef.current) return;

    // Update every frame for maximum frame rate
    // frameCountRef.current++;
    // if (frameCountRef.current % 2 !== 0) return;

    timeRef.current += 0.01; // Slower animation
    const positions = meshRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 1];

      // Create diagonal wave patterns
      const diagonal1 = Math.sin((x + z) * 0.3 + timeRef.current * 0.4);
      const diagonal2 = Math.sin((x - z) * 0.2 + timeRef.current * 0.3);
      const diagonal3 = Math.sin((x + z * 0.5) * 0.4 + timeRef.current * 0.5);

      // Combine diagonal waves with reduced amplitude and offset to avoid negatives
      const height =
        (diagonal1 * 0.4 + diagonal2 * 0.3 + diagonal3 * 0.3) * 1.5 + 2;

      positions[i * 3 + 2] = height;
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[0.3, 0, 0.2]}
      position={[0, -5, 0]}
    >
      <meshBasicMaterial
        color="#ffffff"
        wireframe={true}
        transparent={true}
        opacity={0.1}
        side={2}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
