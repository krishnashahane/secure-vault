"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Cloud,
  Eye,
  Github,
  Instagram,
  Key,
  Linkedin,
  Loader2,
  Lock,
  Menu,
  Send,
  Shield,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AuthPanel } from "./auth-panel";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
  }),
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const FEATURES = [
  { icon: Shield, title: "AES-256 Encryption", desc: "Military-grade encryption applied client-side before any data leaves your device." },
  { icon: Cloud, title: "Secure Cloud Storage", desc: "Encrypted files stored on hardened infrastructure with redundant backups." },
  { icon: Key, title: "Google Authentication", desc: "Sign in securely with Google OAuth for seamless, passwordless access." },
  { icon: UploadCloud, title: "Upload up to 500 MB", desc: "Store large files effortlessly with real-time progress tracking." },
  { icon: Lock, title: "Protected Sessions", desc: "HttpOnly cookies and session tokens prevent XSS and CSRF attacks." },
  { icon: Zap, title: "Fast File Access", desc: "Optimized delivery from edge servers for lightning-fast retrieval." },
  { icon: Eye, title: "End-to-End Encryption", desc: "Zero-knowledge architecture — we never see your plaintext data. Ever." },
  { icon: Users, title: "Secure Authentication", desc: "Rate-limited endpoints with math captcha protection against bots." },
];

const DEVS = [
  {
    name: "Saumya Shah",
    role: "Full Stack & Security Engineer",
    desc: "Architected the AES-GCM encryption pipeline, backend APIs, and cloud infrastructure.",
    img: "/saumya.png",
    imgPos: "center top",
    imgTransform: "scale(1.5)",
    isLead: true,
    github: "https://github.com/Saumya039",
    linkedin: "https://www.linkedin.com/in/saumyashah039",
    instagram: "https://www.instagram.com/saumya_039_/",
  },
  {
    name: "Sneha Saxena",
    role: "Frontend Developer & UI Designer",
    desc: "Crafted the premium interface, glassmorphism design system, and user experience flows.",
    img: "/sneha.png",
    imgPos: "right center",
    imgTransform: "scale(1.3)",
    isLead: false,
    github: "https://github.com/sneha400saxena-sudo",
    linkedin: "https://www.linkedin.com/in/sneha-saxena-7b29a0368/",
    instagram: "https://www.instagram.com/snehasaxena_24/",
  },
  {
    name: "Supriya Ranjan",
    role: "Backend Developer & Database Engineer",
    desc: "Built the secure REST API layer, database schema, and authentication flows.",
    img: "/supriya.png",
    imgPos: "center 30%",
    imgTransform: "scale(1.6)",
    isLead: false,
    github: "https://github.com/supriyaranjan2007-droid",
    linkedin: "https://www.linkedin.com/in/supriyaranjann/",
    instagram: "https://www.instagram.com/supriyaranjann/",
  },
];

type ContactStatus = "idle" | "loading" | "success" | "error";

