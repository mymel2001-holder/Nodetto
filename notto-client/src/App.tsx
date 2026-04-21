import { useEffect, useRef } from "react";
import "./App.css";
import { useGeneral } from "./store/general";
import Home from "./components/Home";
import LogoutWorkspaceConfirmModal from "./components/modals/LogoutWorkspaceConfirmModal";
import DeleteNoteConfirmModal from "./components/modals/DeleteNoteConfirmModal";
import ConflictModal from "./components/modals/ConflictModal";
import Toaster from "./components/Toaster";
import { handleCommandError } from "./lib/errors";
import * as commands from "./lib/commands";

/** Root component — bootstraps the workspace on mount and renders the modal/toast layer. */
function App() {
  const { setWorkspace, setAllWorkspaces } = useGeneral();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    init();
  }, []);

  /** Loads the last active workspace on startup, creating a default one if none exist. */
  async function init() {
    // await commands.init(); // Not needed if we use getLoggedWorkspace directly

    let workspaces = await commands.getWorkspaces()
      .catch((e) => { handleCommandError(e); return []; });

    if (workspaces.length === 0) {
      await commands.createWorkspace("workspace 1").catch(handleCommandError);
      workspaces = await commands.getWorkspaces()
        .catch((e) => { handleCommandError(e); return []; });
    }

    setAllWorkspaces(workspaces as any);

    const loggedWorkspace = await commands.getLoggedWorkspace()
      .catch((e) => { handleCommandError(e); return null; });

    if (loggedWorkspace) setWorkspace(loggedWorkspace as any);
  }

  const { workspace } = useGeneral();

  return (
    <div className="h-screen w-screen">
      <LogoutWorkspaceConfirmModal />
      <DeleteNoteConfirmModal />
      <ConflictModal />
      <Toaster />

      {!workspace && (
        <div className="flex grow place-items-center place-content-center text-2xl text-center text-white bg-slate-800 min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          Creating workspace...
        </div>
      )}
      <Home />
    </div>
  );
}

export default App;
