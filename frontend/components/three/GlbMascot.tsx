"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { MascotId } from "@/lib/data";
import { BallReward, CapReward, ClothingReward, CrownReward, GlassesReward, RewardSlot, TrophyReward } from "./Rewards";
import type { MascotProps, Mood } from "./Mascot";

// Tayyor 3D model (.glb) qo‘llab-quvvatlash. Fayl public/models/<id>.glb joyida bo‘lsa, qahramon shu model bilan chiziladi;
// yo‘q yoki buzuq bo‘lsa — kod bilan yasalgan versiya ishlaydi. Qo‘llanma: public/models/README.md

/** Qaysi qahramonlar uchun tayyor model qidiriladi (boshqalar uchun keraksiz so‘rov yuborilmaydi). */
export const GLB_HEROES: MascotId[] = ["pandacha"];

const glbUrl = (id: MascotId) => `/models/${id}.glb`;
const availability = new Map<string, boolean>();

/** null — hali tekshirilmoqda, true/false — model bor/yo‘q. Natija sessiya davomida eslab qolinadi. */
export function useGlbAvailable(id: MascotId): boolean | null {
  const wanted = GLB_HEROES.includes(id);
  const [res, setRes] = useState<{ id: MascotId; ok: boolean } | null>(null);
  useEffect(() => {
    if (!wanted || availability.has(id)) return;
    let live = true;
    fetch(glbUrl(id), { method: "HEAD" })
      .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
      .catch(() => false)
      .then((ok) => {
        availability.set(id, ok);
        if (live) setRes({ id, ok });
      });
    return () => {
      live = false;
    };
  }, [id, wanted]);
  if (!wanted) return false;
  if (availability.has(id)) return availability.get(id)!;
  return res?.id === id ? res.ok : null;
}

/** Model yuklanmasa yoki buzuq bo‘lsa, sahna qulamaydi: kod bilan yasalgan qahramon ko‘rsatiladi. */
export class GlbBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("3D model yuklanmadi, oddiy qahramon ko‘rsatiladi:", error.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Kod bilan yasalgan qahramon bilan bir xil balandlik, shunda mukofotlar joyiga tushadi.
const TARGET_HEIGHT = 2.14;

function pickClip(names: string[], mood: Mood): string | undefined {
  const words: Record<Mood, RegExp> = {
    idle: /idle|stand|breath/i,
    thinking: /think|idle/i,
    happy: /happy|joy|jump|idle/i,
    sad: /sad|idle/i,
    celebrating: /celebrat|dance|cheer|happy|idle/i,
    wearing_rewards: /idle|stand|breath/i,
  };
  return names.find((n) => words[mood].test(n)) ?? names[0];
}

export function GlbModel({ id, mood, equipped, reaction, reducedMotion }: MascotProps) {
  const gltf = useGLTF(glbUrl(id), false, true);
  const root = useRef<THREE.Group>(null);
  const react = useRef({ nonce: -1, at: -10, kickAt: null as number | null });
  const has = (r: (typeof equipped)[number]) => equipped.includes(r);

  // Modelni klonlab, balandligini va joylashuvini standartga keltiramiz (oyoq polda, markaz o‘rtada).
  const { scene, fit } = useMemo(() => {
    const s = cloneSkinned(gltf.scene) as THREE.Group;
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = TARGET_HEIGHT / Math.max(size.y, 1e-6);
    return { scene: s, fit: { scale: k, offset: [-center.x * k, -box.min.y * k, -center.z * k] as [number, number, number] } };
  }, [gltf.scene]);

  // Model ichida animatsiya bo‘lsa (Idle, Happy...), kayfiyatga qarab o‘ynaladi.
  const { actions, names } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    const clip = pickClip(names, mood);
    const action = clip ? actions[clip] : null;
    action?.reset().fadeIn(0.25).play();
    return () => {
      action?.fadeOut(0.25);
    };
  }, [actions, names, mood]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
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

    let y = Math.sin(t * 1.6) * 0.035 * k;
    let tiltX = 0;
    let tiltZ = Math.sin(t * 0.9) * 0.03 * k;
    let spin = 0;
    let squash = 1 + Math.sin(t * 2.2) * 0.015 * k;
    switch (mood) {
      case "thinking":
        tiltZ = 0.12;
        tiltX = -0.05;
        break;
      case "happy":
        y = Math.abs(Math.sin(t * 7)) * 0.2 * k;
        squash = 1 + Math.sin(t * 14) * 0.025 * k;
        break;
      case "sad":
        y = -0.05;
        tiltX = 0.18;
        squash = 0.96;
        break;
      case "celebrating":
        y = Math.abs(Math.sin(t * 6)) * 0.3 * k;
        spin = since < 1.3 ? THREE.MathUtils.smootherstep(since, 0, 1.3) * Math.PI * 2 * (reducedMotion ? 0 : 1) : 0;
        break;
      case "wearing_rewards":
        spin = Math.sin(t * 0.8) * 0.25 * k;
        break;
    }
    g.position.y = damp(g.position.y, y, 10);
    g.rotation.x = damp(g.rotation.x, tiltX, 6);
    g.rotation.z = damp(g.rotation.z, tiltZ, 6);
    g.rotation.y = mood === "celebrating" && spin ? spin : damp(g.rotation.y, spin + state.pointer.x * 0.25 * k, 4);
    g.scale.y = damp(g.scale.y, squash, 10);
  });

  return (
    <group ref={root}>
      <group position={fit.offset} scale={fit.scale}>
        <primitive object={scene} />
      </group>
      <RewardSlot active={has("clothing")} position={[0, 1.2, 0.02]}>
        <ClothingReward />
      </RewardSlot>
      <RewardSlot active={has("trophy")} position={[0.55, 0.7, 0.18]}>
        <TrophyReward />
      </RewardSlot>
      <RewardSlot active={has("glasses")} position={[0, 1.68, 0.6]}>
        <GlassesReward />
      </RewardSlot>
      <RewardSlot active={has("cap")} position={[0, 1.99, 0]}>
        <CapReward />
      </RewardSlot>
      <RewardSlot active={has("crown")} position={[0, 2.14 + (has("cap") ? 0.28 : 0.04), 0]}>
        <CrownReward />
      </RewardSlot>
      <RewardSlot active={has("ball")} position={[0.75, 0, 0.55]}>
        <BallReward kick={react} />
      </RewardSlot>
    </group>
  );
}
