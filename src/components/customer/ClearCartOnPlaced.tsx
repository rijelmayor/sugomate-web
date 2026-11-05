"use client";

import { useEffect } from "react";
import { CART_KEY } from "@/lib/cart";

// Rendered after a successful checkout so the saved basket does not reappear.
export default function ClearCartOnPlaced() {
  useEffect(() => { try { window.localStorage.removeItem(CART_KEY); } catch { /* ignore */ } }, []);
  return null;
}
