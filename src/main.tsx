import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "@/lib/errorLog";
import { initNativeShell } from "@/lib/nativeShell";

installGlobalErrorHandlers();
void initNativeShell();

createRoot(document.getElementById("root")!).render(<App />);
