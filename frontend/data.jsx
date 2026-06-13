/* ============================================================
   CostPulse — Data Layer  v3
   Backend: FastAPI @ Railway | /cost-summary | /ask | /stats
   ============================================================ */

const API_BASE = window.COSTPULSE_API || "http://localhost:8000";

const CAT_KEYS = ["obat", "alat_medis", "lab", "sdm", "utilitas"];

const CAT_CONFIG = {
  obat:       { label: "Obat & Farmasi",  short: "Obat",     color: "#00daf3", soft: "rgba(0,218,243,0.12)",   icon: "medication" },
  alat_medis: { label: "Alat Medis",       short: "Alat",     color: "#d8b9ff", soft: "rgba(216,185,255,0.12)", icon: "build" },
  lab:        { label: "Laboratorium",     short: "Lab",      color: "#9cf0ff", soft: "rgba(156,240,255,0.12)", icon: "biotech" },
  sdm:        { label: "SDM & Nakes",      short: "SDM",      color: "#cdcdf6", soft: "rgba(205,205,246,0.12)", icon: "group" },
  utilitas:   { label: "Utilitas",         short: "Utilitas", color: "#ffb4ab", soft: "rgba(255,180,171,0.12)", icon: "bolt" },
};

/* Placeholder awal */
let DASHBOARD = {
  grand_total: 0,
  by_category: {
    obat:       { total: 0, pct: 0 },
    alat_medis: { total: 0, pct: 0 },
    lab:        { total: 0, pct: 0 },
    sdm:        { total: 0, pct: 0 },
    utilitas:   { total: 0, pct: 0 },
  },
  trend_monthly: [],
  by_department: [],
  /* extended */
  top_obat:         [],
  top_alat:         [],
  top_sdm_jabatan:  [],
  utilitas_breakdown: [],
  trend_full: [],  /* raw dari backend (per kategori) */
};

let INDICES = [
  { key: "cost_obat",        name: "Biaya Obat",        count: "—", icon: "medication" },
  { key: "cost_alat_medis",  name: "Biaya Alat Medis",  count: "—", icon: "build" },
  { key: "cost_lab",         name: "Biaya Lab",         count: "—", icon: "biotech" },
  { key: "cost_sdm",         name: "Biaya SDM",         count: "—", icon: "group" },
  { key: "cost_utilitas",    name: "Biaya Utilitas",    count: "—", icon: "bolt" },
  { key: "cost_departments", name: "Departemen",        count: "—", icon: "apartment" },
  { key: "cost_monthly",     name: "Ringkasan Bulanan", count: "—", icon: "calendar_month" },
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
  "Berapa total biaya SDM dan berapa orangnya?",
  "Breakdown biaya laboratorium per jenis pemeriksaan?",
];

/* ---- Formatters ---- */
function formatRp(val, unit = "jt") {
  if (unit === "raw") {
    if (val >= 1_000_000_000) return "Rp " + (val / 1_000_000_000).toFixed(2).replace(".", ",") + " M";
    if (val >= 1_000_000)     return "Rp " + (val / 1_000_000).toFixed(1).replace(".", ",") + " jt";
    return "Rp " + Number(val).toLocaleString("id-ID");
  }
  /* val dalam juta */
  if (val >= 1_000_000) return "Rp " + (val / 1_000_000).toFixed(2).replace(".", ",") + " T";
  if (val >= 1_000)     return "Rp " + (val / 1_000).toFixed(2).replace(".", ",") + " M";
  return "Rp " + Number(val).toLocaleString("id-ID") + " jt";
}

