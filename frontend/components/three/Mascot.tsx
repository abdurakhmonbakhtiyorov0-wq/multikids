"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHARACTER_BY_ID, type Character, type MascotId, type RewardId } from "@/lib/data";
import { BallReward, CapReward, ClothingReward, CrownReward, GlassesReward, RewardSlot, TrophyReward } from "./Rewards";

export type Mood = "idle" | "thinking" | "happy" | "sad" | "celebrating" | "wearing_rewards";
export type Reaction = { kind: "equip" | "remove" | "celebrate" | "none"; item?: RewardId | null; nonce: number };

export type MascotProps = { id: MascotId; mood: Mood; equipped: RewardId[]; reaction: Reaction; reducedMotion?: boolean };

// Umumiy skelet o'lchamlari (barcha qahramonlar uchun bir xil, faqat bosh radiusi farq qiladi).
const HEAD_Y = 1.62;
const SHOULDER_Y = 1.12;
const HIP_Y = 0.42;

function Mat({ color, ...rest }: { color: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  return <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} {...rest} />;
}

export function Mascot({ id, mood, equipped, reaction, reducedMotion }: MascotProps) {
  const c = CHARACTER_BY_ID[id];
  const R = c.headR;
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const trophyHolder = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const react = useRef({ nonce: -1, at: -10, kickAt: null as number | null });
  const blink = useRef({ next: 2.5, until: 0 });

  const has = (r: RewardId) => equipped.includes(r);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    const k = reducedMotion ? 0.3 : 1;
    const r = react.current;
    if (reaction.nonce !== r.nonce) {
      r.nonce = reaction.nonce;
      r.at = t;
      if (reaction.kind === "equip" && reaction.item === "ball") r.kickAt = t + 0.35;
    }
    const since = t - r.at;
    const damp = (cur: number, target: number, speed = 7) => THREE.MathUtils.damp(cur, target, speed, dt);

    // Holatlarga mos maqsadli pozalar
    let y = Math.sin(t * 1.6) * 0.035 * k;
    let spin = 0;
    let headX = 0;
    let headZ = Math.sin(t * 0.9) * 0.04 * k;
    let aL = -0.18 - Math.sin(t * 1.6) * 0.05 * k;
    let aR = 0.18 + Math.sin(t * 1.6) * 0.05 * k;
    const lL = 0;
    let lR = 0;
    let smile = 0.7;
    let mouthW = 1;
    let squash = 1 + Math.sin(t * 2.2) * 0.018 * k;
    let eyeOpen = 1;

    switch (mood) {
      case "thinking":
        headZ = 0.22;
        headX = -0.12;
        aR = 2.1 + Math.sin(t * 3) * 0.05 * k;
        smile = 0.15;
        mouthW = 0.6;
        break;
      case "happy":
        y = Math.abs(Math.sin(t * 7)) * 0.22 * k;
        aL = -2.5 + Math.sin(t * 12) * 0.25 * k;
        aR = 2.5 - Math.sin(t * 12) * 0.25 * k;
        smile = 1;
        mouthW = 1.35;
        squash = 1 + Math.sin(t * 14) * 0.03 * k;
        break;
      case "sad":
        y = -0.06;
        headX = 0.42;
        headZ = 0.06;
        aL = -0.04;
        aR = 0.04;
        smile = -0.8;
        mouthW = 0.8;
        squash = 0.95;
        eyeOpen = 0.55;
        break;
      case "celebrating":
        y = Math.abs(Math.sin(t * 6)) * 0.35 * k;
        spin = since < 1.3 ? THREE.MathUtils.smootherstep(since, 0, 1.3) * Math.PI * 2 * (reducedMotion ? 0 : 1) : 0;
        aL = -2.7 + Math.sin(t * 10) * 0.2 * k;
        aR = 2.7 - Math.sin(t * 10) * 0.2 * k;
        smile = 1;
        mouthW = 1.45;
        break;
      case "wearing_rewards":
        spin = Math.sin(t * 0.8) * 0.25 * k;
        aL = -0.55;
        aR = 0.55;
        smile = 0.9;
        mouthW = 1.15;
        headX = -0.08;
        break;
    }

    // Kubok bo'lsa — uni ushlab turadi; yangi olinganda baland ko'taradi.
    if (has("trophy") && mood !== "sad") {
      const raising = reaction.kind === "equip" && reaction.item === "trophy" && since < 1.8;
      aR = raising ? 2.8 : Math.max(aR, 1.0);
    }
    // To'pni tepish
    if (r.kickAt !== null) {
      const kt = t - r.kickAt;
      if (kt > -0.35 && kt < 0.5) lR = kt < 0 ? 0.5 * (1 + kt / 0.35) : -1.3 * Math.sin((kt / 0.5) * Math.PI);
    }
    // Kipriklarni yumish
    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.12;
      b.next = t + 2 + Math.random() * 3;
    }
    if (t < b.until) eyeOpen = 0.08;

    // Ko'rsatkichga qarash
    const px = state.pointer.x;
    const py = state.pointer.y;

    if (root.current) {
      root.current.position.y = damp(root.current.position.y, y, 10);
      root.current.rotation.y = mood === "celebrating" && spin ? spin : damp(root.current.rotation.y, spin + px * 0.25 * k, 4);
    }
    if (body.current) body.current.scale.y = damp(body.current.scale.y, squash, 10);
    if (head.current) {
      head.current.rotation.x = damp(head.current.rotation.x, headX - py * 0.15 * k, 6);
      head.current.rotation.z = damp(head.current.rotation.z, headZ, 6);
      head.current.rotation.y = damp(head.current.rotation.y, px * 0.35 * k, 6);
    }
    if (armL.current) armL.current.rotation.z = damp(armL.current.rotation.z, aL, 9);
    if (armR.current) armR.current.rotation.z = damp(armR.current.rotation.z, aR, 9);
    if (trophyHolder.current && armR.current) trophyHolder.current.rotation.z = -armR.current.rotation.z;
    if (legL.current) legL.current.rotation.x = damp(legL.current.rotation.x, lL, 12);
    if (legR.current) legR.current.rotation.x = damp(legR.current.rotation.x, lR, 14);
    if (mouth.current) {
      mouth.current.scale.y = damp(mouth.current.scale.y, smile, 8);
      mouth.current.scale.x = damp(mouth.current.scale.x, mouthW, 8);
    }
    if (eyes.current) eyes.current.scale.y = damp(eyes.current.scale.y, eyeOpen, 25);
    if (tail.current) tail.current.rotation.y = Math.sin(t * (mood === "happy" ? 12 : 3)) * 0.4 * k;
  });

  const isRobot = c.extra === "robot";

  return (
    <group ref={root}>
      {/* Oyoqlar */}
      {[
        [-0.2, legL],
        [0.2, legR],
      ].map(([x, ref]) => (
        <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, HIP_Y, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.2, 6, 14]} />
            <Mat color={c.extra === "mario" ? "#2f5fd0" : c.limbs} />
          </mesh>
          <mesh position={[0, -0.36, 0.06]} scale={[1, 0.6, 1.3]} castShadow>
            <sphereGeometry args={[0.14, 16, 12]} />
            <Mat color={c.extra === "mario" ? "#6b3e1f" : c.extra === "minion" ? "#1f2937" : c.limbs} />
          </mesh>
        </group>
      ))}

      {/* Tana */}
      <group ref={body} position={[0, HIP_Y, 0]}>
        <mesh position={[0, 0.42, 0]} scale={[1, 1.1, 0.92]} castShadow>
          {isRobot ? <boxGeometry args={[0.8, 0.72, 0.62]} /> : <sphereGeometry args={[0.46, 32, 24]} />}
          <Mat color={c.body} metalness={isRobot ? 0.45 : 0.02} roughness={isRobot ? 0.35 : 0.55} />
        </mesh>
        {c.belly && (
          <mesh position={[0, 0.38, 0.3]} scale={[1, 1.15, 0.5]}>
            <sphereGeometry args={[0.3, 24, 16]} />
            <Mat color={c.belly} />
          </mesh>
        )}
        {c.extra === "minion" && (
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.47, 0.43, 0.42, 32]} />
            <Mat color="#2f6fd6" />
          </mesh>
        )}
        {c.extra === "mario" && (
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.36, 0.44, 0.22, 32]} />
            <Mat color="#e0393e" />
          </mesh>
        )}
        {c.extra === "spider" && (
          <mesh position={[0, 0.52, 0.4]} rotation={[0.2, 0, 0]}>
            <circleGeometry args={[0.12, 5]} />
            <Mat color="#111827" side={THREE.DoubleSide} />
          </mesh>
        )}
        {isRobot && (
          <mesh position={[0, 0.45, 0.315]}>
            <planeGeometry args={[0.36, 0.22]} />
            <Mat color="#0f172a" emissive="#38bdf8" emissiveIntensity={0.35} />
          </mesh>
        )}
        {c.extra === "dragon" && (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0.32 * s, 0.6, -0.35]} rotation={[0.3, 0.5 * s, 0.6 * s]} scale={[1, 0.65, 0.12]} castShadow>
                <sphereGeometry args={[0.32, 16, 12]} />
                <Mat color="#3fa673" />
              </mesh>
            ))}
            {[0.75, 0.5, 0.25].map((yy, i) => (
              <mesh key={i} position={[0, yy, -0.43]} rotation={[-0.4, 0, 0]}>
                <coneGeometry args={[0.07, 0.16, 8]} />
                <Mat color={c.accent} />
              </mesh>
            ))}
          </>
        )}
        {(c.extra === "dragon" || c.extra === "cat" || c.extra === "dog") && (
          <group ref={tail} position={[0, 0.2, -0.4]}>
            <mesh position={[0, 0.05, -0.18]} rotation={[-1.1, 0, 0]} castShadow>
              {c.extra === "dragon" ? <coneGeometry args={[0.12, 0.5, 12]} /> : <capsuleGeometry args={[0.05, 0.3, 4, 8]} />}
              <Mat color={c.limbs} />
            </mesh>
          </group>
        )}
        {/* Sharf (kiyim mukofoti) */}
        <RewardSlot active={has("clothing")} position={[0, 0.78, 0]}>
          <ClothingReward />
        </RewardSlot>
      </group>

      {/* Qo'llar */}
      {[
        [-1, armL],
        [1, armR],
      ].map(([s, ref]) => (
        <group key={s as number} ref={ref as React.RefObject<THREE.Group>} position={[0.46 * (s as number), SHOULDER_Y, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.26, 6, 12]} />
            <Mat color={c.limbs} metalness={isRobot ? 0.45 : 0.02} />
          </mesh>
          <mesh position={[0, -0.42, 0]} castShadow>
            <sphereGeometry args={[0.1, 14, 12]} />
            <Mat color={c.extra === "mario" || c.extra === "minion" ? "#ffffff" : c.extra === "spider" ? "#e23b3b" : c.limbs} />
          </mesh>
          {s === 1 && (
            <group ref={trophyHolder} position={[0, -0.5, 0.05]}>
              <RewardSlot active={has("trophy")} position={[0, -0.02, 0.08]}>
                <TrophyReward />
              </RewardSlot>
            </group>
          )}
        </group>
      ))}

      {/* Bosh */}
      <group ref={head} position={[0, HEAD_Y, 0]}>
        <Head c={c} />
        <group position={[0, 0.06, R * 0.86]}>
          <Eyes c={c} eyesRef={eyes} />
        </group>
        {/* Og'iz: scale.y > 0 — tabassum, < 0 — xafa */}
        <group ref={mouth} position={[0, -R * 0.32, R * 0.93]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.09, 0.022, 8, 20, Math.PI]} />
            <Mat color={c.extra === "robot" ? "#38bdf8" : "#3b1d1d"} emissive={c.extra === "robot" ? "#38bdf8" : "#000000"} emissiveIntensity={0.6} />
          </mesh>
          {c.extra === "labubu" &&
            [-0.06, -0.02, 0.02, 0.06].map((x) => (
              <mesh key={x} position={[x, -0.075, 0.01]} rotation={[0, 0, Math.PI]}>
                <coneGeometry args={[0.018, 0.04, 4]} />
                <Mat color="#ffffff" />
              </mesh>
            ))}
        </group>
        {c.extra !== "robot" && c.extra !== "spider" && (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0.27 * s, -0.14, R * 0.83]}>
                <sphereGeometry args={[0.06, 12, 8]} />
                <Mat color="#ff9db4" transparent opacity={0.6} />
              </mesh>
            ))}
          </>
        )}
        <RewardSlot active={has("glasses")} position={[0, 0.06, R * 0.98]}>
          <GlassesReward />
        </RewardSlot>
        <RewardSlot active={has("cap")} position={[0, R * 0.72 + (c.extra === "mario" ? 0.08 : 0), 0]}>
          <CapReward />
        </RewardSlot>
        <RewardSlot active={has("crown")} position={[0, R + (has("cap") ? 0.28 : 0.04), 0]}>
          <CrownReward />
        </RewardSlot>
      </group>

      <RewardSlot active={has("ball")} position={[0.75, 0, 0.55]}>
        <BallReward kick={react} />
      </RewardSlot>
    </group>
  );
}

