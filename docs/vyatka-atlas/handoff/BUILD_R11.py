# -*- coding: utf-8 -*-
"""
VYATKA ATLAS R11 HANDOFF — SQLite / SQL / XML / GeoJSON / QA builder.
Requirements: Python 3.9+ standard library only. No network access.
All outputs are created in the directory of this script / BUILD_DATABASE.cmd.
"""
from pathlib import Path
from datetime import datetime
import csv
import json
import sqlite3
import traceback
import zipfile
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "data.json"
SQL_SCHEMA = ROOT / "SCHEMA_R11.sql"
OUT_DB = ROOT / "VYATKA_ATLAS_R11.sqlite"
OUT_SQL = ROOT / "VYATKA_ATLAS_R11_DUMP.sql"
OUT_XML = ROOT / "VYATKA_ATLAS_R11.xml"
OUT_POINTS = ROOT / "R11_SOURCE_POINTS_15.geojson"
OUT_ANCHORS = ROOT / "R11_VIEW_ANCHORS_151.geojson"
OUT_QA = ROOT / "QA_R11.json"

EXPECTED = {
    "records": 151,
    "documents": 55,
    "evidence": 124,
    "toponyms": 31,
    "scans": 14,
    "sources": 28,
    "geolocated": 15,
    "missing_coords": 136,
}
def s(value):
    return None if value is None else str(value)

def as_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)

def point_feature(record, use_view_anchor):
    t = record.get("map_target") or {}
    lat = t.get("latitude") if use_view_anchor else record.get("latitude")
    lon = t.get("longitude") if use_view_anchor else record.get("longitude")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None
    props = {
        "name": record.get("name"),
        "category": record.get("category"),
        "scope": record.get("scope"),
        "coordinate_role": record.get("coordinate_role"),
        "source": record.get("source"),
        "doc_id": record.get("doc_id"),
        "map_only_approximate": t.get("level") == "APPROXIMATE_ANCHOR_NOT_FIND_SITE",
        "map_radius_km": t.get("radius_km"),
        "map_anchor_explanation": t.get("explanation"),
        "WARNING": "Map radius is only a viewing approximation, not an archaeological or impact site boundary.",
    }
    return {
        "type": "Feature",
        "id": record.get("id"),
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }

def export_geojson(records):
    located = [point_feature(r, False) for r in records]
    located = [x for x in located if x is not None]
    anchors = [point_feature(r, True) for r in records]
    anchors = [x for x in anchors if x is not None]
    assert len(located) == 15
    assert len(anchors) == 151
    for path, arr, note in (
        (OUT_POINTS, located, "Only 15 recorded coordinates. Coordinate role must be considered."),
        (OUT_ANCHORS, anchors, "151 browsing anchors, including 136 APPROXIMATE. NOT find site positions."),
    ):
        obj = {
            "type": "FeatureCollection",
            "name": path.stem,
            "crs_note": "EPSG:4326 / WGS84",
            "caution": note,
            "features": arr,
        }
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(located), len(anchors)

def export_xml(data):
    root = ET.Element("vyatka_historical_atlas",
        version="R11", coordinate_system="EPSG:4326",
        evidence_completeness="PARTIAL_SOURCE_RESEARCH")
    for label in ("records", "documents", "evidence", "toponyms", "scans", "sources"):
        group = ET.SubElement(root, label, count=str(len(data[label])))
        for row in data[label]:
            node = ET.SubElement(group, "item")
            for k, value in row.items():
                child = ET.SubElement(node, str(k))
                if isinstance(value, (dict, list)):
                    child.text = as_json(value)
                elif value is not None:
                    child.text = str(value)
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(OUT_XML, encoding="utf-8", xml_declaration=True)

