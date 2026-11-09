import { ConvexReactClient } from "convex/react";
export const configured = Boolean(import.meta.env.VITE_CONVEX_URL);
// No request is made in the unconfigured screen. Never fall back to upstream infrastructure.
export const convexClient = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL || "https://unconfigured.convex.cloud",
);