function formatRpFull(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

/* ============================================================
   LOAD DASHBOARD
   ============================================================ */
async function loadDashboard() {
  try {
    const r = await fetch(API_BASE + "/cost-summary");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();

    const cat   = d.by_category   || {};
    const total = cat.total || 0;
    const toJt  = v => Math.round(v / 1_000_000);

    DASHBOARD = {
      grand_total:   toJt(total),
      by_category: {
        obat:       { total: toJt(cat.obat?.value || 0),      pct: cat.obat?.pct     || 0 },
        alat_medis: { total: toJt(cat.alat?.value || 0),      pct: cat.alat?.pct     || 0 },
        lab:        { total: toJt(cat.lab?.value  || 0),      pct: cat.lab?.pct      || 0 },
        sdm:        { total: toJt(cat.sdm?.value  || 0),      pct: cat.sdm?.pct      || 0 },
        utilitas:   { total: toJt(cat.utilitas?.value || 0),  pct: cat.utilitas?.pct || 0 },
      },
      trend_monthly: (d.trend_monthly || []).map(t => ({
        periode: t.periode,
        total:   toJt(t.total),
      })),
      trend_full: (d.trend_monthly || []).map(t => ({
        periode:  t.periode,
        total:    toJt(t.total),
        obat:     toJt(t.obat     || 0),
        alat:     toJt(t.alat     || 0),
        lab:      toJt(t.lab      || 0),
        sdm:      toJt(t.sdm      || 0),
        utilitas: toJt(t.utilitas || 0),
        anggaran: toJt(t.anggaran || 0),
      })),
      by_department: (d.by_department || []).map(dep => ({
        name:  dep.nama,
        total: toJt(dep.total),
        obat:  toJt(dep.obat  || 0),
        sdm:   toJt(dep.sdm   || 0),
        pct:   total ? Math.round(dep.total / total * 1000) / 10 : 0,
      })),
      top_obat:          d.top_obat          || [],
      top_alat:          d.top_alat          || [],
      top_sdm_jabatan:   d.top_sdm_jabatan   || [],
      utilitas_breakdown: d.utilitas_breakdown || [],
    };

    /* Update index counts */
    try {
      const sr = await fetch(API_BASE + "/stats");
      if (sr.ok) {
        const sd = await sr.json();
        const idx = sd.indices || {};
        INDICES = INDICES.map(ix => {
          const key = ix.key.replace("cost_", "");
          const cnt = idx[key] || idx[ix.key];
          return cnt !== undefined ? { ...ix, count: Number(cnt).toLocaleString("id-ID") } : ix;
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
   VISUAL PARSER — deteksi angka & struktur dari teks LLM
   ============================================================ */
function parseAnswerToBlocks(text, sources) {
  const blocks = [];

  /* --- 1. Ekstrak angka rupiah dari teks --- */
  const rpPattern = /(?:Rp\s*[\d.,]+(?:\s*[MjmtT])?|[\d.,]+\s*(?:juta|miliar|ribu))/gi;
  const allNums = [...text.matchAll(rpPattern)].map(m => m[0]);

  /* --- 2. Cek apakah ada struktur list breakdown (baris "- Key: Rp X") --- */
  const bulletLines = text.split("\n").filter(l => /^\s*[-•]\s+.+:\s*Rp\s*[\d.,]+/.test(l));

  /* --- 3. Cek breakdown per jabatan / per dept (baris dengan pola "  - Name (N org):") --- */
  const jabatanLines = text.split("\n").filter(l => /^\s*[-•]\s+.+\(\d+\s*orang\)/.test(l));

  /* --- 4. Cek tren per tahun --- */
  const tahunLines = text.split("\n").filter(l => /20\d\d.*Rp\s*[\d.,]+/.test(l));

  /* Teks utama */
  blocks.push({ type: "text", text, lead: true });

  /* Jika ada bullet breakdown Rp → buat bar chart */
  if (bulletLines.length >= 2) {
    const items = bulletLines.map(l => {
      const match = l.match(/[-•]\s+(.+?):\s*(Rp[\s\d.,]+[MjmtT]?)/);
      if (!match) return null;
      const label = match[1].trim();
      const rawVal = match[2].replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
      const val = parseFloat(rawVal) || 0;
      return { label, val, raw: match[2].trim() };
    }).filter(Boolean);

    if (items.length >= 2) {
      blocks.push({ type: "bar_chart", title: "Breakdown Biaya", items });
    }
  }

  /* Jika ada jabatan lines → tabel */
  if (jabatanLines.length >= 2) {
    const rows = jabatanLines.map(l => {
      const m = l.match(/[-•]\s+(.+?)\s*\((\d+)\s*orang\).*?(Rp[\s\d.,]+[MjmtTmiliar]*)/i);
      if (!m) return null;
      return { jabatan: m[1].trim(), jumlah: m[2], total: m[3].trim() };
    }).filter(Boolean);
    if (rows.length >= 2) {
      blocks.push({ type: "table", title: "Detail per Jabatan", cols: ["Jabatan", "Jumlah", "Total Kompensasi"], rows: rows.map(r => [r.jabatan, r.jumlah + " org", r.total]) });
    }
  }

  /* Jika ada tahun lines → simple bar */
  if (tahunLines.length >= 2 && bulletLines.length < 2) {
    const items = tahunLines.map(l => {
      const m = l.match(/20(\d\d)[^\d]*(Rp[\s\d.,]+[MjmtT]?)/i);
      if (!m) return null;
      const rawVal = m[2].replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
      return { label: "20" + m[1], val: parseFloat(rawVal) || 0, raw: m[2].trim() };
    }).filter(Boolean);
    if (items.length >= 2) {
      blocks.push({ type: "bar_chart", title: "Perbandingan per Tahun", items });
    }
  }

  /* Sources */
  if (sources && sources.length > 0) {
    blocks.push({ type: "sources", items: sources.map(s => ({ index: s.index, score: s.score })) });
  }

  return blocks;
}

/* ============================================================
   answerFor — RAG call
   ============================================================ */
async function answerFor(question) {
  const r = await fetch(API_BASE + "/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, max_results: 8 }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  const blocks = parseAnswerToBlocks(data.answer, data.sources || []);
  return { blocks };
}

function scanIndicesFor(q) {
  const ql = q.toLowerCase();
  const scan = [];
  if (/obat|farmasi|apotek/.test(ql))          scan.push("cost_obat");
  if (/alat|medis|depresiasi/.test(ql))         scan.push("cost_alat_medis");
  if (/lab|reagen|pemeriksaan/.test(ql))        scan.push("cost_lab");
  if (/sdm|gaji|karyawan|jabatan/.test(ql))     scan.push("cost_sdm");
  if (/utilitas|listrik|air|gas/.test(ql))      scan.push("cost_utilitas");
  if (/departemen|dept/.test(ql))               scan.push("cost_departments");
  if (/bulanan|tren|anggaran|realisasi/.test(ql)) scan.push("cost_monthly");
  return scan.length ? scan : ["cost_obat","cost_sdm","cost_departments","cost_monthly"];
}

window.HData = {
  CAT_KEYS, CAT_CONFIG,
  get DASHBOARD() { return DASHBOARD; },
  get INDICES()   { return INDICES; },
  EXAMPLES,
  formatRp, formatRpFull,
  answerFor, scanIndicesFor, parseAnswerToBlocks,
  loadDashboard,
};

loadDashboard();
