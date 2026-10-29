PRAGMA foreign_keys = ON;
CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE documents(
 id TEXT PRIMARY KEY, title TEXT NOT NULL, year TEXT, filename TEXT,
 neb_url TEXT, neb_search_url TEXT, status TEXT, verified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE objects(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, subgroup TEXT, scope TEXT,
 verification TEXT, event_date TEXT, historical_location TEXT, summary_ru TEXT,
 latitude REAL, longitude REAL, coordinate_role TEXT,
 doc_id TEXT REFERENCES documents(id), page_label TEXT, source_title TEXT,
 external_url TEXT, notes TEXT, treasure_json TEXT
);
CREATE TABLE map_targets(
 object_id TEXT PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
 latitude REAL NOT NULL, longitude REAL NOT NULL, radius_km REAL NOT NULL,
 anchor_kind TEXT, level TEXT, anchor_name TEXT, anchor_source TEXT,
 explanation TEXT,
 CHECK(latitude BETWEEN -90 AND 90),
 CHECK(longitude BETWEEN -180 AND 180),
 CHECK(radius_km > 0)
);
CREATE TABLE evidence(
 id TEXT PRIMARY KEY, phase TEXT, doc_id TEXT REFERENCES documents(id),
 page_label TEXT, end_page_label TEXT, printed_page TEXT, paragraph_locator TEXT,
 summary_ru TEXT, kind TEXT, confidence TEXT, status TEXT, source_url TEXT,
 historical_location TEXT, original_object_ids_json TEXT
);
CREATE TABLE evidence_objects(
 evidence_id TEXT REFERENCES evidence(id),
 object_id TEXT REFERENCES objects(id),
 PRIMARY KEY(evidence_id, object_id)
);
CREATE TABLE toponyms(
 id TEXT PRIMARY KEY, historical_name TEXT, modern_name TEXT, kind TEXT,
 scope TEXT, status TEXT, basis TEXT, doc_id TEXT REFERENCES documents(id),
 page_label TEXT, source_url TEXT, caution TEXT
);
CREATE TABLE scans(
 doc_id TEXT PRIMARY KEY REFERENCES documents(id), pub_year TEXT, toc_pages TEXT,
 reviewed_pages TEXT, topic TEXT, example TEXT, research_value TEXT,
 status TEXT, next_action TEXT
);
CREATE TABLE sources(
 id TEXT PRIMARY KEY, kind TEXT, title TEXT, pub_year TEXT, url TEXT,
 relevance TEXT, status TEXT, notes TEXT
);
CREATE TABLE treasures(
 object_id TEXT PRIMARY KEY REFERENCES objects(id), reported_find_date TEXT,
 coin_period TEXT, quantity TEXT, metal TEXT, research_status TEXT,
 source_item_number INTEGER
);
CREATE INDEX ix_objects_category ON objects(category);
CREATE INDEX ix_objects_scope ON objects(scope);
CREATE INDEX ix_evidence_doc_page ON evidence(doc_id,page_label);
CREATE INDEX ix_evidence_objects_object ON evidence_objects(object_id);
CREATE INDEX ix_map_targets_anchor ON map_targets(anchor_kind,level);
CREATE INDEX ix_sources_year ON sources(pub_year);
