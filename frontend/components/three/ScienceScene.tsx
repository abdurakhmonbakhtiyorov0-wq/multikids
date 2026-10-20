"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Yuqori modul uchun ilmiy 3D sahna: atom (yadro va aylanuvchi elektronlar) va DNK qo‘sh spirali.
// Hammasi oddiy geometriyadan yig‘ilgan — tashqi model fayllari kerak emas.

const VIOLET = "#8f78ff";
const CYAN = "#5de0ff";
const PINK = "#ff8fd0";
const AMBER = "#ffd27a";

function Atom({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null);
  const electrons = useRef<(THREE.Mesh | null)[]>([]);
  const orbits = [
    { tilt: [0, 0, 0] as const, r: 1.1, color: CYAN, phase: 0 },
    { tilt: [Math.PI / 3, 0, 0] as const, r: 1.1, color: PINK, phase: 2 },
    { tilt: [-Math.PI / 3, 0, 0] as const, r: 1.1, color: AMBER, phase: 4 },
  ];
  const nucleus = useMemo(
    () => [
      [0.12, 0.05, 0.08], [-0.1, 0.1, -0.06], [0.04, -0.13, 0.1], [-0.08, -0.06, -0.12], [0.14, -0.04, -0.07], [-0.02, 0.15, 0.05],
    ] as [number, number, number][],
    [],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    if (group.current) group.current.rotation.y = t * 0.25;
    orbits.forEach((o, i) => {
      const m = electrons.current[i];
      if (m) m.position.set(Math.cos(t * 1.6 + o.phase) * o.r, Math.sin(t * 1.6 + o.phase) * o.r * 0.55, 0);
    });
  });
  return (
    <group ref={group} position={[-0.85, 0.2, 0]} scale={0.78}>
      {nucleus.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.15, 24, 18]} />
          <meshStandardMaterial color={i % 2 ? PINK : VIOLET} emissive={i % 2 ? PINK : VIOLET} emissiveIntensity={0.55} roughness={0.35} />
        </mesh>
      ))}
      {orbits.map((o, i) => (
        <group key={i} rotation={[...o.tilt]}>
          <mesh scale={[1, 0.55, 1]}>
            <torusGeometry args={[o.r, 0.012, 8, 96]} />
            <meshBasicMaterial color={o.color} transparent opacity={0.55} />
          </mesh>
          <mesh
            ref={(el) => {
              electrons.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshStandardMaterial color={o.color} emissive={o.color} emissiveIntensity={1.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Helix({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null);
  const N = 18;
  const rungs = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 3.2;
        const y = (i / (N - 1) - 0.5) * 2.6;
        return { a, y };
      }),
    [],
  );
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * speed * 0.6;
  });
  return (
    <group ref={group} position={[1.15, -0.05, 0]} scale={0.8} rotation={[0, 0, 0.18]}>
      {rungs.map(({ a, y }, i) => {
        const x1 = Math.cos(a) * 0.5;
        const z1 = Math.sin(a) * 0.5;
        return (
          <group key={i} position={[0, y, 0]}>
            <mesh position={[x1, 0, z1]}>
              <sphereGeometry args={[0.09, 16, 12]} />
              <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.7} />
            </mesh>
            <mesh position={[-x1, 0, -z1]}>
              <sphereGeometry args={[0.09, 16, 12]} />
              <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={0.7} />
            </mesh>
            <mesh rotation={[0, -a, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
              <meshBasicMaterial color={AMBER} transparent opacity={0.65} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function ScienceScene({ reducedMotion }: { reducedMotion?: boolean }) {
  const speed = reducedMotion ? 0.15 : 1;
  return (
    <Canvas dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} camera={{ position: [0, 0.2, 5], fov: 38 }}>
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 3, 4]} intensity={30} color="#ffffff" />
      <pointLight position={[-4, -2, 3]} intensity={18} color={VIOLET} />
      <Atom speed={speed} />
      <Helix speed={speed} />
    </Canvas>
  );
}
