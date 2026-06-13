/* ============================================================
   CostPulse — Data Layer
   Menggantikan mock data dengan fetch ke FastAPI backend.
   window.HData diisi setelah /cost-summary berhasil diambil.
   ============================================================ */

const API_BASE = window.COSTPULSE_API || "http://localhost:8000";

const CAT_KEYS = ["obat", "alat_medis", "lab", "sdm", "utilitas"];

const CAT_CONFIG = {
  obat:       { label: "Obat & Farmasi",  short: "Obat",     color: "#8AA8D8", ico: "Obat" },
  alat_medis: { label: "Alat Medis",       short: "Alat",     color: "#B890C2", ico: "AlatMedis" },
  lab:        { label: "Laboratorium",     short: "Lab",      color: "#78BAA8", ico: "Lab" },
  sdm:        { label: "SDM",              short: "SDM",      color: "#D8B878", ico: "SDM" },
  utilitas:   { label: "Utilitas",         short: "Utilitas", color: "#C88880", ico: "Utilitas" },
};

/* Nilai awal (placeholder) — akan digantikan data API */
let DASHBOARD = {
  grand_total: 0,
  by_category: {
    obat:       { total: 0, pct: 0 },
    alat_medis: { total: 0, pct: 0 },
    lab:        { total: 0, pct: 0 },
    sdm:        { total: 0, pct: 0 },
    utilitas:   { total: 0, pct: 0 },
  },
  trend_monthly: Array.from({ length: 12 }, (_, i) => ({ periode: `Bln ${i+1}`, total: 0 })),
  by_department: [],
};

let INDICES = [
  { key: "cost_obat",        name: "Biaya Obat",        count: "1.000", ico: "Obat" },
  { key: "cost_alat_medis",  name: "Biaya Alat Medis",  count: "1.000", ico: "AlatMedis" },
  { key: "cost_lab",         name: "Biaya Lab",         count: "1.000", ico: "Lab" },
  { key: "cost_sdm",         name: "Biaya SDM",         count: "1.000", ico: "SDM" },
  { key: "cost_utilitas",    name: "Biaya Utilitas",    count: "2.520", ico: "Utilitas" },
  { key: "cost_departments", name: "Departemen",        count: "10",    ico: "Dept" },
  { key: "cost_monthly",     name: "Ringkasan Bulanan", count: "360",   ico: "Monthly" },
];

const EXAMPLES = [
  "Berapa total biaya obat & farmasi?",
  "Departemen mana yang biaya operasionalnya tertinggi?",
  "Bagaimana tren biaya operasional 12 bulan terakhir?",
  "Berapa biaya depresiasi alat medis?",
  "Apa obat dengan biaya pemakaian tertinggi?",
  "Berapa total biaya utilitas & overhead?",
  "Bagaimana realisasi anggaran vs biaya aktual?",
  "Jabatan SDM mana yang kompensasinya paling besar?",
];

/* ---- Formatters ---- */
function formatRp(jt) {
  if (jt >= 1000000) return "Rp " + (jt / 1000000).toFixed(2).replace(".", ",") + " T";
  if (jt >= 1000)    return "Rp " + (jt / 1000).toFixed(2).replace(".", ",") + " M";
  return "Rp " + Number(jt).toLocaleString("id-ID") + " jt";
}