function Head({ c }: { c: Character }) {
  const R = c.headR;
  return (
    <group>
      <mesh castShadow>
        {c.extra === "robot" ? <boxGeometry args={[R * 2, R * 1.7, R * 1.8]} /> : <sphereGeometry args={[R, 40, 32]} />}
        <Mat color={c.head} metalness={c.extra === "robot" ? 0.45 : 0.02} roughness={c.extra === "robot" ? 0.35 : 0.55} />
      </mesh>

      {/* Quloqlar */}
      {c.ears === "round" &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[R * 0.72 * s, R * 0.72, -0.05]} castShadow>
            <sphereGeometry args={[R * 0.32, 16, 12]} />
            <Mat color={c.extra === "panda" ? "#2b2b33" : c.limbs} />
          </mesh>
        ))}
      {c.ears === "pointy" &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[R * 0.58 * s, R * 0.88, 0]} rotation={[0, 0, -0.35 * s]} castShadow>
            <coneGeometry args={[R * 0.28, R * 0.55, 4]} />
            <Mat color={c.head} />
          </mesh>
        ))}
      {c.ears === "floppy" &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[R * 0.95 * s, R * 0.05, 0]} rotation={[0, 0, 0.25 * s]} scale={[0.55, 1, 0.35]} castShadow>
            <sphereGeometry args={[R * 0.5, 16, 12]} />
            <Mat color={c.accent} />
          </mesh>
        ))}
      {c.ears === "bunny" &&
        [-1, 1].map((s) => (
          <group key={s} position={[R * 0.4 * s, R * 1.1, 0]} rotation={[0, 0, -0.18 * s]}>
            <mesh castShadow scale={[1, 1, 0.6]}>
              <capsuleGeometry args={[R * 0.17, R * 0.75, 6, 12]} />
              <Mat color={c.head} />
            </mesh>
            <mesh position={[0, 0, R * 0.08]} scale={[0.6, 0.85, 0.3]}>
              <capsuleGeometry args={[R * 0.17, R * 0.75, 6, 12]} />
              <Mat color={c.accent} />
            </mesh>
          </group>
        ))}

      {c.ears === "wide" &&
        [-1, 1].map((s) => (
          <group key={s} position={[R * 0.88 * s, R * 0.5, -0.04]} rotation={[0, 0.25 * s, -0.75 * s]}>
            <mesh castShadow scale={[0.55, 1.35, 0.22]}>
              <sphereGeometry args={[R * 0.5, 20, 16]} />
              <Mat color={c.head} />
            </mesh>
            <mesh position={[0.01 * s, 0.02, R * 0.07]} scale={[0.36, 1.05, 0.12]}>
              <sphereGeometry args={[R * 0.5, 20, 16]} />
              <Mat color={c.accent} />
            </mesh>
          </group>
        ))}

      {/* Maxsus tafsilotlar */}
      {c.extra === "star" && (
        <>
          <mesh position={[0, R * 0.98, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.22, 8]} />
            <Mat color={c.limbs} />
          </mesh>
          <mesh position={[0, R * 0.98 + 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <octahedronGeometry args={[0.1, 0]} />
            <Mat color="#ffd84d" emissive="#ffd84d" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0, -R * 0.22, R * 0.8]} scale={[1.25, 0.8, 0.6]}>
            <sphereGeometry args={[R * 0.3, 20, 16]} />
            <Mat color={c.belly ?? c.accent} />
          </mesh>
        </>
      )}
      {c.extra === "dragon" &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[R * 0.42 * s, R * 0.9, -0.05]} rotation={[-0.2, 0, -0.3 * s]} castShadow>
            <coneGeometry args={[0.07, 0.28, 12]} />
            <Mat color={c.accent} />
          </mesh>
        ))}
      {(c.extra === "bear" || c.extra === "dog" || c.extra === "dragon") && (
        <mesh position={[0, -R * 0.2, R * 0.78]} scale={[1.2, 0.85, 0.7]}>
          <sphereGeometry args={[R * 0.32, 20, 16]} />
          <Mat color={c.belly ?? c.accent} />
        </mesh>
      )}
      {(c.extra === "bear" || c.extra === "dog" || c.extra === "cat" || c.extra === "panda") && (
        <mesh position={[0, -R * 0.1, R * 0.99]} scale={[1.3, 0.9, 0.8]}>
          <sphereGeometry args={[0.05, 12, 10]} />
          <Mat color="#1f2937" roughness={0.3} />
        </mesh>
      )}
      {c.extra === "cat" &&
        [-1, 1].flatMap((s) =>
          [0.04, -0.04].map((dy) => (
            <mesh key={`${s}${dy}`} position={[0.2 * s, -R * 0.15 + dy, R * 0.9]} rotation={[0, 0, Math.PI / 2 + dy * 3 * s]}>
              <cylinderGeometry args={[0.006, 0.006, 0.22, 4]} />
              <Mat color="#5b3a1e" />
            </mesh>
          )),
        )}
      {c.extra === "panda" &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[0.17 * s, 0.05, R * 0.8]} rotation={[0, 0, 0.5 * s]} scale={[0.85, 1.15, 0.5]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <Mat color="#2b2b33" />
          </mesh>
        ))}
      {c.extra === "robot" && (
        <>
          <mesh position={[0, R * 0.95, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
            <Mat color="#64748b" metalness={0.6} />
          </mesh>
          <mesh position={[0, R * 0.95 + 0.16, 0]}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <Mat color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[R * s, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
              <Mat color="#64748b" metalness={0.6} />
            </mesh>
          ))}
        </>
      )}
      {c.extra === "minion" && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <torusGeometry args={[R * 1.0, 0.035, 8, 40]} />
            <Mat color="#1f2937" />
          </mesh>
          {[-0.08, 0, 0.08].map((x) => (
            <mesh key={x} position={[x, R + 0.06, 0]} rotation={[0, 0, x * 3]}>
              <cylinderGeometry args={[0.006, 0.006, 0.14, 4]} />
              <Mat color="#1f2937" />
            </mesh>
          ))}
        </>
      )}
      {c.extra === "spider" &&
        [0.18, -0.08].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.sqrt(R * R - y * y) + 0.002, 0.006, 6, 48]} />
            <Mat color="#4a0d0d" />
          </mesh>
        ))}
      {c.extra === "mario" && (
        <>
          <mesh position={[0, R * 0.35, 0]} castShadow>
            <sphereGeometry args={[R * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
            <Mat color="#e0393e" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, R * 0.45, R * 0.72]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.03, 32, 1, false, -Math.PI / 2, Math.PI]} />
            <Mat color="#e0393e" />
          </mesh>
          <mesh position={[0, R * 0.62, R * 0.86]}>
            <circleGeometry args={[0.09, 5]} />
            <Mat color="#ffffff" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.06, R * 1.0]}>
            <sphereGeometry args={[0.085, 16, 12]} />
            <Mat color="#f2b183" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.08 * s, -0.15, R * 0.98]} rotation={[0, 0, 0.3 * s]} scale={[1.5, 0.6, 0.6]}>
              <sphereGeometry args={[0.06, 12, 8]} />
              <Mat color="#3b2414" />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function Eyes({ c, eyesRef }: { c: Character; eyesRef: React.RefObject<THREE.Group | null> }) {
  const spread = 0.17;
  if (c.extra === "spider") {
    return (
      <group ref={eyesRef}>
        {[-1, 1].map((s) => (
          <group key={s} position={[spread * s, 0.02, 0]} rotation={[0, 0, -0.5 * s]}>
            <mesh scale={[1, 1.5, 0.35]}>
              <sphereGeometry args={[0.1, 16, 12]} />
              <Mat color="#111827" />
            </mesh>
            <mesh scale={[0.8, 1.3, 0.4]} position={[0, 0, 0.01]}>
              <sphereGeometry args={[0.1, 16, 12]} />
              <Mat color="#ffffff" />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  const minion = c.extra === "minion";
  const robot = c.extra === "robot";
  return (
    <group ref={eyesRef}>
      {[-1, 1].map((s) => (
        <group key={s} position={[spread * s, 0, 0]}>
          {minion && (
            <mesh>
              <torusGeometry args={[0.12, 0.035, 10, 28]} />
              <Mat color="#94a3b8" metalness={0.8} roughness={0.2} />
            </mesh>
          )}
          <mesh scale={[1, 1, 0.5]}>
            <sphereGeometry args={[minion ? 0.11 : 0.085, 18, 14]} />
            <Mat color={robot ? "#0f172a" : "#ffffff"} />
          </mesh>
          <mesh position={[0, -0.005, 0.04]}>
            <sphereGeometry args={[robot ? 0.05 : 0.05, 14, 10]} />
            <Mat color={robot ? "#38bdf8" : "#1e1b2e"} emissive={robot ? "#38bdf8" : "#000000"} emissiveIntensity={robot ? 1.4 : 0} roughness={0.2} />
          </mesh>
          {!robot && (
            <mesh position={[0.018, 0.02, 0.085]}>
              <sphereGeometry args={[0.016, 8, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
