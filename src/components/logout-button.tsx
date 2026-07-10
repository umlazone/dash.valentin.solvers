"use client";

import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";

type Props = {
  onLoggedOut?: () => void;
  /** rail = full width in left rail; compact = icon+label for header/mobile */
  variant?: "rail" | "compact";
};

export function LogoutButton({
  onLoggedOut = () => window.location.assign("/login"),
  variant = "rail",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("revocation_failed");
      onLoggedOut();
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`logout-control logout-control--${variant}`}>
      <button
        className={`logout-button logout-button--${variant}`}
        type="button"
        onClick={logout}
        disabled={busy}
        aria-label="Cerrar sesión"
      >
        {busy ? (
          <LoaderCircle className="spin" size={14} aria-hidden="true" />
        ) : (
          <LogOut size={14} aria-hidden="true" />
        )}
        <span>{busy ? "Cerrando…" : "Cerrar sesión"}</span>
      </button>
      {error ? (
        <span className="logout-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
