"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Utensils,
  Train,
  Users,
  ShoppingBag,
  Hotel,
  MapPin,
  ChevronRight,
  Check,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { useSettings } from "@/contexts/SettingsContext";
import PracticeChat from "@/components/PracticeChat";
import {
  SCENARIO_IDS,
  generateChineseName,
} from "@/types/practice";
import type {
  HSKLevel,
  ScenarioId,
  PracticeSession,
} from "@/types/practice";
import type { LucideIcon } from "lucide-react";

const SCENARIO_META: Record<ScenarioId, {
  icon: LucideIcon;
  iconGradient: string;
  gradient: string;
  borderColor: string;
  hoverGlow: string;
}> = {
  restaurant: {
    icon: Utensils,
    iconGradient: "from-orange-500 to-red-500",
    gradient: "from-orange-500/10 to-red-500/10",
    borderColor: "border-orange-500/20",
    hoverGlow: "hover:shadow-orange-500/20",
  },
  train_station: {
    icon: Train,
    iconGradient: "from-blue-500 to-cyan-500",
    gradient: "from-blue-500/10 to-cyan-500/10",
    borderColor: "border-blue-500/20",
    hoverGlow: "hover:shadow-blue-500/20",
  },
  making_friends: {
    icon: Users,
    iconGradient: "from-yellow-500 to-amber-500",
    gradient: "from-yellow-500/10 to-amber-500/10",
    borderColor: "border-yellow-500/20",
    hoverGlow: "hover:shadow-yellow-500/20",
  },
  shopping: {
    icon: ShoppingBag,
    iconGradient: "from-pink-500 to-rose-500",
    gradient: "from-pink-500/10 to-rose-500/10",
    borderColor: "border-pink-500/20",
    hoverGlow: "hover:shadow-pink-500/20",
  },
  hotel: {
    icon: Hotel,
    iconGradient: "from-purple-500 to-indigo-500",
    gradient: "from-purple-500/10 to-indigo-500/10",
    borderColor: "border-purple-500/20",
    hoverGlow: "hover:shadow-purple-500/20",
  },
  directions: {
    icon: MapPin,
    iconGradient: "from-green-500 to-emerald-500",
    gradient: "from-green-500/10 to-emerald-500/10",
    borderColor: "border-green-500/20",
    hoverGlow: "hover:shadow-green-500/20",
  },
};

export default function PracticePage() {
  const t = useTranslation();
  const { lang } = useSettings();

  const [hskLevel, setHskLevel] = useState<HSKLevel>(3);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);

  const handleStart = useCallback(() => {
    if (!selectedScenario) return;
    setSession({
      hskLevel,
      scenarioId: selectedScenario,
      characterName: generateChineseName(),
    });
  }, [hskLevel, selectedScenario]);

  const handleBack = useCallback(() => {
    setSession(null);
    setSelectedScenario(null);
  }, []);

  // Active chat session
  if (session) {
    return (
      <PracticeChat
        session={session}
        lang={lang}
        onBack={handleBack}
      />
    );
  }

  // Setup screen
  return (
    <main className="min-h-screen pt-14 transition-colors md:pt-0">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-gradient-to-r from-red-500/10 to-pink-500/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-red-500 dark:text-red-400" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              AI-Powered Conversations
            </span>
          </div>
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t.practice.title}
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            {t.practice.subtitle}
          </p>
        </motion.div>

        {/* HSK Level Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <label className="mb-4 block text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            {t.practice.hskLevel}
          </label>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 9 }, (_, i) => {
              const level = (i + 1) as HSKLevel;
              const active = hskLevel === level;
              return (
                <motion.button
                  key={level}
                  onClick={() => setHskLevel(level)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative h-14 w-14 rounded-xl font-semibold transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/30"
                      : "border border-gray-200 bg-white text-gray-700 hover:border-red-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-red-500/30"
                  }`}
                >
                  {level}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Scenario Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <label className="mb-4 block text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            {t.practice.scenario}
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SCENARIO_IDS.map((id, index) => {
              const active = selectedScenario === id;
              const meta = SCENARIO_META[id];
              const Icon = meta.icon;
              const label = t.practice.scenarios[id as keyof typeof t.practice.scenarios] as string;
              const desc = t.practice.scenarios[`${id}Desc` as keyof typeof t.practice.scenarios] as string;
              return (
                <motion.button
                  key={id}
                  onClick={() => setSelectedScenario(id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  whileHover={{ y: -4 }}
                  className={`group relative rounded-2xl border bg-white p-6 text-left backdrop-blur-sm transition-all duration-300 hover:shadow-2xl dark:bg-gray-800/50 ${meta.borderColor} ${meta.hoverGlow} ${
                    active
                      ? "shadow-xl ring-2 ring-red-500 dark:ring-red-400"
                      : ""
                  }`}
                >
                  {/* Background Gradient */}
                  <div
                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${meta.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />

                  {/* Content */}
                  <div className="relative">
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${meta.iconGradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                      </div>
                      {active && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 dark:bg-red-400"
                        >
                          <Check className="h-4 w-4 text-white" />
                        </motion.div>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {label}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {desc}
                    </p>
                  </div>

                  {/* Hover Arrow */}
                  <div className="absolute bottom-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center"
        >
          <button
            onClick={handleStart}
            disabled={!selectedScenario}
            className={`group relative overflow-hidden rounded-xl px-10 py-4 text-lg font-semibold transition-all duration-300 ${
              selectedScenario
                ? "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/30 hover:scale-105 hover:shadow-xl hover:shadow-red-500/40"
                : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
            }`}
          >
            {/* Animated Background */}
            {selectedScenario && (
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-red-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            )}

            <span className="relative flex items-center gap-2">
              {t.practice.startSimulation}
              {selectedScenario && (
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <ChevronRight className="h-5 w-5" />
                </motion.span>
              )}
            </span>
          </button>
        </motion.div>

        {/* Helper Text */}
        {!selectedScenario && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center text-sm text-gray-500"
          >
            {t.practice.scenario}
          </motion.p>
        )}
      </div>
    </main>
  );
}
