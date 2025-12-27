import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";


type PrivacyGroup = {
  id: string;
  title: string;
  description?: string | null;
  controlCount: number;
};

type PrivacyControl = {
  id: string;
  title: string;
  groupId?: string | null;
  tomId?: string | null;
  dsgvoArticles: string[];
  dpGoals: string[];
};

type PrivacyControlDetail = PrivacyControl & {
  statement?: string | null;
  maturityLevel1?: string | null;
  maturityLevel3?: string | null;
  maturityLevel5?: string | null;
  typicalMeasures: string[];
  assessmentQuestions: string[];
  riskHint?: string | null;
};

type PrivacyDiffFieldChange = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

type ListDiff = {
  label: string;
  added: string[];
  removed: string[];
};

type PrivacyDiffSummary = {
  hasChanges: boolean;
  changedFields: PrivacyDiffFieldChange[];
  measuresDiff?: ListDiff;
  questionsDiff?: ListDiff;
};


const API_BASE = "http://localhost:3000";


const normalizeList = (value: string): string[] =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

const joinList = (values: string[]): string =>
  values.length ? values.join("\n") : "";

const PrivacyCatalogPage: React.FC = () => {
  // Gruppen (aus Backend)
  const [groups, setGroups] = useState<PrivacyGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // Gruppen-Admin UI
  const [groupAdminOpen, setGroupAdminOpen] = useState(false);
  const [groupAdminError, setGroupAdminError] = useState<string | null>(null);
  const [groupAdminSaving, setGroupAdminSaving] = useState(false);

  const [groupEditDraft, setGroupEditDraft] = useState<
    Record<string, { title: string; description: string }>
  >({});

  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");


  const [controls, setControls] = useState<PrivacyControl[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [originalDetail, setOriginalDetail] =
    useState<PrivacyControlDetail | null>(null);
  const [editedDetail, setEditedDetail] =
    useState<PrivacyControlDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffSummary, setDiffSummary] = useState<PrivacyDiffSummary | null>(
    null,
  );
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);


  // ----------------- Daten laden -----------------

  const fetchGroups = async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/privacy/groups`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = (data.items ?? []).map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description ?? null,
        controlCount: g.controlCount ?? 0,
      })) as PrivacyGroup[];
      setGroups(items);
    } catch (err: any) {
      console.error(err);
      setGroupsError("Fehler beim Laden der Gruppen.");
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);


  useEffect(() => {
    const loadControls = async () => {
      setLoadingControls(true);
      setControlsError(null);
      try {
        const res = await fetch(`${API_BASE}/api/privacy/controls`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = (data.items ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          groupId: c.group_id ?? null,
          tomId: c.tom_id ?? null,
          dsgvoArticles: c.dsgvo_articles ?? [],
          dpGoals: c.dp_goals ?? [],
        })) as PrivacyControl[];
        setControls(items);
      } catch (err: any) {
        console.error(err);
        setControlsError("Fehler beim Laden der Privacy-Controls.");
      } finally {
        setLoadingControls(false);
      }
    };

    loadControls();
  }, []);

//----- group admin handler ---------

  const handleUpdateGroup = async (id: string) => {
    const current = groups.find((g) => g.id === id);
    if (!current) return;

    const draft = groupEditDraft[id] ?? {
      title: current.title,
      description: current.description ?? "",
    };

    const payload = {
      title: draft.title.trim() || current.title,
      description: draft.description.trim() || null,
    };

    setGroupAdminSaving(true);
    setGroupAdminError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/privacy/groups/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const updated = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                id: updated.id,
                title: updated.title,
                description: updated.description ?? null,
                controlCount: updated.controlCount ?? g.controlCount,
              }
            : g,
        ),
      );
      setGroupEditDraft((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    } catch (err: any) {
      console.error(err);
      setGroupAdminError(
        err instanceof Error
          ? err.message
          : "Fehler beim Aktualisieren der Gruppe.",
      );
    } finally {
      setGroupAdminSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    const id = newGroupId.trim();
    const title = newGroupTitle.trim();
    const description = newGroupDescription.trim();

    if (!id || !title) {
      setGroupAdminError("Gruppen-ID und Titel sind erforderlich.");
      return;
    }

    setGroupAdminSaving(true);
    setGroupAdminError(null);
    try {
      const res = await fetch(`${API_BASE}/api/privacy/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          description: description || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const g = await res.json();
      const newGroup: PrivacyGroup = {
        id: g.id,
        title: g.title,
        description: g.description ?? null,
        controlCount: g.controlCount ?? 0,
      };
      setGroups((prev) =>
        [...prev, newGroup].sort((a, b) => a.id.localeCompare(b.id)),
      );
      setNewGroupId("");
      setNewGroupTitle("");
      setNewGroupDescription("");
    } catch (err: any) {
      console.error(err);
      setGroupAdminError(
        err instanceof Error
          ? err.message
          : "Fehler beim Anlegen der Gruppe.",
      );
    } finally {
      setGroupAdminSaving(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const g = groups.find((gr) => gr.id === id);
    if (!g) return;
    if (g.controlCount > 0) {
      setGroupAdminError(
        "Diese Gruppe enthält noch Controls und kann nicht gelöscht werden. Controls zuerst in eine andere Gruppe verschieben.",
      );
      return;
    }

    setGroupAdminSaving(true);
    setGroupAdminError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/privacy/groups/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowDeleteNonEmpty: false }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      await res.json();
      setGroups((prev) => prev.filter((gr) => gr.id !== id));
    } catch (err: any) {
      console.error(err);
      setGroupAdminError(
        err instanceof Error
          ? err.message
          : "Fehler beim Löschen der Gruppe.",
      );
    } finally {
      setGroupAdminSaving(false);
    }
  };



  const filteredControls = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return controls;
    return controls.filter((c) => {
      const haystack = [
        c.id,
        c.title,
        c.groupId ?? "",
        c.tomId ?? "",
        ...c.dsgvoArticles,
        ...c.dpGoals,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [controls, search]);


  const groupedControls = useMemo(() => {
    // Controls nach groupId sammeln
    const byGroupId: Record<string, PrivacyControl[]> = {};
    filteredControls.forEach((c) => {
      const gid = c.groupId || "(ohne-gruppe)";
      if (!byGroupId[gid]) byGroupId[gid] = [];
      byGroupId[gid].push(c);
    });

    type GroupBlock = {
      group: { id: string; title: string; description?: string | null; controlCount: number };
      items: PrivacyControl[];
    };

    const result: GroupBlock[] = [];

    // 1. bekannte Gruppen (aus Catalog.groups)
    groups.forEach((g) => {
      const items = byGroupId[g.id] ?? [];
      if (items.length === 0) return; // Gruppe hat für aktuellen Filter keine Controls
      items.sort((a, b) => (a.tomId || a.id).localeCompare(b.tomId || b.id));
      result.push({
        group: g,
        items,
      });
    });

    // 2. evtl. übrige groupIds, die nicht in groups auftauchen (z.B. alte Daten)
    Object.entries(byGroupId).forEach(([gid, items]) => {
      if (gid === "(ohne-gruppe)") return;
      if (groups.find((g) => g.id === gid)) return;
      items.sort((a, b) => (a.tomId || a.id).localeCompare(b.tomId || b.id));
      result.push({
        group: {
          id: gid,
          title: gid,
          description: null,
          controlCount: items.length,
        },
        items,
      });
    });

    // 3. Gruppe „Ohne Gruppe“
    if (byGroupId["(ohne-gruppe)"]) {
      const items = byGroupId["(ohne-gruppe)"];
      items.sort((a, b) => (a.tomId || a.id).localeCompare(b.tomId || b.id));
      result.push({
        group: {
          id: "(ohne-gruppe)",
          title: "Ohne Gruppe",
          description: null,
          controlCount: items.length,
        },
        items,
      });
    }

    // final sortieren nach Gruppen-ID
    result.sort((a, b) => a.group.id.localeCompare(b.group.id));
    return result;
  }, [filteredControls, groups]);



  // ----------------- Auswahl / Detail laden -----------------

  const handleSelectControl = (id: string) => {
    setSelectedId(id);
    setDetailError(null);
    setSaveError(null);
    setSaveMessage(null);
    setDiffOpen(false);
    setDiffSummary(null);
    setDiffError(null);

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/privacy/controls/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        const detail: PrivacyControlDetail = {
          id: d.id,
          title: d.title,
          groupId: d.group_id ?? null,
          tomId: d.tom_id ?? null,
          dsgvoArticles: d.dsgvo_articles ?? [],
          dpGoals: d.dp_goals ?? [],
          statement: d.statement ?? null,
          maturityLevel1: d.maturity_level_1 ?? null,
          maturityLevel3: d.maturity_level_3 ?? null,
          maturityLevel5: d.maturity_level_5 ?? null,
          typicalMeasures: d.typical_measures ?? [],
          assessmentQuestions: d.assessment_questions ?? [],
          riskHint: d.risk_hint ?? null,
        };
        setOriginalDetail(detail);
        setEditedDetail(detail);
      } catch (err: any) {
        console.error(err);
        setDetailError("Fehler beim Laden der Control-Details.");
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  };

  // ----------------- Diff-Berechnung -----------------

  const showDiff = () => {
    if (!originalDetail || !editedDetail) return;

    setDiffOpen(true);
    setDiffLoading(true);
    setDiffError(null);
    setDiffSummary(null);

    try {
      const norm = (v?: string | null) =>
        v === undefined || v === null || v === "" ? null : v;

      const changes: PrivacyDiffFieldChange[] = [];

      const fieldDefs: Array<{ field: keyof PrivacyControlDetail; label: string }> =
        [
          { field: "title", label: "Titel" },
          { field: "statement", label: "Statement" },
          { field: "maturityLevel1", label: "Maturity Level 1" },
          { field: "maturityLevel3", label: "Maturity Level 3" },
          { field: "maturityLevel5", label: "Maturity Level 5" },
          { field: "riskHint", label: "Risk-Hinweis" },
        ];

      fieldDefs.forEach(({ field, label }) => {
        const before = norm(originalDetail[field] as string | null);
        const after = norm(editedDetail[field] as string | null);
        if (before !== after) {
          changes.push({ field, label, before, after });
        }
      });

      const diffList = (oldList: string[], newList: string[]): ListDiff => {
        const oldSet = new Set(oldList.map((v) => v.trim()));
        const newSet = new Set(newList.map((v) => v.trim()));
        const added: string[] = [];
        const removed: string[] = [];

        newSet.forEach((v) => {
          if (!oldSet.has(v) && v.length > 0) added.push(v);
        });
        oldSet.forEach((v) => {
          if (!newSet.has(v) && v.length > 0) removed.push(v);
        });

        return { label: "", added, removed };
      };

      const measuresDiff = diffList(
        originalDetail.typicalMeasures,
        editedDetail.typicalMeasures,
      );
      const questionsDiff = diffList(
        originalDetail.assessmentQuestions,
        editedDetail.assessmentQuestions,
      );

      const hasMeasuresChanges =
        measuresDiff.added.length > 0 || measuresDiff.removed.length > 0;
      const hasQuestionsChanges =
        questionsDiff.added.length > 0 || questionsDiff.removed.length > 0;

      const summary: PrivacyDiffSummary = {
        hasChanges:
          changes.length > 0 || hasMeasuresChanges || hasQuestionsChanges,
        changedFields: changes,
        measuresDiff: hasMeasuresChanges
          ? { ...measuresDiff, label: "Typical Measures" }
          : undefined,
        questionsDiff: hasQuestionsChanges
          ? { ...questionsDiff, label: "Assessment Questions" }
          : undefined,
      };

      setDiffSummary(summary);
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

  // ----------------- Speichern -----------------

  const saveControl = async () => {
    if (!editedDetail) return;

    setSaveLoading(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = {
        id: editedDetail.id,
        title: editedDetail.title,
        group_id: editedDetail.groupId ?? null,
        tom_id: editedDetail.tomId ?? null,
        dsgvo_articles: editedDetail.dsgvoArticles,
        dp_goals: editedDetail.dpGoals,
        statement: editedDetail.statement ?? null,
        maturity_level_1: editedDetail.maturityLevel1 ?? null,
        maturity_level_3: editedDetail.maturityLevel3 ?? null,
        maturity_level_5: editedDetail.maturityLevel5 ?? null,
        typical_measures: editedDetail.typicalMeasures,
        assessment_questions: editedDetail.assessmentQuestions,
        risk_hint: editedDetail.riskHint ?? null,
      };

      const res = await fetch(
        `${API_BASE}/api/privacy/controls/${editedDetail.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      const updated = data.updated;

      const newDetail: PrivacyControlDetail = {
        id: updated.id,
        title: updated.title,
        groupId: updated.group_id ?? null,
        tomId: updated.tom_id ?? null,
        dsgvoArticles: updated.dsgvo_articles ?? [],
        dpGoals: updated.dp_goals ?? [],
        statement: updated.statement ?? null,
        maturityLevel1: updated.maturity_level_1 ?? null,
        maturityLevel3: updated.maturity_level_3 ?? null,
        maturityLevel5: updated.maturity_level_5 ?? null,
        typicalMeasures: updated.typical_measures ?? [],
        assessmentQuestions: updated.assessment_questions ?? [],
        riskHint: updated.risk_hint ?? null,
      };

      setOriginalDetail(newDetail);
      setEditedDetail(newDetail);

      // Liste links optional aktualisieren
      setControls((prev) =>
        prev.map((c) =>
          c.id === newDetail.id
            ? {
                ...c,
                title: newDetail.title,
              }
            : c,
        ),
      );

      setSaveMessage(
        "Control erfolgreich gespeichert. Bitte die Änderung anschließend im Git-Repository prüfen und ggf. committen.",
      );
    } catch (err: any) {
      console.error(err);
      setSaveError(
        err instanceof Error
          ? err.message
          : "Fehler beim Speichern des Controls.",
      );
    } finally {
      setSaveLoading(false);
    }
  };


  // UI Gruppierung
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // ----------------- Rendering -----------------

  return (
    <div className="min-h-screen min-w-screen bg-primary-200 text-neutral-500 flex flex-col">
      <header className="border-b border-privacy-border bg-sky-800 backdrop-blur px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-privacy-primary/20 flex items-center justify-center text-white font-bold text-xl">
             &#9929;
            </div>
            <div>
              <div className="font-semibold text-xl tracking-wide text-gray-100">
                OpenGov OSCAL Workbench
              </div>
              <div className="text-xm text-gray-400">
                Privacy-Katalog • Open Privacy Catalog
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1 text-xm bg-white text-sky-800 rounded-full p-0.5 border border-privacy-border font-semibold">
            <NavLink
                to="/privacy"
                className={({ isActive }) =>
                  [
                    "px-3 py-1.5 rounded-full transition-colors",
                    isActive
                      ? "bg-gray-100 text-green-800 "
                      : "text-00 hover:bg-sky-100",
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
                      ? "bg-gray-100 text-green-800 font-semibold"
                      : "text-slate-300 hover:bg-sky-100",
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
                      ? "bg-gray-100 text-green-800 font-semibold"
                      : "text-slate-300 hover:bg-sky-100",
                  ].join(" ")
                }
              >
                Resilience-View
              </NavLink>
            </nav>
            <div className="hidden sm:block text-[11px] text-gray-400">
              Backend:&nbsp;
              <code className="text-blue-300">{API_BASE}</code>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex bg-gray-50 overflow-hidden">
        <div className="max-w-10xl mx-auto px-4 py-4 flex flex-col md:flex-row gap-4 h-full">
        {/* Linke Spalte: Privacy-Controls */}
        {/*<section className="w-full md:w-2/5 border-r border-slate-800 flex flex-col">*/}
        <section className="w-full md:w-[400px] lg:w-[450px] flex flex-col border border-privacy-border rounded-2xl bg-white">
          <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-xl text-sgray-500">
                Privacy-Controls
              </h2>
              {loadingControls && (
                <span className="text-[10px] text-slate-400">lädt …</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                Basis-Katalog für datenschutzrechtliche Anforderungen (Statement,
                Reifegrade, Fragen).
              </span>
                <button
                  type="button"
                  onClick={() => {
                    setGroupAdminOpen((open) => !open);
                    setGroupAdminError(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-gray-100 px-2 py-1 text-[10px] text-gray-500 hover:bg-slate-900"
                  >
                  Gruppen verwalten
                </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen nach ID, Titel, DSGVO-Artikel, DP-Zielen …"
                className="w-full rounded-xl bg-gray-300 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400"
              />
            </div>
            {groupAdminOpen && (
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">Gruppen verwalten</div>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupAdminOpen(false);
                      setGroupAdminError(null);
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    schließen
                  </button>
                </div>

                {groupsLoading && (
                  <div className="text-[10px] text-slate-500">
                    Gruppen werden geladen …
                  </div>
                )}
                {groupsError && (
                  <div className="text-[10px] text-red-400">{groupsError}</div>
                )}
                {groupAdminError && (
                  <div className="text-[10px] text-red-400">{groupAdminError}</div>
                )}

                {/* bestehende Gruppen */}
                <div className="max-h-56 overflow-auto flex flex-col gap-2 mt-1">
                  {groups.map((g) => {
                    const draft = groupEditDraft[g.id] ?? {
                      title: g.title,
                      description: g.description ?? "",
                    };
                    const isEmpty = g.controlCount === 0;
                    return (
                      <div
                        key={g.id}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 flex flex-col gap-1"
                      >
                        <div className="text-[10px] text-slate-500">
                          ID: <span className="font-mono">{g.id}</span>
                        </div>
                        <input
                          type="text"
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                          placeholder="Gruppentitel"
                          value={draft.title}
                          onChange={(e) =>
                            setGroupEditDraft((prev) => ({
                              ...prev,
                              [g.id]: {
                                title: e.target.value,
                                description: draft.description,
                              },
                            }))
                          }
                        />
                        <textarea
                          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[40px]"
                          placeholder="Optionale Beschreibung / Hinweise zur Gruppe"
                          value={draft.description}
                          onChange={(e) =>
                            setGroupEditDraft((prev) => ({
                              ...prev,
                              [g.id]: {
                                title: draft.title,
                                description: e.target.value,
                              },
                            }))
                          }
                        />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-slate-500">
                            Controls: {g.controlCount}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={groupAdminSaving}
                              onClick={() => handleUpdateGroup(g.id)}
                              className="px-2 py-1 rounded-full bg-slate-800 text-[10px] text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Speichern
                            </button>
                            <button
                              type="button"
                              disabled={groupAdminSaving || !isEmpty}
                              onClick={() => handleDeleteGroup(g.id)}
                              className={`px-2 py-1 rounded-full text-[10px] ${
                                isEmpty
                                  ? "bg-red-900/60 text-red-200 hover:bg-red-800"
                                  : "bg-slate-900 text-slate-500 cursor-not-allowed"
                              }`}
                              title={
                                isEmpty
                                  ? "Leere Gruppe löschen"
                                  : "Gruppe enthält noch Controls und kann nicht gelöscht werden"
                              }
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {groups.length === 0 && !groupsLoading && (
                    <div className="text-[10px] text-slate-500">
                      Noch keine Gruppen im Katalog definiert.
                    </div>
                  )}
                </div>

                {/* neue Gruppe anlegen */}
                <div className="mt-2 border-t border-slate-800 pt-2 flex flex-col gap-1">
                  <div className="text-[11px] font-medium text-slate-100">
                    Neue Gruppe anlegen
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                      placeholder="Gruppen-ID (stabil, z.B. tom-access-control)"
                      value={newGroupId}
                      onChange={(e) => setNewGroupId(e.target.value)}
                    />
                    <input
                      type="text"
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                      placeholder="Gruppentitel (sichtbarer Name)"
                      value={newGroupTitle}
                      onChange={(e) => setNewGroupTitle(e.target.value)}
                    />
                    <textarea
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[40px]"
                      placeholder="Optionale Beschreibung"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={groupAdminSaving}
                        onClick={handleCreateGroup}
                        className="px-3 py-1 rounded-full bg-emerald-500 text-emerald-950 text-[10px] font-medium hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Gruppe anlegen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}




            {controlsError && (
              <div className="text-xs text-red-400">{controlsError}</div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {groupedControls.length === 0 && !loadingControls ? (
              <div className="p-4 text-xs text-slate-500">
                Keine Privacy-Controls gefunden. Filter anpassen oder Backend prüfen.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {groupedControls.map(({ group, items }) => {
                  const isExpanded =
                    expandedGroups[group.id] ?? true;
                  const total = items.length;
                  return (
                    <div key={group.id} className="border-b border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs bg-slate-900/80 hover:bg-slate-900"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-4 w-4 items-center justify-center text-xl text-sky-800">
                            {isExpanded ? "▾" : "▸"}
                          </span>
                          <span className="font-medium text-sky-800 text-xm font-semibold">
                            {group.title}
                          </span>
                        </div>
                        <span className="text-xm font-semibold px-2 py-0.5 rounded-full bg-sky-100 border border-slate-700 text-gray-500">
                          {total} 
                        </span>
                      </button>

                      {isExpanded && (
                        <ul className="divide-y divide-ky-800">
                          {items.map((c) => {
                            const isActive = c.id === selectedId;
                            return (
                              <li
                                key={c.id}
                                className={`px-4 py-3 text-xm cursor-pointer transition-colors flex flex-col gap-1 ${
                                  isActive
                                    ? "bg-sky-100 border-l border-emerald-400"
                                    : "hover:bg-sky-50"
                                }`}
                                onClick={() => handleSelectControl(c.id)}
                              >
                                <div className="flex items-left gap-2">
                                  <span className="font-mono text-xm text-blusGray-500">
                                    {c.id}
                                  </span>
                                  <div className="flex items-left gap-1">
                                    {c.tomId && (
                                      <span className="text-xm px-2 py-0.5 rounded-full bg-slate-800 text-blueGray-500">
                                        TOM: {c.tomId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xm text-blueGray-500 line-clamp-2">
                                  {c.title}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {c.dsgvoArticles.map((a) => (
                                    <span
                                      key={a}
                                      className="text-xs px-1.5 py-0.5 rounded-full bg-sky-800 text-white"
                                    >
                                      Art. {a} DSGVO
                                    </span>
                                  ))}
                                  {c.dpGoals.map((g) => (
                                    <span
                                      key={g}
                                      className="text-xs px-1.5 py-0.5 rounded-full bg-green-800 text-white"
                                    >
                                      Ziel: {g}
                                    </span>
                                  ))}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>




        </section>

        {/* Rechte Spalte: Detail + Editor */}
        {/*<section className="hidden md:flex md:flex-1 flex-col">*/}
        <section className="hidden md:flex flex-1 flex-col border border-privacy-border rounded-2xl bg-white">
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-auto">
            <div className="rounded-2xl border border-slate-800 bg-sky-50 p-4 flex flex-col gap-3 min-h-[200px]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-xl text-gray-500">
                  Control-Details &amp; Editor
                </h2>
                {detailLoading && (
                  <span className="text-xm text-blueGray-400">lädt …</span>
                )}
              </div>

              {!selectedId && (
                <p className="text-xm text-gray-100">
                  Bitte ein Privacy-Control in der Liste links auswählen.
                </p>
              )}

              {detailError && (
                <p className="text-xm text-red-400">{detailError}</p>
              )}

              {originalDetail && editedDetail && (
                <div className="flex flex-col gap-3 text-xm">
                  <div className="rounded-xl border border-slate-800 bg-gray-50 px-3 py-2 flex flex-col gap-1">
                    <div className="font-mono text-xl text-blueGray-500">
                      {originalDetail.id}
                    </div>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-xl bg-gray-200 border border-slate-700 px-2 py-1.5 text-xm text-gray-800 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                      placeholder="Titel des Privacy-Controls"
                      value={editedDetail.title}
                      onChange={(e) =>
                        setEditedDetail({
                          ...editedDetail,
                          title: e.target.value,
                        })
                      }
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {editedDetail.dsgvoArticles.map((a) => (
                        <span
                          key={a}
                          className="text-xs px-1.5 py-0.5 rounded-full bg-sky-800 text-white"
                        >
                          Art. {a} DSGVO
                        </span>
                      ))}
                      {editedDetail.dpGoals.map((g) => (
                        <span
                          key={g}
                          className="text-xs px-1.5 py-0.5 rounded-full bg-grenn-800 text-white"
                        >
                          Ziel: {g}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-gray-50 px-3 py-2 flex flex-col gap-2">
                    <div className="text-xm font-semibold text-sky-800">
                      Normative Aussage / Statement
                    </div>
                    <textarea
                      className="w-full rounded-xl bg-gray-100 border border-slate-700 px-2 py-1.5 text-xm text-gray-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[80px]"
                      placeholder="Was muss aus DSGVO-Sicht umgesetzt werden?"
                      value={editedDetail.statement ?? ""}
                      onChange={(e) =>
                        setEditedDetail({
                          ...editedDetail,
                          statement: e.target.value || null,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {([1, 3, 5] as const).map((level) => {
                      const value =
                        level === 1
                          ? editedDetail.maturityLevel1 ?? ""
                          : level === 3
                          ? editedDetail.maturityLevel3 ?? ""
                          : editedDetail.maturityLevel5 ?? "";
                      return (
                        <div
                          key={level}
                          className="rounded-xl border border-slate-800 bg-gray-50 px-3 py-2 flex flex-col gap-1"
                        >
                          <div className="text-xm font-semibold text-sky-800">
                            Maturity Level {level}
                          </div>
                          <textarea
                            className="w-full rounded-xl bg-gray-100 border border-slate-700 px-2 py-1.5 text-xm text-gray-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[60px]"
                            placeholder={`Kurzbeschreibung, was Level ${level} fachlich bedeutet`}
                            value={value}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              setEditedDetail({
                                ...editedDetail,
                                ...(level === 1
                                  ? { maturityLevel1: val }
                                  : level === 3
                                  ? { maturityLevel3: val }
                                  : { maturityLevel5: val }),
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-gray-50 px-3 py-2 flex flex-col gap-1">
                      <div className="text-xm font-semibold text-sky-800 ">
                        Typical Measures
                      </div>
                      <p className="text-xs text-slate-500">
                        Ein Eintrag pro Zeile, z.B. „RBAC für Rollen X/Y“,„mTLS
                        zwischen Komponenten A/B“.
                      </p>
                      <textarea
                        className="w-full rounded-xl bg-gray-100 border border-slate-700 px-2 py-1.5 text-xm text-gray-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[80px]"
                        value={joinList(editedDetail.typicalMeasures)}
                        onChange={(e) =>
                          setEditedDetail({
                            ...editedDetail,
                            typicalMeasures: normalizeList(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-gray-50 px-3 py-2 flex flex-col gap-1">
                      <div className="text-xm font-semibold text-sky-800">
                        Assessment Questions
                      </div>
                      <p className="text-xs text-slate-500">
                        Ein Eintrag pro Zeile, z.B. „Sind alle Zugriffe
                        protokolliert und werden regelmäßig ausgewertet?“.
                      </p>
                      <textarea
                        className="w-full rounded-xl bg-gray-100 border border-slate-700 px-2 py-1.5 text-xm text-gray-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[80px]"
                        value={joinList(editedDetail.assessmentQuestions)}
                        onChange={(e) =>
                          setEditedDetail({
                            ...editedDetail,
                            assessmentQuestions: normalizeList(
                              e.target.value,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-gray-50 px-3 py-2 flex flex-col gap-1">
                    <div className="text-xm font-semibold text-sky-800">
                      Risk-Hinweis
                    </div>
                    <p className="text-xs text-gray-500">
                      Kurzbeschreibung der Risikorelevanz (z.B. Impact-Spanne,
                      DSFA-Relevanz, Verweis auf SDM-TOM-Controls).
                    </p>
                    <textarea
                      className="w-full rounded-xl bg-gray-100 border border-slate-700 px-2 py-1.5 text-xm text-gray-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 min-h-[60px]"
                      value={editedDetail.riskHint ?? ""}
                      onChange={(e) =>
                        setEditedDetail({
                          ...editedDetail,
                          riskHint: e.target.value || null,
                        })
                      }
                    />
                  </div>

                  {(saveError || saveMessage) && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs">
                      {saveError && (
                        <p className="text-red-400">{saveError}</p>
                      )}
                      {saveMessage && (
                        <p className="text-emerald-400 mt-0.5">
                          {saveMessage}
                        </p>
                      )}
                    </div>
                  )}

                  {diffOpen && (
                    <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xm font-medium text-slate-200">
                          Änderungen an diesem Privacy-Control
                        </div>
                        <button
                          type="button"
                          onClick={() => setDiffOpen(false)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          schließen
                        </button>
                      </div>

                      {diffLoading && (
                        <div className="text-xm text-gray-500">
                          Diff wird berechnet …
                        </div>
                      )}

                      {diffError && (
                        <div className="text-xm text-red-400">
                          {diffError}
                        </div>
                      )}

                      {!diffLoading &&
                        !diffError &&
                        diffSummary &&
                        !diffSummary.hasChanges && (
                          <div className="text-xm text-slate-500">
                            Es wurden keine Unterschiede zur geladenen Version
                            dieses Controls gefunden.
                          </div>
                        )}

                      {!diffLoading &&
                        !diffError &&
                        diffSummary &&
                        diffSummary.hasChanges && (
                          <div className="flex flex-col gap-2 text-xm text-slate-200">
                            {diffSummary.changedFields.length > 0 && (
                              <div className="flex flex-col gap-1">
                                {diffSummary.changedFields.map((c) => (
                                  <div
                                    key={c.field}
                                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                                  >
                                    <div className="font-medium text-slate-100 mb-0.5">
                                      {c.label}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Vorher:{" "}
                                      <span className="text-slate-500">
                                        {c.before ?? "—"}
                                      </span>
                                    </div>
                                    <div className="text-xs text-emerald-200 mt-0.5">
                                      Jetzt:{" "}
                                      <span>{c.after ?? "—"}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {diffSummary.measuresDiff && (
                              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5">
                                <div className="font-medium text-slate-100 mb-0.5">
                                  Typical Measures
                                </div>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                  {diffSummary.measuresDiff.added.length >
                                    0 && (
                                    <li>
                                      Hinzugefügt:{" "}
                                      <span className="text-emerald-300">
                                        {diffSummary.measuresDiff.added.join(
                                          "; ",
                                        )}
                                      </span>
                                    </li>
                                  )}
                                  {diffSummary.measuresDiff.removed.length >
                                    0 && (
                                    <li>
                                      Entfernt:{" "}
                                      <span className="text-red-300">
                                        {diffSummary.measuresDiff.removed.join(
                                          "; ",
                                        )}
                                      </span>
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}

                            {diffSummary.questionsDiff && (
                              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5">
                                <div className="font-medium text-slate-100 mb-0.5">
                                  Assessment Questions
                                </div>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                  {diffSummary.questionsDiff.added.length >
                                    0 && (
                                    <li>
                                      Hinzugefügt:{" "}
                                      <span className="text-emerald-300">
                                        {diffSummary.questionsDiff.added.join(
                                          "; ",
                                        )}
                                      </span>
                                    </li>
                                  )}
                                  {diffSummary.questionsDiff.removed.length >
                                    0 && (
                                    <li>
                                      Entfernt:{" "}
                                      <span className="text-red-300">
                                        {diffSummary.questionsDiff.removed.join(
                                          "; ",
                                        )}
                                      </span>
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-1 gap-3">
                    <p className="text-xs text-slate-500 max-w-md">
                      Dieses Formular beschreibt das Datenschutz-Kompendium:
                      normative Aussage, typische Maßnahmen, Reifegrade und
                      Prüffragen. Über{" "}
                      <span className="text-slate-200 font-medium">
                        „Diff anzeigen“
                      </span>{" "}
                      können Sie Ihre Änderungen im Vergleich zur gespeicherten
                      Version prüfen, bevor Sie sie speichern.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={showDiff}
                        disabled={!editedDetail || diffLoading}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-ky-800 px-3 py-1.5 text-xm text-yellow-500 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {diffLoading ? "Diff …" : "Diff anzeigen"}
                      </button>
                      <button
                        type="button"
                        onClick={saveControl}
                        disabled={saveLoading}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-green-800 px-3 py-1.5 text-xm font-medium shadow-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saveLoading ? "Speichern …" : "Control speichern"}
                      </button>
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-slate-500 text-right">
                    Technischer Hinweis: Die Änderungen werden in der Datei{" "}
                    <code className="text-slate-300">
                      open_privacy_catalog_risk.json
                    </code>{" "}
                    gespeichert und sollten im Git-Repository versioniert
                    werden.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Mobile Hinweis */}
        <section className="md:hidden p-4 text-xs text-slate-400 border-t border-slate-800 bg-slate-950/80">
          Die Detail- und Editieransicht ist auf größeren Bildschirmen
          (Tablet/Desktop) verfügbar.
        </section>

        </div>
      </main>
    </div>
  );
};

export default PrivacyCatalogPage;
