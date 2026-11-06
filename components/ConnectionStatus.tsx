"use client";

import { useEffect } from "react";
import { toast } from "./ui/toast";

export function ConnectionStatus() {
  useEffect(() => {
    const timer = setTimeout(
      () =>
        toast(
          "The catalog is taking longer to respond. We’re still trying; your saved library remains available.",
          "catalog-delay",
        ),
      8000,
    );
    return () => clearTimeout(timer);
  }, []);
  return null;
}
