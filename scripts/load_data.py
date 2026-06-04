"""
load_data.py — ETL: MongoDB JSON -> OpenSearch
Rumah Sakit Sehat Selalu

Usage:
    python scripts/load_data.py
    python scripts/load_data.py --host localhost --port 9200 --data-dir ./data
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from opensearchpy import OpenSearch, helpers

# ── Index mappings ─────────────────────────────────────────────────────────────
MAPPINGS = {
    "hospital_patients": {
        "mappings": {
            "properties": {
                "patient_id":  {"type": "integer"},
                "team_id":     {"type": "integer"},
                "tipe_pasien": {"type": "keyword"},
                "nama_pasien": {"type": "text", "analyzer": "standard"},
            }
        }
    },
    "hospital_doctors": {
        "mappings": {
            "properties": {
                "doctor_id":   {"type": "integer"},
                "dept_id":     {"type": "integer"},
                "nama_dokter": {"type": "text", "analyzer": "standard"},
                "spesialisasi":{"type": "keyword"},
            }
        }
    },
    "hospital_departments": {
        "mappings": {
            "properties": {
                "dept_id":        {"type": "integer"},
                "nama_departemen":{"type": "text", "analyzer": "standard"},
            }
        }
    },
    "hospital_teams": {
        "mappings": {
            "properties": {
                "team_id": {"type": "integer"},
                "nama_tim":{"type": "text", "analyzer": "standard"},
            }
        }
    },
    "hospital_services": {
        "mappings": {
            "properties": {
                "service_id":   {"type": "integer"},
                "nama_layanan": {"type": "text", "analyzer": "standard"},
                "jenis_layanan":{"type": "keyword"},
                "tarif_dasar":  {"type": "long"},
            }
        }
    },
    "hospital_bills": {
        "mappings": {
            "properties": {
                "bill_id":        {"type": "integer"},
                "patient_id":     {"type": "integer"},
                "service_id":     {"type": "integer"},
                "total_biaya":    {"type": "long"},
                "status_tagihan": {"type": "keyword"},
                "tanggal_tagihan":{"type": "date", "format": "yyyy-MM-dd"},
            }
        }
    },
    "hospital_payments": {
        "mappings": {
            "properties": {
                "payment_id":          {"type": "integer"},
                "bill_id":             {"type": "integer"},
                "metode_pembayaran":   {"type": "keyword"},
                "jumlah_bayar":        {"type": "long"},
                "status_pembayaran":   {"type": "keyword"},
                "tanggal_pembayaran":  {"type": "date", "format": "yyyy-MM-dd"},
            }
        }
    },
    "hospital_tim_dokter": {
        "mappings": {
            "properties": {
                "doctor_id": {"type": "integer"},
                "team_id":   {"type": "integer"},
            }
        }
    },
}

DATA_FILES = {
    "hospital_patients":    "hospital_db_patients.json",
    "hospital_doctors":     "hospital_db_doctors.json",
    "hospital_departments": "hospital_db_departments.json",
    "hospital_teams":       "hospital_db_teams.json",
    "hospital_services":    "hospital_db_services.json",
    "hospital_bills":       "hospital_db_bills.json",
    "hospital_payments":    "hospital_db_payments.json",
    "hospital_tim_dokter":  "hospital_db_tim_dokter.json",
}


def clean_record(record: dict) -> dict:
    """Strip MongoDB metadata, normalize $date -> yyyy-MM-dd string."""
    out = {}
    for k, v in record.items():
        if k == "_id":
            continue
        if isinstance(v, dict):
            if "$date" in v:
                try:
                    dt = datetime.fromisoformat(v["$date"].replace("Z", "+00:00"))
                    out[k] = dt.strftime("%Y-%m-%d")
                except Exception:
                    out[k] = v["$date"]
            elif "$oid" in v:
                out[k] = v["$oid"]
            else:
                out[k] = v
        else:
            out[k] = v
    return out


def generate_actions(index_name: str, records: list):
    for rec in records:
        yield {"_index": index_name, "_source": clean_record(rec)}


def load_one_index(client: OpenSearch, index_name: str, filepath: Path) -> int:
    if client.indices.exists(index=index_name):
        client.indices.delete(index=index_name)
        print(f"  - Deleted existing index '{index_name}'")

    client.indices.create(index=index_name, body=MAPPINGS[index_name])
    print(f"  - Index '{index_name}' created")

    with open(filepath, encoding="utf-8") as f:
        records = json.load(f)

    success, errors = helpers.bulk(
        client,
        generate_actions(index_name, records),
        chunk_size=500,
        raise_on_error=False,
    )
    if errors:
        print(f"  ! {len(errors)} errors during bulk index")
    return success


def main():
    parser = argparse.ArgumentParser(description="Load hospital data into OpenSearch")
    parser.add_argument("--host",     default="localhost")
    parser.add_argument("--port",     type=int, default=9200)
    parser.add_argument("--user",     default="admin")
    parser.add_argument("--password", default="admin")
    parser.add_argument("--ssl",      action="store_true", help="Use HTTPS/SSL")
    parser.add_argument("--data-dir", default="./data",
                        help="Directory containing the 8 JSON files")
    args = parser.parse_args()

    use_ssl = args.ssl or args.port == 443

    print("=" * 55)
    print("  HOSPITAL DATA LOADER — Rumah Sakit Sehat Selalu")
    print("=" * 55)
    print(f"  Target : {'https' if use_ssl else 'http'}://{args.host}:{args.port}")
    print(f"  Data   : {args.data_dir}")
    print("=" * 55 + "\n")

    client = OpenSearch(
        hosts=[{"host": args.host, "port": args.port}],
        http_auth=(args.user, args.password),
        use_ssl=use_ssl,
        verify_certs=False,
        ssl_show_warn=False,
    )

    try:
        info = client.info()
        print(f"Connected. OpenSearch {info['version']['number']}\n")
    except Exception as e:
        print(f"ERROR: Cannot connect to OpenSearch — {e}")
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
        print(f"  + {count} documents indexed\n")
        total += count

    print("=" * 55)
    print(f"  DONE — {total} total documents indexed across 8 indices")
    print("=" * 55)


if __name__ == "__main__":
    main()