function formatRpFull(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

/* ---- Block builders ---- */
const txt     = (t, lead) => ({ type: "text", text: t, lead });
const stat    = (items)   => ({ type: "stats", items });
const bill    = (o)       => ({ type: "bill", ...o });
const ents    = (title, items) => ({ type: "entities", title, items });
const chks    = (title, items) => ({ type: "checks", title, items });
const sources = (items)   => ({ type: "sources", items });

/* ============================================================
   FETCH DARI BACKEND — /cost-summary & /ask
   ============================================================ */

/* Muat dashboard summary dan perbarui DASHBOARD */
async function loadDashboard() {
  try {
    const r = await fetch(API_BASE + "/cost-summary");
    if (!r.ok) throw new Error("status " + r.status);
    const d = await r.json();

    const cat = d.by_category || {};
    const totalJt = Math.round((cat.total || 0) / 1_000_000);

    DASHBOARD = {
      grand_total: totalJt,
      by_category: {
        obat:       { total: Math.round((cat.obat?.value || 0)     / 1_000_000), pct: cat.obat?.pct     || 0 },
        alat_medis: { total: Math.round((cat.alat?.value || 0)     / 1_000_000), pct: cat.alat?.pct     || 0 },
        lab:        { total: Math.round((cat.lab?.value || 0)      / 1_000_000), pct: cat.lab?.pct      || 0 },
        sdm:        { total: Math.round((cat.sdm?.value || 0)      / 1_000_000), pct: cat.sdm?.pct      || 0 },
        utilitas:   { total: Math.round((cat.utilitas?.value || 0) / 1_000_000), pct: cat.utilitas?.pct || 0 },
      },
      trend_monthly: (d.trend_monthly || []).map(t => ({
        periode: t.periode,
        total:   Math.round(t.total / 1_000_000),
      })),
      by_department: (d.by_department || []).map(dep => ({
        name:  dep.nama,
        total: Math.round(dep.total / 1_000_000),
        pct:   cat.total ? Math.round(dep.total / cat.total * 1000) / 10 : 0,
      })),
    };

    /* Perbarui count indices dari /stats */
    try {
      const sr = await fetch(API_BASE + "/stats");
      if (sr.ok) {
        const sd = await sr.json();
        const idx = sd.indices || {};
        INDICES = INDICES.map(ix => {
          const key = ix.key.replace("cost_", "");
          const cnt = idx[key] || idx[ix.key];
          return cnt !== undefined
            ? { ...ix, count: Number(cnt).toLocaleString("id-ID") }
            : ix;
        });
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent("costpulse-data-ready"));
  } catch (e) {
    console.warn("loadDashboard error:", e);
    window.dispatchEvent(new CustomEvent("costpulse-data-ready"));
  }
}

/* ============================================================
   INTENT ENGINE — memanggil /ask ke backend RAG
   ============================================================ */
async function answerFor(question) {
  try {
    const r = await fetch(API_BASE + "/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, max_results: 8 }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();

    /* Konversi plain-text answer LLM ke format blocks */
    const blocks = [
      txt(data.answer, true),
    ];

    if (data.sources && data.sources.length > 0) {
      blocks.push(sources(data.sources.map(s => ({
        index: s.index,
        hits:  s.score !== undefined ? s.score : "-",
      }))));
    }
    return { blocks };
  } catch (e) {
    return {
      blocks: [
        txt("Terjadi kesalahan saat menghubungi backend. Pastikan Railway backend sudah aktif dan CORS sudah dikonfigurasi.", true),
        txt("Error: " + e.message),
        sources([]),
      ],
    };
  }
}

function scanIndicesFor(q) {
  const ql = q.toLowerCase();
  const scan = [];
  if (/obat|farmasi|apotek|supplier/.test(ql))        scan.push("cost_obat");
  if (/alat|medis|depresiasi|maintenance/.test(ql))   scan.push("cost_alat_medis");
  if (/lab|reagen|pemeriksaan/.test(ql))              scan.push("cost_lab");
  if (/sdm|gaji|karyawan|jabatan|lembur/.test(ql))   scan.push("cost_sdm");
  if (/utilitas|listrik|air|gas|limbah/.test(ql))     scan.push("cost_utilitas");
  if (/departemen|dept/.test(ql))                     scan.push("cost_departments");
  if (/bulanan|tren|anggaran|realisasi/.test(ql))     scan.push("cost_monthly");
  return scan.length ? scan : ["cost_obat", "cost_sdm", "cost_departments", "cost_monthly"];
}

/* Ekspor ke window */
window.HData = {
  CAT_KEYS, CAT_CONFIG,
  get DASHBOARD() { return DASHBOARD; },
  get INDICES()   { return INDICES; },
  EXAMPLES,
  formatRp, formatRpFull,
  answerFor, scanIndicesFor,
  loadDashboard,
};

/* Auto-load saat script pertama kali dieksekusi */
loadDashboard();
