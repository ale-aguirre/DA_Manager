"use client";
import React from "react";
import { PlannerProvider } from "../../context/PlannerContext";
import PlannerView from "./PlannerView";

export default function PlannerPageContent() {
    return (
        <PlannerProvider>
            <PlannerView />
        </PlannerProvider>
    );
}
