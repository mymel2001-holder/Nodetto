import { create } from "zustand"
import { Workspace } from "../components/AccountMenu"

export enum syncStatusEnum {
  Synched = "Synched",
  Syncing = "Syncing",
  Error = "Error",
  Offline = "Offline",
  NotConnected = "NotConnected"
}

export type Note = {
  id: string;
  title: string;
  parent_id: string | null;
  is_folder: boolean;
  folder_open: boolean;
  updated_at: Date;
  deleted: boolean;
};

type Store = {
  workspace: Workspace | null
  allWorkspaces: Workspace[]
  notes: Note[]
  syncStatus: syncStatusEnum

  setWorkspace: (newWorkspace: Workspace | null) => void
  setAllWorkspaces: (newWorkspaces: Workspace[]) => void
  setNotes: (notes: Note[]) => void
  setSyncStatus: (status: syncStatusEnum) => void
}

export const useGeneral = create<Store>(
  (set) => ({
    workspace: null,
    allWorkspaces: [],
    notes: [],
    syncStatus: syncStatusEnum.Offline,

    setWorkspace: (newWorkspace) => {
      set(() => ({ workspace: newWorkspace }))
    },
    setAllWorkspaces: (newWorkspaces) => {
      set(() => ({ allWorkspaces: newWorkspaces }))
    },
    setNotes: (notes) => {
      set(() => ({ notes }))
    },
    setSyncStatus: (status) => {
      set(() => ({ syncStatus: status }))
    }
  })
)
