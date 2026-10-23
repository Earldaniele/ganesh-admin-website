"use client";
import { adminMessage } from "@/lib/admin-presentation";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const emailInput = form.elements.namedItem("email");
    const passwordInput = form.elements.namedItem("password");
    const submittedEmail = emailInput && "value" in emailInput ? String(emailInput.value).trim() : "";
    const submittedPassword = passwordInput && "value" in passwordInput ? String(passwordInput.value) : "";
    setError("");
    if (!submittedEmail || !submittedPassword) {
      setError("Enter your email and password to continue.");
      return;
    }
    if (!submittedEmail.includes("@")) {
      setError("Use a valid email address.");
      return;
    }
    setLoading(true);
    try {
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: submittedEmail, password: submittedPassword, remember }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setLoading(false);
      setError(result.error || "That account could not be signed in.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
    } catch {
      setError("Cannot connect. Please try again or contact your administrator.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.includes("@")) { setError("Enter your account email first."); return; }
    setError("Self-service password recovery is not available. Contact your administrator for account assistance.");
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Ganesh Garments admin welcome">
        <div className="login-story-overlay" />
        <div className="login-story-top"><span className="stitch-line" /><span>Ganesh workspace</span></div>
        <div className="login-story-copy">
          <span className="story-kicker">Your craft, clearly managed</span>
          <h1>Shape the story behind every stitch.</h1>

        </div>
        <p className="login-story-foot">Made with purpose. Crafted to last.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <BrandLogo />
          <div className="login-heading">
            <p className="eyebrow">Ganesh Admin</p>
            <h2>Welcome back</h2>
            <p>Sign in to manage your website.</p>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="email">Email address</label>
            <div className="input-with-icon">
              <Icon name="mail" />
              <input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@ganeshgarments.com" autoComplete="email" required aria-invalid={Boolean(error)} />
            </div>
            <label className="field-label" htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Icon name="lock" />
              <input id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required aria-invalid={Boolean(error)} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}><Icon name={showPassword ? "eye-off" : "eye"} /></button>
            </div>
            <div className="login-options">
              <label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Remember me</span></label>
              <button type="button" className="text-button" onClick={handleForgotPassword}>Forgot password?</button>
            </div>
            {error ? <p className="form-error" role="alert">{adminMessage(error)}</p> : null}
            <button className="primary-button login-button" disabled={loading} type="submit">
              {loading ? <span className="spinner" /> : <Icon name="lock" />}
              {loading ? "Opening workspace…" : "Sign in"}
            </button>
          </form>
          <p className="prototype-note"><span /> Need access? Contact your administrator.</p>
        </div>
        <p className="login-copyright">© 2026 Ganesh Garments. Admin workspace.</p>
      </section>
    </main>
  );
}
