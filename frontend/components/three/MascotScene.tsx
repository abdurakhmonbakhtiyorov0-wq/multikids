"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Mascot, type MascotProps } from "./Mascot";

export default function MascotScene(props: MascotProps & { compact?: boolean }) {
  // Detallashtirilgan qahramonlar uchun studiya yoritishi: yumshoq panellar va orqa yorug‘lik (tashqi fayl yuklanmaydi).
  const studio = props.id === "pandacha";
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 1.35, props.compact ? 5.6 : 5.0], fov: 34 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)}
    >
      <hemisphereLight args={["#ffffff", "#bfdbfe", studio ? 0.7 : 1.15]} />
      <directionalLight position={[3, 5, 4]} intensity={studio ? 1.3 : 1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#93c5fd" />
      {studio && (
        <>
          <directionalLight position={[-1.5, 3.5, -4]} intensity={0.9} color="#fff1dd" />
          <Environment resolution={128} environmentIntensity={0.7}>
            <Lightformer form="rect" intensity={2.4} position={[0, 5, 4]} scale={[8, 4, 1]} />
            <Lightformer form="rect" intensity={1.1} position={[-5, 2, 2]} scale={[3, 6, 1]} color="#bfdbfe" />
            <Lightformer form="rect" intensity={1.3} position={[5, 1, -3]} scale={[3, 6, 1]} color="#fde7d0" />
          </Environment>
        </>
      )}
      <Mascot {...props} />
      <ContactShadows position={[0, -0.001, 0]} opacity={0.35} scale={5} blur={2.4} far={2} color="#1e3a8a" />
    </Canvas>
  );
}
