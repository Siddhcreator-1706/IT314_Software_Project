"use client";

import React, { useEffect } from "react";
import { useResQ } from "../context/ResQContext";

interface SimulationBarProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEP_DESCRIPTIONS: Record<number, { title: string; desc: string }> = {
  0: {
    title: "Scenario Idle",
    desc: "Ready to initiate Mumbai Mithi Basin Flash Flood crisis simulation.",
  },
  1: {
    title: "1. Citizen Emergency Report",
    desc: "Sneha Rao submits distress report: 3ft flood water inside Kurla residential colony.",
  },
  2: {
    title: "2. Multi-Source ERSS 112 Call Spike",
    desc: "112 gateway logs surge of 18 panic calls in 4 mins; submerged transformers sparking.",
  },
  3: {
    title: "3. Duplicate Detection & Grouping",
    desc: "System identifies 92% geo-temporal overlap with Mithi flood cluster and links reports.",
  },
  4: {
    title: "4. AI NDMA Triage & Incident Verification",
    desc: "AI classifies severity as CRITICAL, estimates 35 victims, and generates tactical incident.",
  },
  5: {
    title: "5. Tactical Unit Dispatch",
    desc: "Dispatcher verifies incident and assigns NDRF RESCUE-04 boat team with 8 min ETA.",
  },
  6: {
    title: "6. Unit En Route",
    desc: "Unit RESCUE-04 transitions to EN ROUTE status; simulated navigation active on map.",
  },
  7: {
    title: "7. On Scene & Field Reconnaissance",
    desc: "RESCUE-04 arrives on scene; launches inflatable raft and transmits tactical situation message.",
  },
  8: {
    title: "8. Logistics Allocation",
    desc: "Logistics officer allocates inflatable rescue equipment from Dadar Regional Warehouse.",
  },
  9: {
    title: "9. Incident Resolved & Evacuation Complete",
    desc: "All trapped victims evacuated to relief shelter; incident marked RESOLVED with full audit trail.",
  },
};

export const SimulationBar: React.FC<SimulationBarProps> = ({ isOpen, onClose }) => {
  const {
    simulationRunning,
    simulationStep,
    startSimulation,
    pauseSimulation,
    stepSimulation,
    resetSimulation,
  } = useResQ();

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (simulationRunning) {
      timer = setInterval(() => {
        if (simulationStep < 9) {
          stepSimulation();
        } else {
          pauseSimulation();
        }
      }, 4000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [simulationRunning, simulationStep, stepSimulation, pauseSimulation]);

  if (!isOpen) return null;

  const currentInfo = STEP_DESCRIPTIONS[simulationStep] || {
    title: "Simulation Completed",
    desc: "Full disaster response lifecycle successfully demonstrated across all roles.",
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] max-w-xl w-[92vw] bg-[#0b1324]/95 border border-amber-500/40 backdrop-blur-xl rounded-2xl shadow-2xl p-4 text-foreground flex flex-col gap-2.5 animate-fadeIn font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Disaster Scenario Simulation
          </span>
          <span className="text-[10px] bg-amber-950/80 text-amber-200 border border-amber-600/50 px-2 py-0.5 rounded-full font-mono font-semibold">
            Step {simulationStep} of 9
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-white text-xs px-2 py-1 rounded hover:bg-surface-muted transition cursor-pointer font-bold"
          title="Close Simulation Deck"
        >
          ✕
        </button>
      </div>

      <div>
        <h4 className="text-sm font-bold text-white">{currentInfo.title}</h4>
        <p className="text-xs text-muted leading-relaxed mt-0.5">{currentInfo.desc}</p>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-border">
        <div
          className="bg-amber-400 h-full transition-all duration-500 rounded-full"
          style={{ width: `${(simulationStep / 9) * 100}%` }}
        />
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex gap-1.5">
          {simulationRunning ? (
            <button
              onClick={pauseSimulation}
              className="bg-surface hover:bg-surface-elevated text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={startSimulation}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
            >
              ▶ Auto Play
            </button>
          )}
          <button
            onClick={stepSimulation}
            disabled={simulationStep >= 9}
            className="bg-surface hover:bg-surface-elevated text-muted hover:text-foreground border border-border disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            ⏭ Next Step
          </button>
        </div>

        <button
          onClick={resetSimulation}
          className="text-muted hover:text-white text-xs transition cursor-pointer font-medium"
        >
          Reset Scenario
        </button>
      </div>
    </div>
  );
};
