import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./styles.css";

// Support GitHub Pages SPA routing via 404.html redirect.
if (window.location.hash && window.location.hash.startsWith("#%2F")) {
  const decoded = decodeURIComponent(window.location.hash.slice(1));
  window.history.replaceState(null, "", decoded);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

