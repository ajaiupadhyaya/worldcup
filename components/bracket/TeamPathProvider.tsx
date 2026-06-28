"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tracePath } from "@/lib/bracket";
import type { BracketTree } from "@/lib/bracket";

interface TeamPathValue {
  selectedTeamId: string | null;
  tracedSlots: Set<string> | null;
  selectTeam: (id: string) => void;
}

const TeamPathContext = createContext<TeamPathValue | null>(null);

export function TeamPathProvider({
  tree,
  children,
}: {
  tree: BracketTree;
  children: ReactNode;
}) {
  const [selectedTeamId, setSelected] = useState<string | null>(null);

  const tracedSlots = useMemo(
    () => (selectedTeamId ? tracePath(tree, selectedTeamId) : null),
    [tree, selectedTeamId],
  );

  const selectTeam = useCallback(
    (id: string) => setSelected((prev) => (prev === id ? null : id)),
    [],
  );

  const value = useMemo(
    () => ({ selectedTeamId, tracedSlots, selectTeam }),
    [selectedTeamId, tracedSlots, selectTeam],
  );

  return (
    <TeamPathContext.Provider value={value}>{children}</TeamPathContext.Provider>
  );
}

export function useTeamPath(): TeamPathValue {
  const ctx = useContext(TeamPathContext);
  if (!ctx) throw new Error("useTeamPath must be used within a TeamPathProvider");
  return ctx;
}