def build_sqlite(data):
    if OUT_DB.exists():
        OUT_DB.unlink()
    missing_links = []
    with sqlite3.connect(str(OUT_DB)) as con:
        con.execute("PRAGMA foreign_keys=ON")
        con.executescript(SQL_SCHEMA.read_text(encoding="utf-8-sig"))
        objects = data["records"]
        docs = data["documents"]
        ev = data["evidence"]
        doc_ids = {x["id"] for x in docs}
        obj_ids = {x["id"] for x in objects}
        for d in docs:
            con.execute("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)",
                (d["id"], d.get("title"), s(d.get("year")), d.get("filename"),
                 d.get("neb_url"), d.get("neb_search_url"), d.get("status"),
                 int(bool(d.get("link_verified")))))
        for o in objects:
            ref = o.get("doc_id")
            if ref not in doc_ids:
                if ref: missing_links.append(["object_doc", o["id"], ref])
                ref = None
            con.execute("INSERT INTO objects VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (o["id"], o.get("name"), o.get("category"), o.get("subgroup"),
                 o.get("scope"), o.get("verification"), o.get("date"),
                 o.get("historical_location"), o.get("summary"),
                 o.get("latitude"), o.get("longitude"), o.get("coordinate_role"),
                 ref, o.get("page_label"), o.get("source"), o.get("external_url"),
                 o.get("notes"), as_json(o.get("treasure")) if o.get("treasure") else None))
            t = o.get("map_target") or {}
            con.execute("INSERT INTO map_targets VALUES(?,?,?,?,?,?,?,?,?)",
                (o["id"], t.get("latitude"), t.get("longitude"),
                 t.get("radius_km"), t.get("kind"), t.get("level"),
                 t.get("anchor_name"), t.get("anchor_source"), t.get("explanation")))
            tr = o.get("treasure")
            if o.get("category") == "Клады":
                tr = tr or {}
                con.execute("INSERT INTO treasures VALUES(?,?,?,?,?,?,?)",
                    (o["id"], tr.get("reported_find_date"), tr.get("coin_period"),
                     tr.get("quantity"), tr.get("metal"), tr.get("research_status"),
                     tr.get("source_item_number")))
        for e in ev:
            ref = e.get("doc_id")
            if ref not in doc_ids:
                if ref: missing_links.append(["evidence_doc", e["id"], ref])
                ref = None
            linked = e.get("object_ids") or []
            con.execute("INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (e["id"], e.get("phase"), ref, s(e.get("page")),
                 s(e.get("page_end")), s(e.get("printed_page")), e.get("paragraph"),
                 e.get("summary"), e.get("kind"), e.get("confidence"), e.get("status"),
                 e.get("url"), e.get("historical_location"), as_json(linked)))
            for obj_id in set(linked):
                if obj_id in obj_ids:
                    con.execute("INSERT INTO evidence_objects VALUES(?,?)", (e["id"], obj_id))
                else:
                    missing_links.append(["evidence_object", e["id"], obj_id])
        for t in data["toponyms"]:
            ref = t.get("doc_id")
            if ref not in doc_ids:
                if ref: missing_links.append(["toponym_doc", t["id"], ref])
                ref = None
            con.execute("INSERT INTO toponyms VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (t["id"], t.get("historical_name"), t.get("modern_name"),
                 t.get("kind"), t.get("scope"), t.get("status"), t.get("basis"),
                 ref, s(t.get("page")), t.get("url"), t.get("caution")))
        for x in data["scans"]:
            ref = x.get("doc_id")
            if ref not in doc_ids:
                raise ValueError("Scan references missing document: " + str(ref))
            con.execute("INSERT INTO scans VALUES(?,?,?,?,?,?,?,?,?)",
                (ref, s(x.get("year")), s(x.get("toc_pages")),
                 s(x.get("reviewed_pages")), x.get("topic"), x.get("example"),
                 x.get("research_value"), x.get("status"), x.get("next")))
        for x in data["sources"]:
            con.execute("INSERT INTO sources VALUES(?,?,?,?,?,?,?,?)",
                (x["id"], x.get("kind"), x.get("title"), s(x.get("year")),
                 x.get("url"), x.get("relevance"), x.get("status"), x.get("notes")))
        for key, val in data.get("stats", {}).items():
            con.execute("INSERT INTO metadata VALUES(?,?)", ("stats." + key, str(val)))
        con.execute("INSERT INTO metadata VALUES(?,?)",
            ("project.revision", data.get("project", {}).get("revision", "R11")))
        con.commit()
        counts = {table:con.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
                  for table in ("objects","documents","evidence","toponyms","scans",
                                "sources","map_targets","treasures","evidence_objects")}
        bad_fk = con.execute("PRAGMA foreign_key_check").fetchall()
        assert not bad_fk, bad_fk
        assert counts["objects"] == 151
        assert counts["documents"] == 55
        assert counts["evidence"] == 124
        assert counts["toponyms"] == 31
        assert counts["scans"] == 14
        assert counts["sources"] == 28
        assert counts["map_targets"] == 151
        assert counts["treasures"] == 43
        OUT_SQL.write_text("\n".join(con.iterdump()) + "\n", encoding="utf-8")
    return counts, missing_links

def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8-sig"))
    for key, expected in EXPECTED.items():
        actual = data.get("stats", {}).get(key)
        if actual != expected:
            raise ValueError("Count mismatch for %s: %r != %r" % (key, actual, expected))
    ids = [x["id"] for x in data["records"]]
    assert len(ids) == len(set(ids)) == 151, "Object ID conflict"
    assert len({x["id"] for x in data["documents"]}) == 55
    assert len({x["id"] for x in data["evidence"]}) == 124
    assert len({x["id"] for x in data["toponyms"]}) == 31
    assert len({x["id"] for x in data["sources"]}) == 28
    ncoords = sum(isinstance(o.get("latitude"), (int, float)) and
                  isinstance(o.get("longitude"), (int, float)) for o in data["records"])
    assert ncoords == 15
    assert len(data["records"]) - ncoords == 136

    counts, warnings = build_sqlite(data)
    export_xml(data)
    source_count, view_count = export_geojson(data["records"])
    qa = {
        "status":"PASS_WITH_WARNINGS" if warnings else "PASS",
        "revision":data.get("project", {}).get("revision"),
        "table_counts":counts,
        "original_coordinate_objects":source_count,
        "map_view_anchors":view_count,
        "warning_count":len(warnings),
        "unresolved_link_references":warnings,
        "evidence_caveat":"55 PDFs have NOT been fully reviewed page by page.",
        "map_caveat":"136 map targets are approximate visual/navigation anchors only.",
        "sql_export":"PASS", "xml_export":"PASS",
        "generated_at":datetime.now().isoformat(timespec="seconds"),
        "output_folder":str(ROOT)
    }
    OUT_QA.write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output = ROOT / ("RETURN_R11_" + stamp + "_" + qa["status"] + ".zip")
    files = [OUT_DB, OUT_SQL, OUT_XML, OUT_POINTS, OUT_ANCHORS, OUT_QA,
             DATA_PATH, SQL_SCHEMA, ROOT / "00_README_START_HERE_RU.md",
             ROOT / "NEXT_CHAT_PROMPT_RU.txt"]
    with zipfile.ZipFile(str(output), "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            if f.exists():
                z.write(str(f), arcname=f.name)
    print("[PASS]", output.name)
    print("[OUTPUT_DIRECTORY]", str(ROOT))
    print("[TABLE_COUNTS]", json.dumps(counts, ensure_ascii=False))
    if warnings:
        print("[WARNINGS]", len(warnings), "See QA_R11.json")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        (ROOT / "DIAGNOSTIC_R11.txt").write_text(
            traceback.format_exc(), encoding="utf-8")
        traceback.print_exc()
        sys.exit(1)
