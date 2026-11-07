"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function AuthIntro({ children }: { children: ReactNode }) {
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShowForm(true);
      return;
    }
    const timer = window.setTimeout(() => setShowForm(true), 1450);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="auth-intro-shell">
      <div className="auth-intro-stage" aria-hidden="true">
        <div className="auth-speed-trail auth-speed-trail-one" />
        <div className="auth-speed-trail auth-speed-trail-two" />
        <img
          src="/images/sugomate-eagle-road-logo.png"
          alt=""
          className="auth-intro-logo"
          fetchPriority="high"
        />
        <p className="auth-intro-tagline">Imong sugo, among ihatod.</p>
      </div>
      <div className={`auth-login-content ${showForm ? "auth-login-content-visible" : ""}`}>
        {children}
      </div>
    </div>
  );
}
