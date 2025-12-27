import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

type SecurityControl = {
  id: string;
  title: string;
  class_?: string | null;
  domain?: string | null;
  objective?: string | null;
  description?: string | null;
};

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

type SdmMappingForSec = {
  sdmControlId: string;
  sdmTitle: string;
  standards: MappingStandards;
  notes?: string | null;
};

// Diff types

type ResilienceFieldDiff = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

type ResilienceDiffSummary = {
  hasChanges: boolean;
  changes: ResilienceFieldDiff[];
};


const API_BASE = "http://localhost:3000";

const ResilienceControlsPage: React.FC = () => {
  const [controls, setControls] = useState<SecurityControl[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SecurityControl | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [mappings, setMappings] = useState<SdmSecurityMapping[]>([]);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);

  const [editedControl, setEditedControl] = useState<SecurityControl | null>(
    null,
  );

  const [resDiffOpen, setResDiffOpen] = useState(false);
  const [resDiffSummary, setResDiffSummary] =
    useState<ResilienceDiffSummary | null>(null);
  const [resDiffLoading, setResDiffLoading] = useState(false);
  const [resDiffError, setResDiffError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // SEC-ID -> Anzahl der SDM-Mappings
  const [mappingIndex, setMappingIndex] = useState<Record<string, number>>({});

  // --- Initial load: Resilience-Controls + alle Mappings ---

  useEffect(() => {
    const loadControls = async () => {
      setLoadingControls(true);
      setControlsError(null);
      try {
        const res = await fetch(`${API_BASE}/api/resilience/controls`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setControls(data.items ?? []);
      } catch (err: any) {
        console.error(err);
        setControlsError("Fehler beim Laden der Resilience-Controls.");
      } finally {
        setLoadingControls(false);
      }
    };

    const loadMappings = async () => {
      setMappingLoading(true);
      setMappingError(null);
      try {
        const res = await fetch(`${API_BASE}/api/mapping`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items: SdmSecurityMapping[] = data.items ?? [];
        setMappings(items);

        const index: Record<string, number> = {};
        for (const m of items) {
          for (const sc of m.securityControls ?? []) {
            const id = sc.controlId;
            if (!id) continue;
            index[id] = (index[id] ?? 0) + 1;
          }
        }
        setMappingIndex(index);
      } catch (err: any) {
        console.error(err);
        setMappingError("Fehler beim Laden der SDM-Mappings.");
      } finally {
        setMappingLoading(false);
      }
    };

    loadControls();
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
        c.domain ?? "",
        c.objective ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [controls, search]);

  // --- Auswahl eines Resilience-Controls ---

  const handleSelectControl = (id: string) => {
    setSelectedId(id);
    setSelectedDetail(null);
    setDetailError(null);

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/resilience/controls/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SecurityControl = await res.json();
        setSelectedDetail(data);
        setEditedControl(data); // Kopie für die Bearbeitung
        setResDiffOpen(false);
        setResDiffSummary(null);
        setResDiffError(null);
      } catch (err: any) {
        console.error(err);
        setDetailError("Fehler beim Laden der Control-Details.");
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  };


  // --- Aus den Mappings: welche SDM-Controls referenzieren dieses SEC-Control? ---

  const mappedSdmControlsForSelected: SdmMappingForSec[] = useMemo(() => {
    if (!selectedId) return [];
    const result: SdmMappingForSec[] = [];

    for (const m of mappings) {
      const usesSelected = (m.securityControls ?? []).some(
        (sc) => sc.controlId === selectedId,
      );
      if (!usesSelected) continue;

      result.push({
        sdmControlId: m.sdmControlId,
        sdmTitle: m.sdmTitle,
        standards: m.standards,
        notes: m.notes,
      });
    }

    return result;
  }, [mappings, selectedId]);

  const showResilienceDiff = () => {
    if (!selectedDetail || !editedControl) return;

    setResDiffLoading(true);
    setResDiffError(null);
    setResDiffSummary(null);
    setResDiffOpen(true);

    try {
      const changes: ResilienceFieldDiff[] = [];

      const norm = (v?: string | null) =>
        v === undefined || v === null || v === "" ? null : v;

      const fields: Array<{
        field: keyof SecurityControl;
        label: string;
      }> = [
        { field: "title", label: "Titel" },
        { field: "objective", label: "Ziel / Objective" },
        { field: "description", label: "Beschreibung" },
      ];

      fields.forEach(({ field, label }) => {
        const before = norm(selectedDetail[field] as string | null);
        const after = norm(editedControl[field] as string | null);
        if (before !== after) {
          changes.push({ field, label, before, after });
        }
      });

      const summary: ResilienceDiffSummary = {
        hasChanges: changes.length > 0,
        changes,
      };

      setResDiffSummary(summary);
    } catch (err: any) {
      console.error(err);
      setResDiffError(
        err instanceof Error
          ? err.message
          : "Fehler beim Erzeugen des Diffs.",
      );
    } finally {
      setResDiffLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
            {/* OG Badge + Titel deiner Resilience-Seite */}
        </div>
        <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1 text-xs bg-slate-950/60 rounded-full p-0.5 border border-slate-800">
             <NavLink
              to="/privacy"
              className={({ isActive }) =>
                [
                  "px-3 py-1 rounded-full transition-colors",
                  isActive
                    ? "bg-emerald-500 text-emerald-950 font-medium"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")
              }
            >
              Privacy-Katalog
            </NavLink>
            <NavLink
                to="/sdm"
                className={({ isActive }) =>
                [
                    "px-3 py-1 rounded-full transition-colors",
                    isActive
                    ? "bg-sky-500 text-sky-950 font-medium"
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
                    ? "bg-sky-500 text-sky-950 font-medium"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")
                }
            >
                Resilience-View
            </NavLink>
            </nav>
            <div className="text-[11px] text-slate-400">
            Backend: <code className="text-sky-300">{API_BASE}</code>
            </div>
        </div>
      </header>


      <main className="flex-1 flex overflow-hidden">
        {/* Linke Spalte: Resilience-Controls */}
        <section className="w-full md:w-2/5 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm text-slate-100">
                Resilience-Controls
              </h2>
              {loadingControls && (
                <span className="text-[10px] text-slate-400">lädt …</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <span>mind. 1 SDM-Mapping</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                <span>noch nicht gemappt</span>
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen nach ID, Titel, Domain …"
                className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
              />
            </div>
            {controlsError && (
              <div className="text-xs text-red-400">{controlsError}</div>
            )}
            {mappingError && (
              <div className="text-xs text-red-400">{mappingError}</div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {filteredControls.length === 0 && !loadingControls ? (
              <div className="p-4 text-xs text-slate-500">
                Keine Resilience-Controls gefunden. Filter anpassen oder Backend
                prüfen.
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
                          ? "bg-sky-500/10 border-l border-sky-400"
                          : "hover:bg-slate-900/60"
                      }`}
                      onClick={() => handleSelectControl(c.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-sky-300">
                          {c.id}
                        </span>
                        <div className="flex items-center gap-1">
                          {c.domain && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {c.domain}
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full border ${
                              isMapped
                                ? "bg-emerald-500/10 border-emerald-400 text-emerald-300"
                                : "bg-slate-900 border-slate-700 text-slate-500"
                            }`}
                          >
                            {isMapped
                              ? `${mappedCount}× SDM`
                              : "kein SDM-Mapping"}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-100 line-clamp-2">
                        {c.title}
                      </div>
                      {c.objective && (
                        <div className="text-[10px] text-slate-400 line-clamp-1">
                          {c.objective}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Rechte Spalte: Details + SDM-Mappings */}
        <section className="hidden md:flex md:flex-1 flex-col">
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-auto">
            {/* Details */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 min-h-[140px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm text-slate-100">
                  Resilience-Control
                </h2>
                {detailLoading && (
                  <span className="text-[10px] text-slate-400">lädt …</span>
                )}
              </div>

              {!selectedId && (
                <p className="text-xs text-slate-500">
                  Bitte ein Resilience-Control in der Liste links auswählen.
                </p>
              )}

              {detailError && (
                <p className="text-xs text-red-400">{detailError}</p>
              )}

              {selectedDetail && editedControl && (
                <div className="flex flex-col gap-3 text-xs">
                  <div>
                    <div className="font-mono text-[11px] text-sky-300">
                      {selectedDetail.id}
                    </div>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                      placeholder="Titel des Resilience-Controls"
                      value={editedControl.title}
                      onChange={(e) =>
                        setEditedControl({ ...editedControl, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
                    {editedControl.domain && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800">
                        Domain: {editedControl.domain}
                      </span>
                    )}
                    <div className="flex-1 min-w-[50%]">
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Ziel / Objective
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                        placeholder="Kurze Beschreibung des Schutzziels"
                        value={editedControl.objective ?? ""}
                        onChange={(e) =>
                          setEditedControl({
                            ...editedControl,
                            objective: e.target.value || null,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">
                      Beschreibung / Beschreibungstext
                    </label>
                    <textarea
                      className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 min-h-[80px]"
                      placeholder="Detaillierte Beschreibung des Resilience-Controls aus Security-/Resilienz-Sicht."
                      value={editedControl.description ?? ""}
                      onChange={(e) =>
                        setEditedControl({
                          ...editedControl,
                          description: e.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
              )}

            </div>
            
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-slate-500 max-w-md">
                Änderungen am Titel, Ziel oder Beschreibung werden aktuell nur im
                Browser gehalten. Über{" "}
                <span className="text-slate-200 font-medium">„Diff anzeigen“</span>{" "}
                können Sie Ihre Anpassungen im Vergleich zur gespeicherten Version
                prüfen.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={showResilienceDiff}
                  disabled={!editedControl || resDiffLoading}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resDiffLoading ? "Diff …" : "Diff anzeigen"}
                </button>
                {/* optional: später hier einen Save-Button ergänzen */}
              </div>
            </div>

            {resDiffOpen && (
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-medium text-slate-200">
                    Änderungen an diesem Resilience-Control
                  </div>
                  <button
                    type="button"
                    onClick={() => setResDiffOpen(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    schließen
                  </button>
                </div>

                {resDiffLoading && (
                  <div className="text-[11px] text-slate-500">
                    Diff wird berechnet …
                  </div>
                )}

                {resDiffError && (
                  <div className="text-[11px] text-red-400">{resDiffError}</div>
                )}

                {!resDiffLoading && !resDiffError && resDiffSummary && !resDiffSummary.hasChanges && (
                  <div className="text-[11px] text-slate-500">
                    Es wurden keine Unterschiede zur geladenen Version dieses
                    Controls gefunden.
                  </div>
                )}

                {!resDiffLoading && !resDiffError && resDiffSummary && resDiffSummary.hasChanges && (
                  <div className="flex flex-col gap-2 text-[11px] text-slate-200">
                    {resDiffSummary.changes.map((c) => (
                      <div key={c.field} className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5">
                        <div className="font-medium text-slate-100 mb-0.5">
                          {c.label}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Vorher:{" "}
                          <span className="text-slate-500">
                            {c.before ?? "—"}
                          </span>
                        </div>
                        <div className="text-[10px] text-emerald-200 mt-0.5">
                          Jetzt:{" "}
                          <span>{c.after ?? "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}



            {/* SDM-Mappings für dieses SEC-Control */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 min-h-[200px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm text-slate-100">
                  Zugeordnete SDM-Controls
                </h2>
              </div>

              {!selectedId && (
                <p className="text-xs text-slate-500">
                  Wähle ein Resilience-Control aus, um verknüpfte SDM-Controls
                  zu sehen.
                </p>
              )}

              {selectedId && mappedSdmControlsForSelected.length === 0 && (
                <p className="text-xs text-slate-500">
                  Für dieses Resilience-Control sind aktuell keine SDM-Controls
                  gemappt.
                </p>
              )}

              {selectedId && mappedSdmControlsForSelected.length > 0 && (
                <div className="flex flex-col gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="text-[11px] font-medium text-slate-200">
                      Wie lese ich diese Ansicht?
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Jedes SDM-Control unten beschreibt eine datenschutzrechtliche
                      Anforderung. Dieses Resilience-Control trägt zur Erfüllung
                      dieser Controls bei. Standards-Verweise (BSI, ISO) helfen,
                      die Brücke zu bestehenden Security-Anforderungen zu schlagen.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 max-h-80 overflow-auto">
                    {mappedSdmControlsForSelected.map((m) => (
                      <div
                        key={m.sdmControlId}
                        className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-mono text-[11px] text-emerald-300">
                              {m.sdmControlId}
                            </div>
                            <div className="text-[11px] text-slate-100">
                              {m.sdmTitle}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-300 mt-1">
                          {m.standards.bsi && m.standards.bsi.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                              BSI: {m.standards.bsi.join(", ")}
                            </span>
                          )}
                          {m.standards.iso27001 &&
                            m.standards.iso27001.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                                ISO 27001: {m.standards.iso27001.join(", ")}
                              </span>
                            )}
                          {m.standards.iso27701 &&
                            m.standards.iso27701.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                                ISO 27701: {m.standards.iso27701.join(", ")}
                              </span>
                            )}
                        </div>
                        {m.notes && (
                          <div className="text-[11px] text-slate-400 mt-1">
                            {m.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Mobile Hinweis */}
        <section className="md:hidden p-4 text-xs text-slate-400 border-t border-slate-800 bg-slate-950/80">
          Die Detail- und Mapping-Ansicht ist auf größeren Bildschirmen
          (Tablet/Desktop) verfügbar.
        </section>
      </main>
    </div>
  );
};

export default ResilienceControlsPage;
