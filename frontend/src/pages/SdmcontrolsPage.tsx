import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

// --- Types matching our backend API ---

type RelatedMapping = {
  scheme: string;
  value: string;
  remarks?: string | null;
};

type SdmControlSummaryProps = {
  sdmModule?: string | null;
  sdmGoals: string[];
  dsgvoArticles: string[];
};

type SdmControlSummary = {
  id: string;
  title: string;
  groupId?: string | null;
  props: SdmControlSummaryProps;
};

type SdmControlDetailProps = SdmControlSummaryProps & {
  implementationLevel?: string | null;
  dpRiskImpact?: string | null;
  relatedMappings: RelatedMapping[];
};

type SdmControlDetail = {
  id: string;
  title: string;
  class_?: string | null;
  groupId?: string | null;
  props: SdmControlDetailProps;
};

// Mapping API types

type SecurityControlRef = {
  catalogId: string;
  controlId: string;
};

type MappingStandards = {
  bsi?: string[] | null;
  iso27001?: string[] | null;
  iso27701?: string[] | null;
};

type SdmSecurityMapping = {
  sdmControlId: string;
  sdmTitle: string;
  securityControls: SecurityControlRef[];
  standards: MappingStandards;
  notes?: string | null;
};

// Resilience / Security control list

type SecurityControl = {
  id: string;
  title: string;
  class_?: string | null;
  domain?: string | null;
  objective?: string | null;
};

// Helper: API base – hier ggf. an ENV / Proxy anpassen
const API_BASE = "http://localhost:3000";

