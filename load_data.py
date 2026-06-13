"""
load_data.py — ETL: JSON Dataset -> OpenSearch
Hospital Operational Cost Analytics — CostPulse

Usage (Bonsai URL penuh):
    python scripts/load_data.py --url "https://user:pass@host.bonsaisearch.net:443"

Usage (host terpisah):
    python scripts/load_data.py --host localhost --port 9200

Data dir default: ./data
"""

import json
import argparse
from pathlib import Path
from opensearchpy import OpenSearch, helpers

# ── Index mappings ─────────────────────────────────────────────────────────────
MAPPINGS = {
    "cost_obat": {
        "mappings": {
            "properties": {
                "obat_id":                {"type": "integer"},
                "nama_obat":              {"type": "text", "analyzer": "standard",
                                           "fields": {"keyword": {"type": "keyword"}}},
                "kategori_obat":          {"type": "keyword"},
                "satuan":                 {"type": "keyword"},
                "harga_satuan":           {"type": "long"},
                "stok_tersedia":          {"type": "integer"},
                "stok_minimum":           {"type": "integer"},
                "dept_id":                {"type": "integer"},
                "supplier":               {"type": "keyword"},
                "tanggal_kadaluarsa":     {"type": "date", "format": "yyyy-MM-dd"},
                "tanggal_pengadaan":      {"type": "date", "format": "yyyy-MM-dd"},
                "total_pemakaian_bulan":  {"type": "integer"},
                "biaya_pemakaian_bulan":  {"type": "long"},
                "golongan_obat":          {"type": "keyword"},
                "formularium":            {"type": "boolean"},
            }
        }
    },
    "cost_alat_medis": {
        "mappings": {
            "properties": {
                "alat_id":                    {"type": "integer"},
                "nama_alat":                  {"type": "text", "analyzer": "standard",
                                               "fields": {"keyword": {"type": "keyword"}}},
                "jenis_alat":                 {"type": "keyword"},
                "dept_id":                    {"type": "integer"},
                "harga_beli":                 {"type": "long"},
                "tahun_pembelian":            {"type": "integer"},
                "masa_pakai_tahun":           {"type": "integer"},
                "kondisi":                    {"type": "keyword"},
                "biaya_servis_tahunan":       {"type": "long"},
                "biaya_depresiasi_tahunan":   {"type": "long"},
                "biaya_operasional_bulan":    {"type": "long"},
                "vendor":                     {"type": "keyword"},
                "tanggal_pembelian":          {"type": "date", "format": "yyyy-MM-dd"},
                "last_maintenance":           {"type": "date", "format": "yyyy-MM-dd"},
                "status_operasional":         {"type": "keyword"},
                "nomor_seri":                 {"type": "keyword"},
                "garansi_sampai":             {"type": "keyword"},
            }
        }
    },
    "cost_lab": {
        "mappings": {
            "properties": {
                "lab_id":                      {"type": "integer"},
                "nama_pemeriksaan":            {"type": "text", "analyzer": "standard",
                                                "fields": {"keyword": {"type": "keyword"}}},
                "jenis_pemeriksaan":           {"type": "keyword"},
                "dept_id":                     {"type": "integer"},
                "kode_pemeriksaan":            {"type": "keyword"},
                "tarif_pemeriksaan":           {"type": "long"},
                "biaya_reagent_per_tes":       {"type": "long"},
                "volume_pemeriksaan_bulan":    {"type": "integer"},
                "total_pendapatan_bulan":      {"type": "long"},
                "total_biaya_reagent_bulan":   {"type": "long"},
                "margin_kotor_bulan":          {"type": "long"},
                "waktu_pengerjaan_menit":      {"type": "integer"},
                "akreditasi_lis":              {"type": "boolean"},
                "standar_metode":              {"type": "keyword"},
                "tanggal_update":              {"type": "date", "format": "yyyy-MM-dd"},
            }
        }
    },
    "cost_sdm": {
        "mappings": {
            "properties": {
                "sdm_id":                    {"type": "integer"},
                "nip":                       {"type": "keyword"},
                "nama_karyawan":             {"type": "text", "analyzer": "standard"},
                "jabatan":                   {"type": "keyword"},
                "pendidikan_terakhir":       {"type": "keyword"},
                "dept_id":                   {"type": "integer"},
                "status_karyawan":           {"type": "keyword"},
                "shift":                     {"type": "keyword"},
                "gaji_pokok":                {"type": "long"},
                "tunjangan_jabatan":         {"type": "long"},
                "insentif_bulanan":          {"type": "long"},
                "bpjs_kesehatan":            {"type": "long"},
                "bpjs_ketenagakerjaan":      {"type": "long"},
                "lembur_jam_bulan":          {"type": "integer"},
                "biaya_lembur":              {"type": "long"},
                "total_kompensasi_bulanan":  {"type": "long"},
                "tahun_bergabung":           {"type": "integer"},
                "hari_kerja_bulan":          {"type": "integer"},
                "sertifikasi":               {"type": "boolean"},
                "tunjangan_transport":       {"type": "long"},
            }
        }
    },
    "cost_utilitas": {
        "mappings": {
            "properties": {
                "utilitas_id":      {"type": "integer"},
                "periode":          {"type": "date", "format": "yyyy-MM-dd"},
                "tahun":            {"type": "integer"},
                "bulan":            {"type": "integer"},
                "dept_id":          {"type": "integer"},
                "nama_departemen":  {"type": "keyword"},
                "jenis_utilitas":   {"type": "keyword"},
                "konsumsi":         {"type": "long"},
                "satuan":           {"type": "keyword"},
                "tarif_per_unit":   {"type": "long"},
                "total_biaya":      {"type": "long"},
                "vendor":           {"type": "keyword"},
                "nomor_tagihan":    {"type": "keyword"},
                "status_pembayaran":{"type": "keyword"},
            }
        }
    },
    "cost_departments": {
        "mappings": {
            "properties": {
                "dept_id":        {"type": "integer"},
                "nama_departemen":{"type": "text", "analyzer": "standard",
                                   "fields": {"keyword": {"type": "keyword"}}},
                "kode":           {"type": "keyword"},
            }
        }
    },
    "cost_monthly": {
        "mappings": {
            "properties": {
                "cost_id":                   {"type": "integer"},
                "periode":                   {"type": "keyword"},
                "tahun":                     {"type": "integer"},
                "bulan":                     {"type": "integer"},
                "dept_id":                   {"type": "integer"},
                "nama_departemen":           {"type": "keyword"},
                "biaya_obat":                {"type": "long"},
                "biaya_alat_medis":          {"type": "long"},
                "biaya_lab":                 {"type": "long"},
                "biaya_sdm":                 {"type": "long"},
                "biaya_utilitas":            {"type": "long"},
                "total_biaya_operasional":   {"type": "long"},
                "anggaran_bulan":            {"type": "long"},
                "realisasi_vs_anggaran":     {"type": "float"},
                "selisih_anggaran":          {"type": "long"},
            }
        }
    },
}

