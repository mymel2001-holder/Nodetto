import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGeneral } from "../../store/general";
import { Workspace } from "../AccountMenu";

export default function CreateAccount() {
  const { setWorkspace } = useGeneral();
  const [workspace_name, setWorkspacename] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [instance, setInstance] = useState("http://localhost:3000");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateAccount() {
    if (!workspace_name || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if workspace already exists locally
      const users = await invoke("get_workspaces") as Array<{ id: number; workspace_name: string }>;
      const userExists = users.some(u => u.workspace_name === workspace_name);

      if (userExists) {
        setError("Workspace already exists locally");
        setLoading(false);
        return;
      }

      // Create local workspace
      await invoke("create_workspace", { workspace_name });

      // Set the workspace
      await invoke("set_logged_workspace", { workspace_name });

      // Create account on server
      // await invoke("sync_create_account", {
      //   workspace_name,
      //   password,
      //   instance: instance || undefined
      // });

      // Login after account creation
      // const success = await invoke("sync_login", {
      //   workspace_name,
      //   password,
      //   instance: instance || undefined
      // }) as boolean;

      invoke("get_logged_workspace").then((u) => u as Workspace | null).then((u) => {
        if (u) {
          setWorkspace(u);
        };
      }).catch((e) => console.error(e));
    } catch (e: any) {
      setError(e.message || "Account creation failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Workspace name
        </label>
        <input
          type="text"
          value={workspace_name}
          onChange={(e) => setWorkspacename(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Choose a workspace name"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="At least 8 characters"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Confirm your password"
          disabled={loading}
        />
      </div>

      {/* Advanced settings */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          {showAdvanced ? "▼" : "►"} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-2">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Server Instance
            </label>
            <input
              type="text"
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://localhost:3000"
              disabled={loading}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleCreateAccount}
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        {loading ? "Creating Account..." : "Create Account"}
      </button>

      <div className="text-sm text-slate-400 text-center">
        Your password encrypts all your data. Make sure to save it securely.
      </div>
    </div>
  );
}
