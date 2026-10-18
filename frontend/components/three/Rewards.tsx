"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Mukofotni prujinali "pop" animatsiyasi bilan ko'rsatadi yoki olib tashlaydi.
 * Obyektlar doim sahnada qoladi (takroriy yaratish yo'q), faqat masshtab o'zgaradi.
 * Olib tashlanganda buyum aylanib yuqoriga uchadi va kichrayadi.
 */
export function RewardSlot({ active, children, position = [0, 0, 0] as [number, number, number] }: { active: boolean; children: React.ReactNode; position?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const s = useRef({ scale: 0, vel: 0, lift: 0, spin: 0 });
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const st = s.current;
    const d = Math.min(dt, 1 / 30);
    const target = active ? 1 : 0;
    // Prujina: ozgina oshib ketib, keyin joyiga tushadi.
    st.vel += (target - st.scale) * 180 * d;
    st.vel *= Math.exp(-11 * d);
    st.scale = Math.max(0, st.scale + st.vel * d);
    if (active) {
      st.lift = THREE.MathUtils.damp(st.lift, 0, 8, d);
      st.spin = THREE.MathUtils.damp(st.spin, 0, 8, d);
    } else if (st.scale > 0.01) {
      st.lift += d * 1.6;
      st.spin += d * 9;
    } else {
      st.lift = 0.5;
      st.spin = 0;
    }
    g.visible = st.scale > 0.01;
    g.scale.setScalar(st.scale);
    g.position.set(position[0], position[1] + st.lift, position[2]);
    g.rotation.y = st.spin;
  });
  return <group ref={ref}>{children}</group>;
}

const toon = { roughness: 0.45, metalness: 0.05 };

export function CapReward() {
  return (
    <group rotation={[-0.15, 0, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2563eb" {...toon} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.01, 0.36]} rotation={[-0.08, 0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.035, 32, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#1d4ed8" {...toon} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" {...toon} />
      </mesh>
    </group>
  );
}

export function ClothingReward() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.36, 0.1, 16, 40]} />
        <meshStandardMaterial color="#ef4444" {...toon} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[0.36, 0.035, 8, 40]} />
        <meshStandardMaterial color="#ffffff" {...toon} />
      </mesh>
      <mesh position={[0.16, -0.24, 0.36]} rotation={[0.25, 0, 0.15]} castShadow>
        <boxGeometry args={[0.16, 0.38, 0.07]} />
        <meshStandardMaterial color="#ef4444" {...toon} />
      </mesh>
    </group>
  );
}

export function TrophyReward() {
  const gold = { color: "#fbbf24", metalness: 0.7, roughness: 0.25, emissive: "#7a4b00", emissiveIntensity: 0.15 };
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.2, 0.06, 0.2]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.13, 12]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.06, 0.22, 24]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.15 * s, 0.29, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.06, 0.018, 8, 16]} />
          <meshStandardMaterial {...gold} />
        </mesh>
      ))}
    </group>
  );
}

/** To'p: tepilganda sakrab dumalaydi, keyin asta joyiga qaytadi. */
export function BallReward({ kick }: { kick: React.RefObject<{ kickAt: number | null }> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const kickAt = kick.current.kickAt;
    const t = kickAt === null ? 99 : state.clock.elapsedTime - kickAt;
    if (t >= 0 && t < 1.4) {
      const p = t / 1.4;
      g.position.x = 0.9 * Math.sin(p * Math.PI);
      g.position.z = 0.5 * Math.sin(p * Math.PI);
      g.position.y = Math.abs(Math.sin(p * Math.PI * 3)) * 0.45 * (1 - p);
      g.rotation.z -= 0.25;
    } else {
      g.position.set(0, 0, 0);
    }
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.17, 0]} scale={1.005}>
        <icosahedronGeometry args={[0.17, 0]} />
        <meshStandardMaterial color="#1d4ed8" wireframe />
      </mesh>
    </group>
  );
}

export function GlassesReward() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.17 * s, 0, 0]}>
          <torusGeometry args={[0.11, 0.022, 10, 28]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`l${s}`} position={[0.17 * s, 0, -0.005]}>
          <circleGeometry args={[0.1, 24]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.45} metalness={0.4} roughness={0.1} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[0.12, 0.025, 0.02]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

export function CrownReward() {
  const gold = { color: "#facc15", metalness: 0.75, roughness: 0.25 };
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.14, 24, 1, true]} />
        <meshStandardMaterial {...gold} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <group key={i}>
            <mesh position={[Math.sin(a) * 0.24, 0.13, Math.cos(a) * 0.24]} castShadow>
              <coneGeometry args={[0.05, 0.13, 8]} />
              <meshStandardMaterial {...gold} />
            </mesh>
            <mesh position={[Math.sin(a) * 0.255, 0, Math.cos(a) * 0.255]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color={i % 2 ? "#3b82f6" : "#ef4444"} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
