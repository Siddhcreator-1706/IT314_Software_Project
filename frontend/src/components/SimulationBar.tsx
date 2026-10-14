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

  // Auto-advance timer when running
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] max-w-xl w-[92vw] bg-[#0B111E]/95 border border-amber-500/30 backdrop-blur-md rounded-xl shadow-2xl p-3.5 text-slate-100 flex flex-col gap-2.5 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
            DISASTER SIMULATION ENGINE
          </span>
          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded font-mono">
            STEP {simulationStep} / 9
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#070b14] p-3 rounded-lg border border-slate-800 text-xs">
        <div className="font-bold text-white text-[12px] flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <circle cx="12" cy="12" r="6" strokeWidth="2"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
          </svg>
          <span>{currentInfo.title}</span>
        </div>
        <div className="text-slate-300 text-[11px] mt-1 leading-relaxed pl-5">
          {currentInfo.desc}
        </div>
      </div>

      {/* Controller Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {simulationRunning ? (
            <button
              onClick={pauseSimulation}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={startSimulation}
              disabled={simulationStep >= 9}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              <span>Auto Run</span>
            </button>
          )}

          <button
            onClick={stepSimulation}
            disabled={simulationStep >= 9}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <span>Step Forward</span>
          </button>

          <button
            onClick={resetSimulation}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition"
          >
            Reset
          </button>
        </div>

        <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
          LIVE SCENARIO STATE
        </div>
      </div>
    </div>
  );
};
