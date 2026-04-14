import { create } from "zustand";
import { Note, Workspace } from "../types";

/** Mirrors the `SyncStatus` enum emitted by the Tauri sync service. */
export enum syncStatusEnum {
  Synched = "Synched",
  Syncing = "Syncing",
  Error = "Error",
  Offline = "Offline",
  NotConnected = "NotConnected",
}

type Store = {
  workspace: Workspace | null;
  allWorkspaces: Workspace[];
  notes: Note[];
  syncStatus: syncStatusEnum;
  syncErrorMessage: string | null;

  setWorkspace: (newWorkspace: Workspace | null) => void;
  setAllWorkspaces: (newWorkspaces: Workspace[]) => void;
  setNotes: (notes: Note[]) => void;
  setSyncStatus: (status: syncStatusEnum, errorMessage?: string) => void;
};

/** Global store for workspace, note list, and sync status. */
export const useGeneral = create<Store>((set) => ({
  workspace: null,
  allWorkspaces: [],
  notes: [],
  syncStatus: syncStatusEnum.Offline,
  syncErrorMessage: null,

  setWorkspace: (newWorkspace) => set(() => ({ workspace: newWorkspace })),
  setAllWorkspaces: (newWorkspaces) => set(() => ({ allWorkspaces: newWorkspaces })),
  setNotes: (notes) => set(() => ({ notes })),
  setSyncStatus: (status, errorMessage) => set(() => ({
    syncStatus: status,
    syncErrorMessage: errorMessage ?? null,
  })),
}));