DATA_FILES = {
    "cost_obat":        "hospital_db_obat.json",
    "cost_alat_medis":  "hospital_db_alat_medis.json",
    "cost_lab":         "hospital_db_lab.json",
    "cost_sdm":         "hospital_db_sdm.json",
    "cost_utilitas":    "hospital_db_utilitas.json",
    "cost_departments": "hospital_db_departments.json",
    "cost_monthly":     "hospital_db_monthly_cost.json",
}


def load_one_index(client: OpenSearch, index_name: str, filepath: Path) -> int:
    if client.indices.exists(index=index_name):
        client.indices.delete(index=index_name)
        print(f"  - Deleted existing '{index_name}'")

    client.indices.create(index=index_name, body=MAPPINGS[index_name])
    print(f"  - Created '{index_name}'")

    with open(filepath, encoding="utf-8") as f:
        records = json.load(f)

    def generate_actions(records):
        for rec in records:
            yield {"_index": index_name, "_source": rec}

    success, errors = helpers.bulk(
        client, generate_actions(records),
        chunk_size=200, raise_on_error=False,
    )
    if errors:
        print(f"  ! {len(errors)} errors during bulk index")
    return success


def make_client_from_url(url: str) -> OpenSearch:
    """Parse Bonsai URL: https://user:pass@host:port"""
    from urllib.parse import urlparse
    p = urlparse(url)
    use_ssl = p.scheme == "https"
    port = p.port or (443 if use_ssl else 9200)
    host = p.hostname
    user = p.username or ""
    pwd  = p.password or ""
    print(f"  Host : {p.scheme}://{host}:{port}")
    print(f"  User : {user}")
    return OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=(user, pwd) if user else None,
        use_ssl=use_ssl,
        verify_certs=True,
        ssl_show_warn=False,
        http_compress=True,
    )


def make_client_from_args(args) -> OpenSearch:
    use_ssl = args.ssl or args.port == 443
    print(f"  Host : {'https' if use_ssl else 'http'}://{args.host}:{args.port}")
    return OpenSearch(
        hosts=[{"host": args.host, "port": args.port}],
        http_auth=(args.user, args.password),
        use_ssl=use_ssl,
        verify_certs=False,
        ssl_show_warn=False,
    )


def main():
    parser = argparse.ArgumentParser(description="Load CostPulse data into OpenSearch")
    parser.add_argument("--url",      default="", help="Full Bonsai URL: https://user:pass@host:443")
    parser.add_argument("--host",     default="localhost")
    parser.add_argument("--port",     type=int, default=9200)
    parser.add_argument("--user",     default="admin")
    parser.add_argument("--password", default="admin")
    parser.add_argument("--ssl",      action="store_true")
    parser.add_argument("--data-dir", default="./data")
    args = parser.parse_args()

    print("=" * 60)
    print("  COSTPULSE — DATA LOADER")
    print("=" * 60)
    print(f"  Data  : {args.data_dir}")

    client = make_client_from_url(args.url) if args.url else make_client_from_args(args)

    print("=" * 60 + "\n")

    try:
        info = client.info()
        print(f"✓ Connected — OpenSearch {info['version']['number']}\n")
    except Exception as e:
        print(f"✗ Cannot connect: {e}")
        return

    data_dir = Path(args.data_dir)
    total = 0

    for index_name, filename in DATA_FILES.items():
        filepath = data_dir / filename
        print(f"[{index_name}]")
        if not filepath.exists():
            print(f"  ! File not found: {filepath}\n")
            continue
        count = load_one_index(client, index_name, filepath)
        print(f"  ✓ {count:,} documents indexed\n")
        total += count

    print("=" * 60)
    print(f"  SELESAI — {total:,} dokumen di 7 index")
    print("=" * 60)


if __name__ == "__main__":
    main()