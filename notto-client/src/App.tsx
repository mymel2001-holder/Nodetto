import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { useGeneral } from "./store/general";
import Home from "./components/Home";
import LoginHome from "./components/Login/LoginHome";

function App() {
  const { userId } = useGeneral();

  useEffect(() => {
    // Initialize the database on app start
    invoke("init").catch((e) => console.error(e));
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      {userId ? <Home /> : <LoginHome />}
    </div>
  );
}

export default App;
