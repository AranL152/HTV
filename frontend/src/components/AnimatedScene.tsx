"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import AnimatedHeightMap from "./AnimatedHeightMap";

export default function AnimatedScene() {
  return (
    <Canvas
      camera={{ position: [0, 20, 5], fov: 20 }}
      style={{ background: "solid" }}
      gl={{ antialias: false }}
    >
      <AnimatedHeightMap />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        minAzimuthAngle={-Math.PI / 2}
        maxAzimuthAngle={Math.PI / 2}
      />
    </Canvas>
  );
}
