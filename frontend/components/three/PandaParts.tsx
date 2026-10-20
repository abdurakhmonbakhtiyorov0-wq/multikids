"use client";

import type * as THREE from "three";

// Detallashtirilgan panda: yumshoq "vinil" materiallar, aniq anatomiya (barmoqlar, panjalar, ko'z atrofi dog'lari, burun, quloqlar).
// Skelet va animatsiya Mascot.tsx'da, bu yerda faqat shakllar.

const WHITE = "#fbfaf7";
const CREAM = "#f3eee2";
const BLACK = "#24242c";
const SOFT_BLACK = "#363640";
const PAD = "#f2a7b6";

type MatProps = { color: string } & Partial<THREE.MeshPhysicalMaterialParameters>;

/** Mayin "momiq" material: sheen yumshoq tukli yuza ta'sirini beradi. */
function Fur({ color, ...rest }: MatProps) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.62}
      metalness={0}
      sheen={1}
      sheenRoughness={0.65}
      sheenColor={color === WHITE || color === CREAM ? "#dbe7ff" : "#7b7b8c"}
      clearcoat={0.12}
      clearcoatRoughness={0.55}
      {...rest}
    />
  );
}

/** Ko'z va burun uchun yaltiroq lak. */
function Gloss({ color, ...rest }: MatProps) {
  return <meshPhysicalMaterial color={color} roughness={0.12} metalness={0} clearcoat={1} clearcoatRoughness={0.04} {...rest} />;
}

export function PandaLeg() {
  return (
    <>
      <mesh position={[0, -0.2, 0]} scale={[1.05, 1, 1.05]} castShadow>
        <capsuleGeometry args={[0.15, 0.18, 10, 24]} />
        <Fur color={BLACK} />
      </mesh>
      <mesh position={[0, -0.36, 0.07]} scale={[1.05, 0.6, 1.35]} castShadow>
        <sphereGeometry args={[0.15, 28, 20]} />
        <Fur color={BLACK} />
      </mesh>
      {[-0.07, 0, 0.07].map((x) => (
        <mesh key={x} position={[x, -0.37, 0.235 - Math.abs(x) * 0.25]} scale={[1, 0.85, 1.1]}>
          <sphereGeometry args={[0.042, 14, 10]} />
          <Fur color={SOFT_BLACK} />
        </mesh>
      ))}
    </>
  );
}

export function PandaTorso() {
  return (
    <>
      {/* Tana: nok shaklidagi, pastga qarab kengroq */}
      <mesh position={[0, 0.42, 0]} scale={[1.03, 1.1, 0.95]} castShadow>
        <sphereGeometry args={[0.46, 48, 36]} />
        <Fur color={WHITE} />
      </mesh>
      {/* Qorin */}
      <mesh position={[0, 0.34, 0.31]} scale={[1, 1.15, 0.45]}>
        <sphereGeometry args={[0.3, 32, 24]} />
        <Fur color={CREAM} />
      </mesh>
      {/* Yelka bo'ylab qora kamar */}
      <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.92, 1]}>
        <torusGeometry args={[0.395, 0.088, 20, 56]} />
        <Fur color={BLACK} />
      </mesh>
      {/* Dumcha */}
      <mesh position={[0, 0.2, -0.43]}>
        <sphereGeometry args={[0.1, 20, 16]} />
        <Fur color={WHITE} />
      </mesh>
    </>
  );
}

export function PandaArm() {
  return (
    <>
      <mesh position={[0, -0.22, 0]} castShadow>
        <capsuleGeometry args={[0.105, 0.24, 10, 20]} />
        <Fur color={BLACK} />
      </mesh>
      <group position={[0, -0.44, 0]}>
        <mesh scale={[1, 1.05, 0.95]} castShadow>
          <sphereGeometry args={[0.116, 28, 20]} />
          <Fur color={BLACK} />
        </mesh>
        {[-0.06, 0, 0.06].map((x) => (
          <mesh key={x} position={[x, -0.092, 0.03 - Math.abs(x) * 0.2]}>
            <sphereGeometry args={[0.038, 14, 10]} />
            <Fur color={SOFT_BLACK} />
          </mesh>
        ))}
        <mesh position={[0, -0.01, 0.1]} scale={[1, 1.1, 0.4]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <Fur color={PAD} />
        </mesh>
      </group>
    </>
  );
}

export function PandaHead({ R }: { R: number }) {
  return (
    <group>
      <mesh castShadow scale={[1.06, 0.96, 1]}>
        <sphereGeometry args={[R, 64, 48]} />
        <Fur color={WHITE} />
      </mesh>

      {/* Quloqlar: tashqi qora, ichki yumshoqroq */}
      {[-1, 1].map((s) => (
        <group key={s} position={[R * 0.74 * s, R * 0.8, -0.02]} rotation={[0.1, -0.25 * s, -0.4 * s]}>
          <mesh scale={[1, 1, 0.62]} castShadow>
            <sphereGeometry args={[0.175, 28, 20]} />
            <Fur color={BLACK} />
          </mesh>
          <mesh position={[0, -0.005, 0.05]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.11, 24, 16]} />
            <Fur color="#4a4a57" />
          </mesh>
        </group>
      ))}

      {/* Ko'z atrofidagi qora dog'lar: pastga, tashqariga qiyshaygan */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.19 * s, 0.05, 0.43]} rotation={[0, 0, 0.5 * s]} scale={[0.9, 1.35, 0.7]}>
          <sphereGeometry args={[0.125, 32, 24]} />
          <Gloss color={BLACK} clearcoat={0.35} roughness={0.5} />
        </mesh>
      ))}

      {/* Burun */}
      <mesh position={[0, -0.075, R * 0.96]} scale={[1.35, 0.9, 0.85]}>
        <sphereGeometry args={[0.058, 28, 20]} />
        <Gloss color="#15151b" />
      </mesh>
      <mesh position={[-0.02, -0.055, 0.542]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, -0.145, 0.498]}>
        <cylinderGeometry args={[0.006, 0.006, 0.05, 6]} />
        <meshStandardMaterial color="#2a2a33" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Katta yaltiroq ko'zlar (ikki yaltirash va qo'ng'ir iris). Guruh `eyes` ref orqali yumiladi. */
export function PandaEyes({ eyesRef }: { eyesRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={eyesRef}>
      {[-1, 1].map((s) => (
        <group key={s} position={[0.17 * s, 0, 0]}>
          <mesh scale={[1, 1.08, 0.62]}>
            <sphereGeometry args={[0.092, 32, 24]} />
            <Gloss color="#14141b" />
          </mesh>
          <mesh position={[0, -0.004, 0.045]} scale={[1, 1.05, 0.4]}>
            <sphereGeometry args={[0.062, 28, 20]} />
            <Gloss color="#3d2b22" />
          </mesh>
          <mesh position={[0, -0.004, 0.062]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[0.04, 20, 14]} />
            <Gloss color="#06060a" />
          </mesh>
          <mesh position={[0.026, 0.034, 0.075]}>
            <sphereGeometry args={[0.026, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.022, -0.026, 0.07]}>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
