"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { Mascot, type MascotProps } from "./Mascot";

export default function MascotScene(props: MascotProps & { compact?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 1.35, props.compact ? 5.6 : 5.0], fov: 34 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)}
    >
      <hemisphereLight args={["#ffffff", "#bfdbfe", 1.15]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#93c5fd" />
      <Mascot {...props} />
      <ContactShadows position={[0, -0.001, 0]} opacity={0.35} scale={5} blur={2.4} far={2} color="#1e3a8a" />
    </Canvas>
  );
}
