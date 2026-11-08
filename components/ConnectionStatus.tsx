"use client";

import { useEffect } from "react";
import { toast } from "./ui/toast";

export function ConnectionStatus() {
  useEffect(() => {
    const timer = setTimeout(
      () =>
        toast(
          "The catalog is responding slowly. We’re reconnecting automatically; your saved library is still available.",
          "catalog-delay",
        ),
      8000,
    );
    return () => clearTimeout(timer);
  }, []);
  return null;
}
