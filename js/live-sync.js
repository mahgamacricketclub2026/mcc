export const clone = (value) => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

export function clean(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(item => item !== undefined);
  }
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val === undefined) return;
      const next = clean(val);
      if (next !== undefined) out[key] = next;
    });
    return out;
  }
  return value;
}

export function overText(balls = 0) {
  const total = Math.max(0, Number(balls || 0));
  return `${Math.floor(total / 6)}.${total % 6}`;
}

export function calcSR(runs = 0, balls = 0) {
  const b = Number(balls || 0);
  if (!b) return "0.00";
  return ((Number(runs || 0) * 100) / b).toFixed(2);
}

export function calcER(runs = 0, balls = 0) {
  const b = Number(balls || 0);
  if (!b) return "0.00";
  return ((Number(runs || 0) * 6) / b).toFixed(2);
}

export function normalizeBatter(row = {}) {
  return {
    playerId: row.playerId || row.id || "",
    name: row.name || "-",
    position: Number(row.position || 0),
    r: Number(row.r ?? row.runs ?? 0),
    b: Number(row.b ?? row.balls ?? 0),
    f: Number(row.f ?? row.fours ?? 0),
    s: Number(row.s ?? row.sixes ?? 0),
    dots: Number(row.dots ?? row.d ?? 0),
    out: !!row.out,
    retired: !!row.retired,
    dismissal: row.dismissal || ""
  };
}

function normalizeBowler(row = {}) {
  return {
    name: row.name || row.playerName || "-",
    playerId: row.playerId || row.id || "",
    balls: Number(row.balls || 0),
    r: Number(row.r ?? row.runs ?? 0),
    w: Number(row.w ?? row.wkts ?? 0),
    runs: Number(row.runs ?? row.r ?? 0),
    wkts: Number(row.wkts ?? row.w ?? 0),
    dots: Number(row.dots || 0),
    wides: Number(row.wides || 0),
    noBalls: Number(row.noBalls || 0)
  };
}

export function normalizeState(input = {}) {
  const s = { ...input };
  s.matchId = s.matchId || "";
  s.matchTitle = s.matchTitle || "No Match";
  s.matchType = s.matchType || "T20";
  s.status = s.status || "idle";
  s.liveControl = s.liveControl || { mode: "live", note: "Live" };
  s.inningNumber = Number(s.inningNumber || 1);
  s.totalOvers = Number(s.totalOvers || 20);
  s.powerplayOvers = Number.isFinite(Number(s.powerplayOvers)) ? Number(s.powerplayOvers) : 4;
  s.runs = Number(s.runs || 0);
  s.wkts = Number(s.wkts || 0);
  s.balls = Number(s.balls || 0);
  s.extras = Number(s.extras || 0);
  s.target = s.target == null || s.target === "" ? null : Number(s.target || 0);
  s.striker = Number(s.striker || 1);
  s.bat1 = normalizeBatter(s.bat1 || { name: "-" });
  s.bat2 = normalizeBatter(s.bat2 || { name: "-" });
  s.bowler = normalizeBowler(s.bowler || {});
  s.bowlerStats = s.bowlerStats || {};
  s.battingScorecard = Array.isArray(s.battingScorecard) ? s.battingScorecard.map(normalizeBatter) : [];
  s.completedInnings = s.completedInnings || {};
  s.completedBowling = s.completedBowling || {};
  s.inningsDetails = s.inningsDetails || {};
  s.commentary = Array.isArray(s.commentary) ? s.commentary : [];
  s.over = Array.isArray(s.over) ? s.over : [];
  s.overSummary = Array.isArray(s.overSummary) ? s.overSummary : [];
  s.recentBalls = Array.isArray(s.recentBalls) ? s.recentBalls : [];
  s.fallOfWickets = Array.isArray(s.fallOfWickets) ? s.fallOfWickets : [];
  s.highlights = Array.isArray(s.highlights) ? s.highlights : [];
  s.dismissed = Array.isArray(s.dismissed) ? s.dismissed : [];
  s.retired = Array.isArray(s.retired) ? s.retired : [];
  s.undoStack = Array.isArray(s.undoStack) ? s.undoStack : [];
  s.partnershipRuns = Number(s.partnershipRuns || 0);
  s.partnershipBalls = Number(s.partnershipBalls || 0);
  s.lastWicket = s.lastWicket || "-";
  s.lastOverBowler = s.lastOverBowler || "";
  s.specialStreaks = {
    batterId: "",
    shot: "",
    shotCount: 0,
    bowlerId: "",
    wicketCount: 0,
    partnershipMark: 0,
    lastPressureKey: "",
    lastPhaseKey: "",
    bowlerHighlightKey: "",
    ...(s.specialStreaks || {})
  };
  s.teamInfo = s.teamInfo || {};
  s.teams = s.teams || {};
  s.pointsTable = s.pointsTable || {};
  s.freeHitActive = !!s.freeHitActive;
  s.liveStarted = !!s.liveStarted;
  s.matchFinished = !!s.matchFinished;
  s.scoringLocked = !!s.scoringLocked;
  s.commentaryMode = s.commentaryMode || "en";
  return s;
}

function persistenceState(state = {}, { live = false } = {}) {
  const out = clone(normalizeState(state));
  delete out.undoStack;
  if (live) {
    out.commentary = (out.commentary || []).slice(0, 80);
    out.recentBalls = (out.recentBalls || []).slice(0, 36);
    out.highlights = (out.highlights || []).slice(0, 40);
  }
  Object.values(out.inningsDetails || {}).forEach(inn => {
    if (!inn || typeof inn !== "object") return;
    delete inn.undoStack;
    if (live) {
      inn.commentary = (inn.commentary || []).slice(0, 80);
      inn.overSummary = (inn.overSummary || []).slice(0, 60);
    }
  });
  return out;
}

export function livePayload(state = {}, matchId = "", uid = "") {
  const s = persistenceState(state, { live: true });
  return clean({
    ...s,
    matchId: matchId || s.matchId,
    updatedBy: uid || s.updatedBy || "",
    scoreText: `${s.runs}/${s.wkts} (${overText(s.balls)})`,
    currentRunRate: s.balls ? ((s.runs * 6) / s.balls).toFixed(2) : "0.00",
    freeHitActive: !!s.freeHitActive,
    powerplayOvers: s.powerplayOvers
  });
}

export function storePayload(state = {}, matchId = "", uid = "") {
  const s = persistenceState(state);
  return clean({
    ...s,
    matchId: matchId || s.matchId,
    updatedBy: uid || s.updatedBy || "",
    savedAtLocal: new Date().toISOString()
  });
}

export function mergeMatch(live = null, store = null, fallback = {}) {
  const base = normalizeState(fallback || {});
  const stored = store ? normalizeState(store) : {};
  const liveState = live ? normalizeState(live) : {};
  return normalizeState({ ...base, ...stored, ...liveState });
}
