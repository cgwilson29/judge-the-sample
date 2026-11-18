import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./chartTheme.js";
import App from "./App.jsx";
import NeonBackground from "./NeonBackground.jsx";
import MusicControl from "./MusicControl.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <NeonBackground />
    <MusicControl />
    <App />
  </StrictMode>,
);
