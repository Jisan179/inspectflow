"use client";

import { createContext, useContext } from "react";
import type { Project, Role } from "./types";

interface ProjectContextValue {
  project: Project;
  role: Role;
  reload: () => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside a project page");
  return ctx;
}

export const isEngineer = (role: Role) => role === "LEAD" || role === "DEVELOPER";
