"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppHeader, Alert, Button, Card, PageLoader } from "@/components/ui";
import { MascotView } from "@/components/MascotView";
import { REWARDS, type RewardId } from "@/lib/data";
import { api, type NewAchievement, type ShopData } from "@/lib/api";
import { useAuth, useRequireUser } from "@/lib/auth";
import { confetti, playSound } from "@/lib/effects";

export default function ShopPage() {
  const user = useRequireUser();
  const { refresh } = useAuth();
  const [shop, setShop] = useState<ShopData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const sound = user?.child?.soundEnabled ?? true;

  const load = useCallback(async () => {
    try {
      setShop(await api<ShopData>("/api/shop"));
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Do‘konni yuklab bo‘lmadi" });
    }
  }, []);

  useEffect(() => {
    if (user) queueMicrotask(load);
  }, [user, load]);

  async function act(id: RewardId, kind: "buy" | "wear" | "takeoff") {
    setBusy(id);
    setMessage(null);
    try {
      if (kind === "buy") {
        const r = await api<{ newAchievements: NewAchievement[] }>(`/api/shop/${id}/buy`, { method: "POST" });
        playSound("coin", sound);
        confetti(0.7);
        setMessage({ tone: "info", text: `🎉 ${REWARDS[id].title} sotib olindi!${r.newAchievements.length ? ` Yangi yutuq: ${r.newAchievements.map((a) => a.title).join(", ")}` : ""}` });
      } else {
        await api(`/api/shop/${id}/equip`, { method: "POST", body: { equipped: kind === "wear" } });
      }
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Amalni bajarib bo‘lmadi" });
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <PageLoader />;
  const equipped = (shop?.items ?? []).filter((i) => i.equipped).map((i) => i.id);

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
        <div className="order-2 space-y-4 lg:order-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black text-blue-950">🛍 Do‘kon</h1>
              <p className="text-slate-600">Testlarda yutgan ballaringga qahramoningni bezat!</p>
            </div>
            <div className="rounded-2xl bg-amber-100 px-5 py-3 text-xl font-black text-amber-800" aria-live="polite">
              ⭐ {shop ? shop.balance : "–"} ball
            </div>
          </div>
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          {!shop && !message && <PageLoader />}
          <ul className="grid gap-3 p-0 sm:grid-cols-2">
            <AnimatePresence>
              {shop?.items.map((i) => (
                <motion.li key={i.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="list-none">
                  <Card className="flex h-full flex-col gap-3 !p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-3xl" aria-hidden>
                        {REWARDS[i.id].emoji}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-black text-blue-950">{i.name}</h2>
                        <p className="text-sm font-bold text-slate-500">{i.owned ? "✓ Sizda bor" : `⭐ ${i.price} ball`}</p>
                      </div>
                    </div>
                    {i.levelLocked && !i.owned && <p className="text-sm font-bold text-amber-700">🔒 {i.minLevel}-darajadan ochiladi</p>}
                    <div className="mt-auto">
                      {i.owned ? (
                        <Button className="w-full" variant={i.equipped ? "secondary" : "primary"} loading={busy === i.id} onClick={() => act(i.id, i.equipped ? "takeoff" : "wear")}>
                          {i.equipped ? "Yechish" : "Kiyish"}
                        </Button>
                      ) : (
                        <Button className="w-full" loading={busy === i.id} disabled={i.levelLocked || !i.affordable} onClick={() => act(i.id, "buy")}>
                          {i.levelLocked ? "Yopiq" : i.affordable ? `Sotib olish · ${i.price}` : `Yana ${i.price - (shop?.balance ?? 0)} ball kerak`}
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <aside className="order-1 lg:order-2">
          <div className="sticky top-20 rounded-4xl bg-linear-to-b from-blue-100 via-white to-white p-3 ring-1 ring-blue-100">
            <MascotView id={user.profile.mascot!} mood={equipped.length ? "wearing_rewards" : "idle"} equipped={equipped} reaction={{ kind: "none", nonce: 0 }} className="h-72 sm:h-96" />
            <p className="pb-2 text-center text-sm font-bold text-slate-600">Hozir kiyilgan: {equipped.length ? equipped.map((e) => REWARDS[e].emoji).join(" ") : "hech narsa"}</p>
          </div>
        </aside>
      </main>
    </>
  );
}
