/* ============================================================
   SVG Icons — stroke-based, currentColor
   ============================================================ */
const Ico = {
  Cross: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none">
      <path d="M10 3.5h4a1.5 1.5 0 0 1 1.5 1.5V8.5H19a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 19 15.5h-3.5V19a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 19v-3.5H5A1.5 1.5 0 0 1 3.5 14v-4A1.5 1.5 0 0 1 5 8.5h3.5V5A1.5 1.5 0 0 1 10 3.5Z" fill="currentColor"/>
    </svg>
  ),
  Pulse: (p) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none">
      <path d="M2 13.5h3l2.2-5.5 3.3 11.5L14 4.5l3.3 11L19.5 9H22"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Obat: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="2.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.7"/>
      <rect x="6" y="8" width="12" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M12 12.5v3.5M10.2 14.3h3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  AlatMedis: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <path d="M2 12h4l2.5-6 4 13L16 9l2 3h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Lab: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <path d="M9 3v6l-5 8.5a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L15 9V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 3h6M7 15h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  SDM: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.7"/>
      <circle cx="16" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M2 19c0-2.8 2.7-5 6-5s6 2.2 6 5M10 19c0-2.8 2.7-5 6-5s6 2.2 6 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Utilitas: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Dept: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <path d="M4 20V7l8-3.5L20 7v13" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M4 20h16M10 11h4M12 9v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Monthly: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Index: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  ),
  Spinner: (p) => (
    <svg className="spin" width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2"/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  ),
  Check: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" opacity="0.4"/>
      <path d="m8 12 2.7 2.7L16 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Arrow: (p) => (
    <svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Reset: (p) => (
    <svg width={p.s||15} height={p.s||15} viewBox="0 0 24 24" fill="none">
      <path d="M4 5v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.5 10a8 8 0 1 1-.7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Send: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <path d="M4 12 20 4l-5 16-3.5-6L4 12Z" fill="currentColor"/>
    </svg>
  ),
  User: (p) => (
    <svg width={p.s||18} height={p.s||18} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M5 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Shield: (p) => (
    <svg width={p.s||13} height={p.s||13} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 5 6v5c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Spark: (p) => (
    <svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Bill: (p) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h12v17l-3-1.6-3 1.6-3-1.6-3 1.6V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M9 8h6M9 11.5h6M9 15h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
};

window.Ico = Ico;
