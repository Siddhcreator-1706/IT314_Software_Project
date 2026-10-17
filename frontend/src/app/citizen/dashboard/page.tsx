"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ResQProvider, useResQ } from "../../../context/ResQContext";
import { CitizenDashboardView } from "../../../components/role-views/CitizenDashboardView";

function CitizenDashboardRouteInner() {
  const router = useRouter();
  const { logout, isAuthenticated } = useResQ();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-slate-500 text-sm font-medium">
        Verifying Citizen credentials...
      </div>
    );
  }

  return (
    <CitizenDashboardView
      onViewPublicMap={() => router.push("/")}
      onSignOut={() => {
        logout();
        router.push("/login");
      }}
    />
  );
}

export default function CitizenDashboardPage() {
  return (
    <ResQProvider>
      <CitizenDashboardRouteInner />
    </ResQProvider>
  );
}