const SDMControlsPage: React.FC = () => {
  const [controls, setControls] = useState<SdmControlSummary[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SdmControlDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [mapping, setMapping] = useState<SdmSecurityMapping | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingSaveMessage, setMappingSaveMessage] = useState<string | null>(null);
  const [mappingIndex, setMappingIndex] = useState<Record<string, number>>({});

  const [securityControls, setSecurityControls] = useState<SecurityControl[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<any | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const [search, setSearch] = useState("");

  // --- Initial load: SDM controls + security controls ---

  useEffect(() => {
    const loadControls = async () => {
      setLoadingControls(true);
      setControlsError(null);
      try {
        const res = await fetch(`${API_BASE}/api/sdm/controls`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setControls(data.items ?? []);
      } catch (err: any) {
        setControlsError("Fehler beim Laden der SDM-Controls.");
        console.error(err);
      } finally {
        setLoadingControls(false);
      }
    };

    const loadSecurity = async () => {
      setSecurityLoading(true);
      setSecurityError(null);
      try {
        const res = await fetch(`${API_BASE}/api/resilience/controls`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSecurityControls(data.items ?? []);
      } catch (err: any) {
        setSecurityError("Fehler beim Laden der Resilience-Controls.");
        console.error(err);
      } finally {
        setSecurityLoading(false);
      }
    };

    const loadMappings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mapping`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const index: Record<string, number> = {};
        for (const m of data.items ?? []) {
          const id = m.sdmControlId;
          if (!id) continue;
          index[id] = (index[id] ?? 0) + 1;
        }
        setMappingIndex(index);
      } catch (err: any) {
        // kein harter Fehler – UI funktioniert auch ohne Mapping-Index
        console.warn("Konnte Mapping-Übersicht nicht laden:", err);
      }
    };

    loadControls();
    loadSecurity();
    loadMappings();
  }, []);

  // --- Filtered list ---

  const filteredControls = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return controls;
    return controls.filter((c) => {
      const haystack = [
        c.id,
        c.title,
        c.props.sdmModule ?? "",
        ...(c.props.sdmGoals || []),
        ...(c.props.dsgvoArticles || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [controls, search]);

  // --- When a control is selected: load detail + mapping ---

  const handleSelectControl = (id: string) => {
    setSelectedId(id);
    setSelectedDetail(null);
    setDetailError(null);
    setMapping(null);
    setMappingError(null);
    setMappingSaveMessage(null);

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/sdm/controls/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SdmControlDetail = await res.json();
        setSelectedDetail(data);
      } catch (err: any) {
        setDetailError("Fehler beim Laden der Control-Details.");
        console.error(err);
      } finally {
        setDetailLoading(false);
      }
    };

    const loadMapping = async () => {
      setMappingLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/mapping/${id}`);
        if (res.status === 404) {
          // Noch kein Mapping vorhanden – leeres Mapping vorbereiten
          const ctrl = controls.find((c) => c.id === id);
          setMapping(
            ctrl
              ? {
                  sdmControlId: id,
                  sdmTitle: ctrl.title,
                  securityControls: [],
                  standards: {},
                  notes: "",
                }
              : null,
          );
        } else if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        } else {
          const data: SdmSecurityMapping = await res.json();
          setMapping(data);
        }
      } catch (err: any) {
        setMappingError("Fehler beim Laden des Mappings.");
        console.error(err);
      } finally {
        setMappingLoading(false);
      }
    };

    loadDetail();
    loadMapping();
  };

  // --- Mapping-Form-Helpers ---

  const handleStandardsChange = (field: keyof MappingStandards, value: string) => {
    if (!mapping) return;
    const entries = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setMapping({
      ...mapping,
      standards: {
        ...mapping.standards,
        [field]: entries.length ? entries : undefined,
      },
    });
  };

  const handleNotesChange = (value: string) => {
    if (!mapping) return;
    setMapping({ ...mapping, notes: value });
  };

  const handleSecurityControlToggle = (secId: string) => {
    if (!mapping) return;

    const exists = mapping.securityControls.some((s) => s.controlId === secId);
    let updated: SecurityControlRef[];

    if (exists) {
      updated = mapping.securityControls.filter((s) => s.controlId !== secId);
    } else {
      updated = [
        ...mapping.securityControls,
        {
          catalogId: "opengov-resilience-baseline",
          controlId: secId,
        },
      ];
    }

    setMapping({ ...mapping, securityControls: updated });
  };

  const saveMapping = async () => {
    if (!mapping || !selectedId) return;
    setMappingSaving(true);
    setMappingSaveMessage(null);
    setMappingError(null);

    try {
      const res = await fetch(`${API_BASE}/api/mapping/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdmTitle: mapping.sdmTitle,
          securityControls: mapping.securityControls,
          standards: mapping.standards,
          notes: mapping.notes,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: SdmSecurityMapping = await res.json();
      setMapping(data);
      setMappingSaveMessage("Mapping erfolgreich gespeichert.");
      setMappingIndex((prev) => ({
        ...prev,
        [selectedId]: 1,
      }));
    } catch (err: any) {
      console.error(err);
      setMappingError("Fehler beim Speichern des Mappings.");
    } finally {
      setMappingSaving(false);
    }
  };

    const showDiff = async () => {
    if (!mapping || !selectedId) return;

    setDiffLoading(true);
    setDiffError(null);
    setDiffResult(null);
    setDiffOpen(true);

    try {
      // 1) Aktuelle Mapping-Datei vom Server holen
      const fileRes = await fetch(
        `${API_BASE}/api/files/sdm_privacy_to_security`,
      );
      if (!fileRes.ok) {
        throw new Error(`HTTP ${fileRes.status} beim Lesen der Mapping-Datei`);
      }
      const fileData = await fileRes.json();
      const currentContent = fileData.content as string;
      const json = JSON.parse(currentContent);

      // 2) Neue Version der mappings erzeugen: ausgewähltes Mapping ersetzen/ergänzen
      const rawMappings = Array.isArray(json.mappings) ? json.mappings : [];
      const updatedRawMapping = {
        sdm_control_id: mapping.sdmControlId,
        sdm_title: mapping.sdmTitle,
        security_controls: (mapping.securityControls ?? []).map((sc) => ({
          catalog_id: sc.catalogId,
          control_id: sc.controlId,
        })),
        standards: {
          ...(mapping.standards.bsi
            ? { bsi: mapping.standards.bsi }
            : {}),
          ...(mapping.standards.iso27001
            ? { iso27001: mapping.standards.iso27001 }
            : {}),
          ...(mapping.standards.iso27701
            ? { iso27701: mapping.standards.iso27701 }
            : {}),
        },
        notes: mapping.notes ?? null,
      };

      let found = false;
      const newMappings = rawMappings.map((m: any) => {
        if (m.sdm_control_id === mapping.sdmControlId) {
          found = true;
          return updatedRawMapping;
        }
        return m;
      });
      if (!found) {
        newMappings.push(updatedRawMapping);
      }

      const newJson = {
        ...json,
        mappings: newMappings,
      };

      const updatedString = JSON.stringify(newJson, null, 2);

      // 3) Diff-Endpunkt aufrufen
      const diffRes = await fetch(
        `${API_BASE}/api/files/sdm_privacy_to_security/diff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updated: updatedString }),
        },
      );

      if (!diffRes.ok) {
        throw new Error(`HTTP ${diffRes.status} beim Diff-Aufruf`);
      }

      const diffData = await diffRes.json();
      setDiffResult(diffData.diff ?? diffData); // falls der Endpoint diff unter .diff zurückgibt
    } catch (err: any) {
      console.error(err);
      setDiffError(
        err instanceof Error
          ? err.message
          : "Fehler beim Erzeugen des Diffs.",
      );
    } finally {
      setDiffLoading(false);
    }
  };


  const selectedSecurityIds = new Set(mapping?.securityControls.map((s) => s.controlId));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          {/* OG Badge + Titel bleiben wie bisher */}
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 text-xs bg-slate-950/60 rounded-full p-0.5 border border-slate-800">
            <NavLink
              to="/sdm"
              className={({ isActive }) =>
                [
                  "px-3 py-1 rounded-full transition-colors",
                  isActive
                    ? "bg-emerald-500 text-emerald-950 font-medium"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")
              }
            >
              SDM ↔ Resilience
            </NavLink>
            <NavLink
              to="/resilience"
              className={({ isActive }) =>
                [
                  "px-3 py-1 rounded-full transition-colors",
                  isActive
                    ? "bg-emerald-500 text-emerald-950 font-medium"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")
              }
            >
              Resilience-View
            </NavLink>
          </nav>
          <div className="text-[11px] text-slate-400">
            Backend: <code className="text-emerald-300">{API_BASE}</code>
          </div>
        </div>
      </header>


      <main className="flex-1 flex overflow-hidden">
        {/* Left column: SDM control list */}
        <section className="w-full md:w-2/5 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm text-slate-100">
                SDM Controls
              </h2>
               <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <span>gemappt</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                    <span>offen</span>
                  </span>
                </div>
              </div>
              {loadingControls && (
                <span className="text-[10px] text-slate-400">lädt …</span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen nach ID, Titel, DSGVO-Artikel …"
                className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400"
              />
            </div>
            {controlsError && (
              <div className="text-xs text-red-400">{controlsError}</div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {filteredControls.length === 0 && !loadingControls ? (
              <div className="p-4 text-xs text-slate-500">
                Keine Controls gefunden. Filter anpassen oder Backend prüfen.
              </div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {filteredControls.map((c) => {
                  const isActive = c.id === selectedId;
                  const mappedCount = mappingIndex[c.id] ?? 0;
                  const isMapped = mappedCount > 0;

                  return (
                    <li
                      key={c.id}
                      className={`px-4 py-3 text-xs cursor-pointer transition-colors flex flex-col gap-1 ${
                        isActive
                          ? "bg-emerald-500/10 border-l border-emerald-400"
                          : "hover:bg-slate-900/60"
                      }`}
                      onClick={() => handleSelectControl(c.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-emerald-300">
                          {c.id}
                        </span>
                        <div className="flex items-center gap-1">
                          {c.props.sdmModule && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {c.props.sdmModule}
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full border ${
                              isMapped
                                ? "bg-emerald-500/10 border-emerald-400 text-emerald-300"
                                : "bg-slate-900 border-slate-700 text-slate-500"
                            }`}
                          >
                            {isMapped ? "gemappt" : "offen"}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-100 line-clamp-2">
                        {c.title}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.props.sdmGoals.map((g) => (
                          <span
                            key={g}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-900 text-slate-400"
                          >
                            {g}
                          </span>
                        ))}
                        {c.props.dsgvoArticles.map((a) => (
                          <span
                            key={a}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-900 text-slate-500"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Right column: Detail + Mapping */}
        <section className="hidden md:flex md:flex-1 flex-col">
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-auto">
            {/* Detailpanel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 min-h-[140px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm text-slate-100">
                  Control-Details
                </h2>
                {detailLoading && (
                  <span className="text-[10px] text-slate-400">lädt …</span>
                )}
              </div>

              {!selectedId && (
                <p className="text-xs text-slate-500">
                  Bitte ein SDM-Control in der Liste links auswählen.
                </p>
              )}

              {detailError && (
                <p className="text-xs text-red-400">{detailError}</p>
              )}

              {selectedDetail && (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="font-mono text-[11px] text-emerald-300">
                      {selectedDetail.id}
                    </div>
                    <div className="text-xs text-slate-100 mt-1">
                      {selectedDetail.title}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
                    {selectedDetail.props.sdmModule && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800">
                        Modul: {selectedDetail.props.sdmModule}
                      </span>
                    )}
                    {selectedDetail.props.implementationLevel && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800">
                        Reifegrad: {selectedDetail.props.implementationLevel}
                      </span>
                    )}
                    {selectedDetail.props.dpRiskImpact && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800">
                        DS-Risiko: {selectedDetail.props.dpRiskImpact}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                      DSGVO / Gewährleistungsziele
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedDetail.props.dsgvoArticles.map((a) => (
                        <span
                          key={a}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700"
                        >
                          {a}
                        </span>
                      ))}
                      {selectedDetail.props.sdmGoals.map((g) => (
                        <span
                          key={g}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mappingpanel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 min-h-[220px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm text-slate-100">
                  Mapping: SDM ↔ Resilience / Standards
                </h2>
                {(mappingLoading || mappingSaving) && (
                  <span className="text-[10px] text-slate-400">
                    {mappingSaving ? "speichert …" : "lädt Mapping …"}
                  </span>
                )}
              </div>

              {!selectedId && (
                <p className="text-xs text-slate-500">
                  Wähle links ein Control, um zugehörige Mappings zu bearbeiten.
                </p>
              )}

              {mappingError && (
                <p className="text-xs text-red-400">{mappingError}</p>
              )}
              {mappingSaveMessage && (
                <p className="text-xs text-emerald-400">{mappingSaveMessage}</p>
              )}

              {mapping && selectedDetail && (
                <div className="flex flex-col gap-4 text-xs">
                  {/* Kurzanleitung */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 flex flex-col gap-1">
                    <div className="text-[11px] font-medium text-slate-200">
                      So arbeiten Sie mit diesem Mapping
                    </div>
                    <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-0.5">
                      <li>Links ein SDM-Control auswählen.</li>
                      <li>Unten die Resilience-/Security-Controls anhaken, die dieses Control technisch abbilden.</li>
                      <li>Darunter die relevanten BSI- und ISO-Referenzen eintragen.</li>
                      <li>Bei Bedarf eine kurze fachliche Erläuterung ergänzen.</li>
                      <li>Auf <span className="text-slate-200 font-medium">„Mapping speichern“</span> klicken.</li>
                    </ol>
                  </div>
                  {/* Security / Resilience Auswahl */}
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                      Resilience-/Security-Controls
                    </div>
                    {securityError && (
                      <div className="text-[11px] text-red-400">{securityError}</div>
                    )}
                    <div className="max-h-40 overflow-auto rounded-xl border border-slate-800 bg-slate-950/40 p-2 flex flex-col gap-1">
                      {securityLoading ? (
                        <div className="text-[11px] text-slate-500">Lade Resilience-Controls …</div>
                      ) : securityControls.length === 0 ? (
                        <div className="text-[11px] text-slate-500">Keine Resilience-Controls gefunden.</div>
                      ) : (
                        securityControls.map((sec) => (
                          <label
                            key={sec.id}
                            className="flex items-start gap-2 text-[11px] text-slate-200 cursor-pointer hover:bg-slate-900/60 rounded-lg px-1 py-0.5"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3 w-3 rounded border-slate-600 bg-slate-900"
                              checked={selectedSecurityIds.has(sec.id)}
                              onChange={() => handleSecurityControlToggle(sec.id)}
                            />
                            <span>
                              <span className="font-mono text-[10px] text-emerald-300 mr-1">
                                {sec.id}
                              </span>
                              <span>{sec.title}</span>
                              {sec.domain && (
                                <span className="ml-1 text-[10px] text-slate-400">
                                  ({sec.domain})
                                </span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Auswahl der Resilience-/Security-Controls, die dieses SDM-Control aus technischer Sicht mit abdecken.
                    </p>
                  </div>

                  {/* Standards: BSI / ISO */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                        BSI IT-Grundschutz
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                        placeholder="z.B. CON.2, APP.3.1, APP.4.3"
                        value={(mapping.standards.bsi ?? []).join(", ")}
                        onChange={(e) => handleStandardsChange("bsi", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                        ISO 27001:2022
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                        placeholder="z.B. 5.34, 8.10"
                        value={(mapping.standards.iso27001 ?? []).join(", ")}
                        onChange={(e) => handleStandardsChange("iso27001", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                        ISO 27701 / PIMS
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                        placeholder="z.B. 7.3.6, obligations-to-pii-principals"
                        value={(mapping.standards.iso27701 ?? []).join(", ")}
                        onChange={(e) => handleStandardsChange("iso27701", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                      Erläuterung / Notes
                    </label>
                    <textarea
                      className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[70px]"
                      placeholder="Kurze Erläuterung, wie dieses Mapping aus Datenschutz- und Resilienz-Sicht zu verstehen ist."
                      value={mapping.notes ?? ""}
                      onChange={(e) => handleNotesChange(e.target.value)}
                    />
                  </div>

                {diffOpen && (
                  <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-medium text-slate-200">
                        Diff zur gespeicherten Mapping-Datei
                      </div>
                      <button
                        type="button"
                        onClick={() => setDiffOpen(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-200"
                      >
                        schließen
                      </button>
                    </div>
                    {diffLoading && (
                      <div className="text-[11px] text-slate-500">
                        Diff wird berechnet …
                      </div>
                    )}
                    {diffError && (
                      <div className="text-[11px] text-red-400">{diffError}</div>
                    )}
                    {!diffLoading && !diffError && diffResult && (
                      <pre className="text-[10px] text-slate-200 bg-slate-950/80 rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap">
                        {JSON.stringify(diffResult, null, 2)}
                      </pre>
                    )}
                    {!diffLoading && !diffError && !diffResult && (
                      <div className="text-[11px] text-slate-500">
                        Es liegen aktuell keine Unterschiede zur gespeicherten Datei vor
                        (oder der Diff enthält keine relevanten Änderungen für dieses
                        Mapping).
                      </div>
                    )}
                  </div>
                )}



                  <div className="flex items-center justify-between mt-1 gap-3">
                    <p className="text-[10px] text-slate-500 max-w-md">
                      Änderungen werden direkt in der Mapping-Datei gespeichert. Für umfangreiche Änderungen empfiehlt sich ein separater Branch bzw. Review-Prozess. Über{" "}
                      <span className="text-slate-200 font-medium">„Diff anzeigen“</span> können Sie die Änderungen vor dem Speichern prüfen.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={showDiff}
                        disabled={diffLoading || !mapping}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {diffLoading ? "Diff …" : "Diff anzeigen"}
                      </button>
                      <button
                        type="button"
                        onClick={saveMapping}
                        disabled={mappingSaving}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-emerald-950 px-3 py-1.5 text-[11px] font-medium shadow-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {mappingSaving ? "Speichern …" : "Mapping speichern"}
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </section>

        {/* Mobile Hinweis */}
        <section className="md:hidden p-4 text-xs text-slate-400 border-t border-slate-800 bg-slate-950/80">
          Die Detail- und Mapping-Ansicht ist auf größeren Bildschirmen (Tablet/Desktop) verfügbar.
        </section>
      </main>
    </div>
  );
};

export default SDMControlsPage;
