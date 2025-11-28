"use client";
import React from "react";
import dynamic from "next/dynamic";

const PlannerPageContent = dynamic(() => import("../../src/components/planner/PlannerPageContent"), { ssr: false });

export default function PlannerPage() {
  return <PlannerPageContent />;
}