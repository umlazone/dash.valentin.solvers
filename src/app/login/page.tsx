"use client";

import { useMemo, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  ArrowRight,
  Check,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { safeRedirectPath } from "@/lib/auth/redirect";

type Phase = "choose" | "otp" | "enroll" | "done";

function safeNext() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("next") || "/";
  return safeRedirectPath(value, window.location.origin);
}

export default function LoginPage() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [busy, setBusy] = useState<"otp" | "verify" | "passkey" | "enroll" | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const biometricLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Passkey";
    const agent = navigator.userAgent;
    if (/iPhone|iPad/u.test(agent)) return "Face ID";
    if (/Macintosh/u.test(agent)) return "Touch ID";
    return "Passkey";
  }, []);

  async function requestOtp() {
    setBusy("otp");
    setError("");
    try {
      const response = await fetch("/api/auth/telegram/request", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo enviar el código.");
      setChallengeId(payload.challengeId);
      setPhase("otp");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el código.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyOtp() {
    if (!/^\d{6}$/u.test(code)) {
      setError("Ingresa los seis dígitos enviados a Telegram.");
      return;
    }
    setBusy("verify");
    setError("");
    try {
      const response = await fetch("/api/auth/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Código inválido o vencido.");
      if (payload.needsPasskey && window.PublicKeyCredential) {
        setPhase("enroll");
      } else {
        setPhase("done");
        window.location.assign(safeNext());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Código inválido o vencido.");
    } finally {
      setBusy(null);
    }
  }

  async function loginWithPasskey() {
    setBusy("passkey");
    setError("");
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("Este navegador no soporta passkeys. Usa el código de Telegram.");
      }
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
      });
      const optionsPayload = await optionsResponse.json();
      if (optionsResponse.status === 409) {
        throw new Error("Primero entra con Telegram para registrar Face ID o Touch ID.");
      }
      if (!optionsResponse.ok) throw new Error("No se pudo iniciar la passkey.");
      const credential = await startAuthentication({
        optionsJSON: optionsPayload.options,
      });
      const verifyResponse = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: optionsPayload.challengeId,
          response: credential,
        }),
      });
      const verifyPayload = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload.error || "La passkey no pudo verificarse.");
      }
      setPhase("done");
      window.location.assign(safeNext());
    } catch (cause) {
      const cancelled = cause instanceof Error && cause.name === "NotAllowedError";
      setError(
        cancelled
          ? "La verificación se canceló. Puedes intentarlo de nuevo o usar Telegram."
          : cause instanceof Error
            ? cause.message
            : "No se pudo verificar la passkey.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function enrollPasskey() {
    setBusy("enroll");
    setError("");
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const optionsPayload = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error("No se pudo preparar la passkey.");
      const credential = await startRegistration({
        optionsJSON: optionsPayload.options,
      });
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: optionsPayload.challengeId,
          response: credential,
        }),
      });
      const verifyPayload = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload.error || "No se pudo guardar la passkey.");
      }
      setPhase("done");
      window.location.assign(safeNext());
    } catch (cause) {
      const cancelled = cause instanceof Error && cause.name === "NotAllowedError";
      setError(
        cancelled
          ? "El registro se canceló. Tu sesión de Telegram sigue activa."
          : cause instanceof Error
            ? cause.message
            : "No se pudo registrar la passkey.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-manifesto" aria-label="Solvers Agency OS">
        <div className="auth-wordmark">
          <span className="auth-wordmark-mark">S</span>
          <span>
            <strong>SOLVERS</strong>
            <small>AGENCY OS · PRIVATE</small>
          </span>
        </div>
        <div className="auth-thesis">
          <span className="section-kicker">PRIVATE OPERATING SYSTEM</span>
          <h1>La agencia trabaja aquí.</h1>
          <p>
            Estrategia, contenido, automatizaciones y señales internas. Una sola
            identidad de operador. Cero acceso público.
          </p>
        </div>
        <div className="auth-security-line">
          <span><ShieldCheck size={15} /> Cifrado de origen</span>
          <span><KeyRound size={15} /> Passkey vinculada</span>
          <span className="live-text"><i /> Sistema protegido</span>
        </div>
      </section>

      <section className="auth-console" aria-label="Acceso de operador">
        <div className="auth-console-inner">
          <div className="auth-console-index">ACCESS / 01</div>

          {phase === "choose" && (
            <>
              <header className="auth-header">
                <span className="auth-icon"><Fingerprint size={24} /></span>
                <div>
                  <p>Acceso de operador</p>
                  <h2>Entra a Mission Control.</h2>
                </div>
              </header>
              <div className="auth-actions">
                <button
                  className="auth-primary"
                  onClick={loginWithPasskey}
                  disabled={busy !== null}
                >
                  <span>
                    {busy === "passkey" ? <LoaderCircle className="spin" size={18} /> : <Fingerprint size={18} />}
                    Entrar con {biometricLabel}
                  </span>
                  <ArrowRight size={17} />
                </button>
                <button
                  className="auth-secondary"
                  onClick={requestOtp}
                  disabled={busy !== null}
                >
                  <span>
                    {busy === "otp" ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
                    Enviar código a Telegram
                  </span>
                  <ArrowRight size={17} />
                </button>
              </div>
              <p className="auth-footnote">
                La primera entrada se valida por Telegram. Después puedes usar
                la biometría segura de este dispositivo.
              </p>
            </>
          )}

          {phase === "otp" && (
            <>
              <header className="auth-header">
                <span className="auth-icon"><Send size={22} /></span>
                <div>
                  <p>Telegram verificado</p>
                  <h2>Revisa el mensaje de Violeta.</h2>
                </div>
              </header>
              <label className="otp-field">
                <span>CÓDIGO DE 6 DÍGITOS</span>
                <input
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void verifyOtp();
                  }}
                  aria-label="Código OTP"
                />
              </label>
              <button
                className="auth-primary"
                onClick={verifyOtp}
                disabled={busy !== null || code.length !== 6}
              >
                <span>
                  {busy === "verify" ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
                  Verificar acceso
                </span>
                <ArrowRight size={17} />
              </button>
              <button className="auth-text-button" onClick={() => { setPhase("choose"); setCode(""); setError(""); }}>
                Volver a métodos de acceso
              </button>
            </>
          )}

          {phase === "enroll" && (
            <>
              <header className="auth-header">
                <span className="auth-icon auth-icon-ok"><Check size={22} /></span>
                <div>
                  <p>Telegram confirmado</p>
                  <h2>Activa {biometricLabel}.</h2>
                </div>
              </header>
              <div className="auth-enroll-note">
                <Fingerprint size={28} />
                <p>
                  La passkey queda protegida por tu dispositivo. Solvers nunca
                  recibe tu rostro, huella ni PIN.
                </p>
              </div>
              <button
                className="auth-primary"
                onClick={enrollPasskey}
                disabled={busy !== null}
              >
                <span>
                  {busy === "enroll" ? <LoaderCircle className="spin" size={18} /> : <Fingerprint size={18} />}
                  Configurar {biometricLabel}
                </span>
                <ArrowRight size={17} />
              </button>
              <button className="auth-text-button" onClick={() => window.location.assign(safeNext())}>
                Entrar ahora y configurarlo después
              </button>
            </>
          )}

          {phase === "done" && (
            <div className="auth-done">
              <span className="auth-icon auth-icon-ok"><Check size={24} /></span>
              <h2>Acceso confirmado.</h2>
              <p>Abriendo Mission Control…</p>
            </div>
          )}

          {error && <div className="auth-error" role="alert">{error}</div>}
        </div>
        <footer className="auth-console-footer">
          <span>SOLVERS SECURITY LAYER</span>
          <span>OTP · WEBAUTHN · RLS</span>
        </footer>
      </section>
    </main>
  );
}
