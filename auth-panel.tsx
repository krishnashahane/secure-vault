"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, LockKeyhole, LogIn, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { PIN_LENGTH } from "@/lib/limits";

type AuthMode = "login" | "register";

type AuthPanelProps = {
  isConfigured: boolean;
  hasGoogle: boolean;
};

type CaptchaData = {
  question: string;
  token: string;
};

export function AuthPanel({ isConfigured, hasGoogle }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/captcha");
      const data = (await res.json()) as CaptchaData;
      setCaptcha(data);
      setCaptchaAnswer("");
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => {
    if (mode === "register") {
      loadCaptcha();
    }
  }, [mode, loadCaptcha]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = { email, password: pin };

      if (mode === "register") {
        if (!captcha) {
          setMessage("Security check not loaded. Try again.");
          setIsSubmitting(false);
          return;
        }
        body.captchaAnswer = captchaAnswer;
        body.captchaToken = captcha.token;
      }

      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (mode === "register") loadCaptcha();
        throw new Error(payload.error ?? "Authentication failed.");
      }

      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout" aria-labelledby="auth-title">
      <div className="identity-panel">
        <div className="brand-mark" aria-hidden="true">
          <LockKeyhole size={28} />
        </div>
        <p className="eyebrow">saumyas.dev</p>
        <h1 id="auth-title">Secure Vault</h1>
        <dl className="status-grid">
          <div>
            <dt>Encryption</dt>
            <dd>AES-GCM</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>{isConfigured ? "Ready" : "Needs URL"}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>HttpOnly</dd>
          </div>
        </dl>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="segmented-control" role="tablist" aria-label="Authentication mode">
          <button
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            role="tab"
            type="button"
          >
            <LogIn size={16} />
            Sign in
          </button>
          <button
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            role="tab"
            type="button"
          >
            <UserPlus size={16} />
            Create
          </button>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>PIN ({PIN_LENGTH} digits)</span>
          <input
            autoComplete="off"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            onChange={(event) => {
              const v = event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
              setPin(v);
            }}
            pattern="[0-9]{4}"
            placeholder="Enter 4-digit PIN"
            required
            type="password"
            value={pin}
          />
        </label>

        {mode === "register" && captcha && (
          <div className="captcha-section">
            <div className="captcha-row">
              <ShieldCheck size={16} />
              <span className="captcha-label">Security check</span>
              <button
                className="icon-button captcha-refresh"
                onClick={(e) => { e.preventDefault(); loadCaptcha(); }}
                title="New question"
                type="button"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <p className="captcha-question">{captcha.question}</p>
            <input
              autoComplete="off"
              className="captcha-input"
              inputMode="numeric"
              onChange={(event) => setCaptchaAnswer(event.target.value)}
              placeholder="Your answer"
              required
              type="text"
              value={captchaAnswer}
            />
          </div>
        )}

        {mode === "register" && (
          <div className="privacy-notice">
            <p>
              By creating an account you consent to the collection of your email address
              for authentication. Uploaded files are encrypted client-side before
              transmission — we never access unencrypted data. No information is
              shared with third parties. You may delete your account and data at any
              time.
            </p>
          </div>
        )}

        {message ? <p className="form-message error">{message}</p> : null}
        {!isConfigured ? <p className="form-message error">DATABASE_URL is required before login.</p> : null}

        <button className="primary-action" disabled={isSubmitting || !isConfigured} type="submit">
          {isSubmitting ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>

        {hasGoogle && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <a className="google-button" href="/api/auth/google">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Sign in with Google
            </a>
          </>
        )}
      </form>
    </section>
  );
}
