import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { useGeneral } from "./store/general";
import Home from "./components/Home";
import { Workspace } from "./components/AccountMenu";
import LogoutWorkspaceConfirmModal from "./components/LogoutWorkspaceConfirmModal";
import DeleteNoteConfirmModal from "./components/DeleteNoteConfirmModal";
import ConflictModal from "./components/ConflictModal";
import Toaster from "./components/Toaster";
import { handleCommandError } from "./lib/errors";

function App() {
  const { workspace, setWorkspace, setAllWorkspaces } = useGeneral();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    init();
  }, []);

  async function init() {
    await invoke("init").catch(handleCommandError);

    let backend_workspaces = await invoke("get_workspaces")
      .then((u) => u as Workspace[])
      .catch((e) => {
        handleCommandError(e);
        return [];
      });

    if (backend_workspaces.length <= 0) {
      await invoke("create_workspace", { workspace_name: "workspace 1" })
        .catch(handleCommandError);

      await invoke("set_logged_workspace", { workspace_name: "workspace 1" })
        .catch(handleCommandError);
    }

    backend_workspaces = await invoke("get_workspaces")
      .then((u) => u as Workspace[])
      .catch((e) => {
        handleCommandError(e);
        return [];
      });

    setAllWorkspaces(backend_workspaces);

    const loggedWorkspace = await invoke("get_logged_workspace")
      .then((u) => u as Workspace | null)
      .catch((e) => {
        handleCommandError(e);
        return null;
      });

    if (loggedWorkspace) {
      setWorkspace(loggedWorkspace);
    }
  }

  return (
    <div className="h-screen w-screen">

      {/* Modals */}
      <LogoutWorkspaceConfirmModal />
      <DeleteNoteConfirmModal />
      <ConflictModal />
      <Toaster />

      {!workspace && <div className="flex grow place-items-center place-content-center text-2xl text-center text-white bg-slate-800 min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">Creating workspace...</div>}
      <Home />

    </div>
  );
}

export default App;