export function LandingPage({ isConfigured, hasGoogle }: { isConfigured: boolean; hasGoogle: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [contactStatus, setContactStatus] = useState<ContactStatus>("idle");
  const [contactError, setContactError] = useState("");
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  }

  async function handleContact(e: FormEvent) {
    e.preventDefault();
    setContactStatus("loading");
    setContactError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send.");
      setContactStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setContactStatus("error");
      setContactError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="landing-page">
      {/* ── NAV ── */}
      <nav className="landing-nav">
        <div className="nav-inner">
          <button className="nav-brand" onClick={() => scrollTo("home")} type="button">
            <Lock size={18} />
            <span>SecureVault</span>
          </button>
          <div className={`nav-links${mobileOpen ? " open" : ""}`}>
            {(["features", "team", "contact"] as const).map((id) => (
              <button key={id} className="nav-link" onClick={() => scrollTo(id)} type="button">
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
            <motion.button
              className="nav-cta"
              onClick={() => scrollTo("vault")}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
            >
              Launch Vault
            </motion.button>
          </div>
          <button className="nav-burger" onClick={() => setMobileOpen(!mobileOpen)} type="button" aria-label="Menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section" id="home">
        <div className="hero-bg" aria-hidden="true">
          <motion.div
            className="hero-orb hero-orb-1"
            animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="hero-orb hero-orb-2"
            animate={{ x: [0, -25, 0], y: [0, 18, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          <div className="hero-grid" />
        </div>
        <motion.div className="hero-content" style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div className="hero-badge" variants={fadeUp} initial="hidden" animate="show" custom={0}>
            <Shield size={13} />
            <span>AES-256 Encrypted · Zero Knowledge</span>
          </motion.div>
          <motion.h1 className="hero-heading" variants={fadeUp} initial="hidden" animate="show" custom={1}>
            Military Grade<br />
            <span className="gradient-text">Secure Cloud Vault</span>
          </motion.h1>
          <motion.p className="hero-sub" variants={fadeUp} initial="hidden" animate="show" custom={2}>
            Securely upload, encrypt, and manage your files with advanced AES-GCM
            encryption and hardened cloud storage. Your data stays yours — always.
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp} initial="hidden" animate="show" custom={3}>
            <motion.button
              className="hero-btn-primary"
              onClick={() => scrollTo("vault")}
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <Lock size={16} />
              Launch Vault
            </motion.button>
            <motion.a
              className="hero-btn-outline"
              href="https://github.com/Saumya039"
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <Github size={16} />
              View GitHub
            </motion.a>
          </motion.div>
          <motion.div className="hero-stats" variants={stagger} initial="hidden" animate="show">
            <motion.div className="hero-stat" variants={fadeUp} custom={4}>
              <span className="stat-val">AES‑256</span>
              <span className="stat-label">Encryption</span>
            </motion.div>
            <div className="hero-stat-divider" />
            <motion.div className="hero-stat" variants={fadeUp} custom={4.5}>
              <span className="stat-val">500 MB</span>
              <span className="stat-label">Max Upload</span>
            </motion.div>
            <div className="hero-stat-divider" />
            <motion.div className="hero-stat" variants={fadeUp} custom={5}>
              <span className="stat-val">Zero</span>
              <span className="stat-label">Plaintext Storage</span>
            </motion.div>
          </motion.div>
        </motion.div>
        <motion.button
          className="scroll-down"
          onClick={() => scrollTo("features")}
          type="button"
          aria-label="Scroll down"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <ChevronDown size={20} />
        </motion.button>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-section features-section" id="features">
        <div className="section-inner">
          <div className="section-header reveal">
            <p className="section-eyebrow">Why SecureVault</p>
            <h2 className="section-title">Built for Security</h2>
            <p className="section-sub">Enterprise-grade protection with a developer-first experience.</p>
          </div>
          <motion.div
            className="features-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
          >
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="feature-card"
                variants={fadeUp}
                custom={i * 0.5}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                <motion.div
                  className="feature-icon"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Icon size={20} />
                </motion.div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-desc">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── DEVS ── */}
      <section className="lp-section devs-section" id="team">
        <div className="section-inner">
          <div className="section-header reveal">
            <p className="section-eyebrow">The Team</p>
            <h2 className="section-title">Meet The Developers</h2>
            <p className="section-sub">The minds behind the encryption and the interface.</p>
          </div>
          <motion.div
            className="devs-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {DEVS.map((dev, i) => (
              <motion.div
                key={dev.name}
                className={`dev-card${dev.isLead ? " dev-card-lead" : ""}`}
                variants={fadeUp}
                custom={i * 0.6}
                whileHover={{ y: -10, transition: { duration: 0.25 } }}
              >
                {dev.isLead && <span className="lead-badge">Lead</span>}
                <div className="dev-card-body">
                  <div className="dev-avatar-wrap">
                    <img
                      src={dev.img}
                      alt={dev.name}
                      className="dev-avatar"
                      style={{ objectFit: "cover", objectPosition: dev.imgPos, transform: dev.imgTransform }}
                    />
                    <div className="dev-avatar-glow" />
                  </div>
                  <h3 className="dev-name">{dev.name}</h3>
                  <p className="dev-role">{dev.role}</p>
                  <p className="dev-desc">{dev.desc}</p>
                  <div className="dev-socials">
                    {[
                      { href: dev.github, icon: <Github size={15} />, label: "GitHub" },
                      { href: dev.linkedin, icon: <Linkedin size={15} />, label: "LinkedIn" },
                      { href: dev.instagram, icon: <Instagram size={15} />, label: "Instagram" },
                    ].map(({ href, icon, label }) => (
                      <motion.a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="social-link"
                        title={label}
                        whileHover={{ scale: 1.15, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {icon}
                      </motion.a>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── AUTH / VAULT ── */}
      <section className="lp-section auth-lp-section" id="vault">
        <div className="section-inner">
          <div className="section-header reveal">
            <p className="section-eyebrow">Access Your Vault</p>
            <h2 className="section-title">Secure Login</h2>
            <p className="section-sub">Your encrypted files are one passphrase away.</p>
          </div>
          <div className="auth-lp-wrap">
            <AuthPanel isConfigured={isConfigured} hasGoogle={hasGoogle} />
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="lp-section contact-section" id="contact">
        <div className="section-inner">
          <div className="section-header reveal">
            <p className="section-eyebrow">Get In Touch</p>
            <h2 className="section-title">Contact Us</h2>
            <p className="section-sub">Questions, feedback, or just want to say hi? We read every message.</p>
          </div>
          <div className="contact-wrap reveal">
            <form className="contact-form" onSubmit={handleContact}>
              <div className="contact-row">
                <label className="field">
                  <span>Name</span>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </label>
              </div>
              <label className="field">
                <span>Message</span>
                <textarea
                  required
                  rows={5}
                  placeholder="Tell us what's on your mind..."
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                />
              </label>
              {contactStatus === "error" && (
                <p className="form-message error" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={14} />
                  {contactError}
                </p>
              )}
              {contactStatus === "success" && (
                <p className="form-message success">
                  <CheckCircle size={14} />
                  Message sent! We&apos;ll get back to you soon.
                </p>
              )}
              <motion.button
                type="submit"
                className="primary-action"
                disabled={contactStatus === "loading" || contactStatus === "success"}
                whileHover={{ scale: contactStatus === "loading" || contactStatus === "success" ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {contactStatus === "loading" ? (
                  <Loader2 className="spin" size={18} />
                ) : contactStatus === "success" ? (
                  <CheckCircle size={18} />
                ) : (
                  <Send size={18} />
                )}
                {contactStatus === "success" ? "Message Sent!" : "Send Message"}
              </motion.button>
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Lock size={17} />
            <span>SecureVault</span>
          </div>
          <p className="footer-tagline">Military-grade encrypted cloud storage.</p>
          <div className="footer-links">
            <a href="https://github.com/Saumya039" target="_blank" rel="noreferrer">GitHub</a>
            <span className="footer-dot" />
            <a href="https://www.linkedin.com/in/saumyashah039" target="_blank" rel="noreferrer">LinkedIn</a>
            <span className="footer-dot" />
            <a href="https://www.instagram.com/saumya_039_/" target="_blank" rel="noreferrer">Instagram</a>
            <span className="footer-dot" />
            <button type="button" onClick={() => scrollTo("contact")}>Contact</button>
            <span className="footer-dot" />
            <button type="button" onClick={() => scrollTo("vault")}>Login</button>
          </div>
          <p className="footer-stack">Built with Next.js · TypeScript · NeonDB · AES-GCM · Vercel</p>
          <p className="footer-copy">© 2025 SecureVault. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
