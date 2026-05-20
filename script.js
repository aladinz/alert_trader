const STORAGE_KEY = "alerttrader.v1";
const SCAN_INTERVAL_SECONDS = 300;

const state = {
  symbol: "SPY",
  price: 567.42,
  prevClose: 566.18,
  atr: 2.18,
  trend: "BULLISH",
  history: [],
  watchlistResults: [],
  logs: [],
  nextScanIn: SCAN_INTERVAL_SECONDS,
  signal: {
    side: "SHORT",
    entry: 567.42,
    stop: 570.69,
    target: 560.88,
    shares: 305,
    risk: 1000,
    reward: 2000,
    rr: 2
  },
  settings: {
    primaryTf: "1H",
    htfFilter: "4H",
    emaFast: 20,
    emaSlow: 50,
    atrPeriod: 14,
    atrMult: 1.5,
    rrTarget: 2,
    accountSize: 100000,
    riskPct: 1,
    desktopPopup: true,
    audioAlert: true,
    emailAlert: false,
    email: "",
    feedProvider: "finnhub",
    apiKey: "",
    autoConnectFeed: false,
    watchlistText: "SPY, QQQ, IWM, AAPL, MSFT, AMZN, NVDA, TSLA",
    minAlertScore: 65,
    duplicateThrottleSec: 90,
    alertCooldownSec: 120,
    sessionMode: "auto",
    autoSessionPresets: true,
    maxPositionSize: 500,
    maxDailyLoss: 2500,
    currentDayPnl: 0,
    maxAtrPct: 3.5,
    maxSpreadPct: 0.35,
    minRrGuardrail: 1.8
  },
  feed: {
    connected: false,
    mode: "simulated",
    lastSource: "sim"
  },
  guardrails: {
    blocked: false,
    reasons: [],
    checks: []
  },
  session: {
    detected: "regular",
    active: "regular",
    riskMultiplier: 1,
    scoreAdjustment: 0,
    cooldownMultiplier: 1,
    alertsEnabled: true
  },
  alerting: {
    lastAnyAt: 0,
    byKey: {}
  }
};

let feedSocket = null;
let reconnectTimer = null;
let quotePollTimer = null;
let persistTimer = null;
let wantFeedConnection = false;
let lastConnectedSymbol = "";
let lastFeedLogAt = 0;
let feedAuthFailed = false;
let wsDisconnectStreak = 0;
let wsDisconnectWindowStart = 0;
let symbolInputDebounceTimer = null;
let lastQuotedSymbol = "";
let quoteRequestSeq = 0;

const refs = {
  clock: document.getElementById("clock"),
  scanMeta: document.getElementById("scanMeta"),
  priceCardLabel: document.getElementById("priceCardLabel"),
  spyPrice: document.getElementById("spyPrice"),
  spyDelta: document.getElementById("spyDelta"),
  htfTrend: document.getElementById("htfTrend"),
  trendDetail: document.getElementById("trendDetail"),
  atrValue: document.getElementById("atrValue"),
  stopHint: document.getElementById("stopHint"),
  signalCount: document.getElementById("signalCount"),
  signalBreakdown: document.getElementById("signalBreakdown"),
  setupScoreValue: document.getElementById("setupScoreValue"),
  setupScoreGrade: document.getElementById("setupScoreGrade"),
  setupScoreBias: document.getElementById("setupScoreBias"),
  setupScoreFactors: document.getElementById("setupScoreFactors"),
  setupScoreStamp: document.getElementById("setupScoreStamp"),
  guardrailSummary: document.getElementById("guardrailSummary"),
  guardrailList: document.getElementById("guardrailList"),
  signalSideBadge: document.getElementById("signalSideBadge"),
  latestSymbol: document.getElementById("latestSymbol"),
  entryPrice: document.getElementById("entryPrice"),
  stopLoss: document.getElementById("stopLoss"),
  targetPrice: document.getElementById("targetPrice"),
  shares: document.getElementById("shares"),
  riskDollars: document.getElementById("riskDollars"),
  rewardDollars: document.getElementById("rewardDollars"),
  rrDisplay: document.getElementById("rrDisplay"),
  atpSteps: document.getElementById("atpSteps"),
  ema20Display: document.getElementById("ema20Display"),
  ema20State: document.getElementById("ema20State"),
  ema50Display: document.getElementById("ema50Display"),
  ema50State: document.getElementById("ema50State"),
  atrIndicator: document.getElementById("atrIndicator"),
  atrState: document.getElementById("atrState"),
  pullbackStatus: document.getElementById("pullbackStatus"),
  pullbackDetail: document.getElementById("pullbackDetail"),
  filterStatus: document.getElementById("filterStatus"),
  filterDetail: document.getElementById("filterDetail"),
  qualityLabel: document.getElementById("qualityLabel"),
  qualityDetail: document.getElementById("qualityDetail"),
  historyList: document.getElementById("historyList"),
  systemLog: document.getElementById("systemLog"),
  scanNowBtn: document.getElementById("scanNowBtn"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  copyOrderBtn: document.getElementById("copyOrderBtn"),
  themeToggle: document.getElementById("themeToggle"),
  desktopPopup: document.getElementById("desktopPopup"),
  audioAlert: document.getElementById("audioAlert"),
  emailAlert: document.getElementById("emailAlert"),
  emailInput: document.getElementById("emailInput"),
  primaryTf: document.getElementById("primaryTf"),
  htfFilter: document.getElementById("htfFilter"),
  emaFast: document.getElementById("emaFast"),
  emaSlow: document.getElementById("emaSlow"),
  atrPeriod: document.getElementById("atrPeriod"),
  atrMult: document.getElementById("atrMult"),
  rrTarget: document.getElementById("rrTarget"),
  accountSize: document.getElementById("accountSize"),
  riskPct: document.getElementById("riskPct"),
  minAlertScore: document.getElementById("minAlertScore"),
  duplicateThrottleSec: document.getElementById("duplicateThrottleSec"),
  alertCooldownSec: document.getElementById("alertCooldownSec"),
  sessionMode: document.getElementById("sessionMode"),
  autoSessionPresets: document.getElementById("autoSessionPresets"),
  sessionStatus: document.getElementById("sessionStatus"),
  maxPositionSize: document.getElementById("maxPositionSize"),
  maxDailyLoss: document.getElementById("maxDailyLoss"),
  currentDayPnl: document.getElementById("currentDayPnl"),
  maxAtrPct: document.getElementById("maxAtrPct"),
  maxSpreadPct: document.getElementById("maxSpreadPct"),
  minRrGuardrail: document.getElementById("minRrGuardrail"),
  symbol: document.getElementById("symbol"),
  feedProvider: document.getElementById("feedProvider"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  watchlistInput: document.getElementById("watchlistInput"),
  scanWatchlistBtn: document.getElementById("scanWatchlistBtn"),
  watchlistResults: document.getElementById("watchlistResults"),
  watchlistMeta: document.getElementById("watchlistMeta"),
  connectFeedBtn: document.getElementById("connectFeedBtn"),
  quoteNowBtn: document.getElementById("quoteNowBtn"),
  feedStatus: document.getElementById("feedStatus")
};

const inputIds = [
  "symbol",
  "primaryTf",
  "htfFilter",
  "emaFast",
  "emaSlow",
  "atrPeriod",
  "atrMult",
  "rrTarget",
  "accountSize",
  "riskPct",
  "minAlertScore",
  "duplicateThrottleSec",
  "alertCooldownSec",
  "sessionMode",
  "maxPositionSize",
  "maxDailyLoss",
  "currentDayPnl",
  "maxAtrPct",
  "maxSpreadPct",
  "minRrGuardrail",
  "feedProvider",
  "apiKeyInput",
  "emailInput"
];

function fMoney(value) {
  return `$${value.toFixed(2)}`;
}

function fInt(value) {
  return value.toLocaleString("en-US");
}

function nowClock() {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function timeTag() {
  const d = new Date();
  return `${d.toTimeString().slice(0, 8)}`;
}

function sessionTag() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistState();
  }, 220);
}

function sanitizeData(data) {
  return {
    symbol: typeof data.symbol === "string" ? data.symbol : "SPY",
    price: Number.isFinite(Number(data.price)) ? Number(data.price) : 567.42,
    prevClose: Number.isFinite(Number(data.prevClose)) ? Number(data.prevClose) : 566.18,
    atr: Number.isFinite(Number(data.atr)) ? Number(data.atr) : 2.18,
    trend: data.trend === "BEARISH" ? "BEARISH" : "BULLISH",
    history: Array.isArray(data.history) ? data.history.slice(0, 30) : [],
    watchlistResults: Array.isArray(data.watchlistResults) ? data.watchlistResults.slice(0, 30) : [],
    logs: Array.isArray(data.logs) ? data.logs.slice(-80) : [],
    nextScanIn: Number.isFinite(Number(data.nextScanIn)) ? Number(data.nextScanIn) : SCAN_INTERVAL_SECONDS,
    signal: data.signal && typeof data.signal === "object" ? data.signal : state.signal,
    settings: data.settings && typeof data.settings === "object" ? data.settings : state.settings,
    feed: data.feed && typeof data.feed === "object" ? data.feed : state.feed
  };
}

function applyData(data) {
  const clean = sanitizeData(data);
  state.symbol = clean.symbol;
  state.price = clean.price;
  state.prevClose = clean.prevClose;
  state.atr = clean.atr;
  state.trend = clean.trend;
  state.history = clean.history;
  state.watchlistResults = clean.watchlistResults;
  state.logs = clean.logs;
  state.nextScanIn = clean.nextScanIn;
  state.signal = {
    ...state.signal,
    ...clean.signal
  };
  state.settings = {
    ...state.settings,
    ...clean.settings
  };
  state.feed = {
    ...state.feed,
    ...clean.feed,
    connected: false,
    mode: "simulated"
  };
}

async function loadSeedDataset() {
  try {
    const res = await fetch("./dataset.json", { cache: "no-store" });
    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (_error) {
    return null;
  }
}

function loadPersistedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function persistState() {
  const payload = {
    symbol: state.symbol,
    price: state.price,
    prevClose: state.prevClose,
    atr: state.atr,
    trend: state.trend,
    history: state.history.slice(0, 30),
    watchlistResults: state.watchlistResults.slice(0, 30),
    logs: state.logs.slice(-80),
    nextScanIn: state.nextScanIn,
    signal: state.signal,
    settings: state.settings,
    feed: {
      ...state.feed,
      connected: false,
      mode: state.feed.connected ? "api+websocket" : "simulated"
    }
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function syncStateFromInputs() {
  state.symbol = refs.symbol.value.trim().toUpperCase() || "SPY";
  state.settings.primaryTf = refs.primaryTf.value;
  state.settings.htfFilter = refs.htfFilter.value;
  state.settings.emaFast = Number(refs.emaFast.value) || 20;
  state.settings.emaSlow = Number(refs.emaSlow.value) || 50;
  state.settings.atrPeriod = Number(refs.atrPeriod.value) || 14;
  state.settings.atrMult = Number(refs.atrMult.value) || 1.5;
  state.settings.rrTarget = Number(refs.rrTarget.value) || 2;
  state.settings.accountSize = Number(refs.accountSize.value) || 100000;
  state.settings.riskPct = Number(refs.riskPct.value) || 1;
  state.settings.minAlertScore = Number(refs.minAlertScore.value) || 65;
  state.settings.duplicateThrottleSec = Number(refs.duplicateThrottleSec.value) || 90;
  state.settings.alertCooldownSec = Number(refs.alertCooldownSec.value) || 120;
  state.settings.sessionMode = refs.sessionMode.value || "auto";
  state.settings.autoSessionPresets = refs.autoSessionPresets.checked;
  state.settings.maxPositionSize = Number(refs.maxPositionSize.value) || 500;
  state.settings.maxDailyLoss = Number(refs.maxDailyLoss.value) || 2500;
  state.settings.currentDayPnl = Number(refs.currentDayPnl.value) || 0;
  state.settings.maxAtrPct = Number(refs.maxAtrPct.value) || 3.5;
  state.settings.maxSpreadPct = Number(refs.maxSpreadPct.value) || 0.35;
  state.settings.minRrGuardrail = Number(refs.minRrGuardrail.value) || 1.8;
  state.settings.desktopPopup = refs.desktopPopup.checked;
  state.settings.audioAlert = refs.audioAlert.checked;
  state.settings.emailAlert = refs.emailAlert.checked;
  state.settings.email = refs.emailInput.value.trim();
  state.settings.feedProvider = refs.feedProvider.value;
  state.settings.apiKey = refs.apiKeyInput.value.trim();
  state.settings.watchlistText = refs.watchlistInput.value;
}

function applyInputsFromState() {
  refs.symbol.value = state.symbol;
  refs.primaryTf.value = state.settings.primaryTf;
  refs.htfFilter.value = state.settings.htfFilter;
  refs.emaFast.value = String(state.settings.emaFast);
  refs.emaSlow.value = String(state.settings.emaSlow);
  refs.atrPeriod.value = String(state.settings.atrPeriod);
  refs.atrMult.value = String(state.settings.atrMult);
  refs.rrTarget.value = String(state.settings.rrTarget);
  refs.accountSize.value = String(state.settings.accountSize);
  refs.riskPct.value = String(state.settings.riskPct);
  refs.minAlertScore.value = String(state.settings.minAlertScore ?? 65);
  refs.duplicateThrottleSec.value = String(state.settings.duplicateThrottleSec ?? 90);
  refs.alertCooldownSec.value = String(state.settings.alertCooldownSec ?? 120);
  refs.sessionMode.value = state.settings.sessionMode || "auto";
  refs.autoSessionPresets.checked = Boolean(state.settings.autoSessionPresets ?? true);
  refs.maxPositionSize.value = String(state.settings.maxPositionSize ?? 500);
  refs.maxDailyLoss.value = String(state.settings.maxDailyLoss ?? 2500);
  refs.currentDayPnl.value = String(state.settings.currentDayPnl ?? 0);
  refs.maxAtrPct.value = String(state.settings.maxAtrPct ?? 3.5);
  refs.maxSpreadPct.value = String(state.settings.maxSpreadPct ?? 0.35);
  refs.minRrGuardrail.value = String(state.settings.minRrGuardrail ?? 1.8);
  refs.desktopPopup.checked = Boolean(state.settings.desktopPopup);
  refs.audioAlert.checked = Boolean(state.settings.audioAlert);
  refs.emailAlert.checked = Boolean(state.settings.emailAlert);
  refs.emailInput.value = state.settings.email || "";
  refs.feedProvider.value = state.settings.feedProvider || "finnhub";
  refs.apiKeyInput.value = state.settings.apiKey || "";
  refs.watchlistInput.value = state.settings.watchlistText || "SPY, QQQ, IWM, AAPL, MSFT, AMZN, NVDA, TSLA";
}

function normalizeSymbolInput() {
  const cleaned = refs.symbol.value.trim().toUpperCase().replace(/[^A-Z.\-]/g, "");
  refs.symbol.value = cleaned.slice(0, 12);
}

function symbolHash(symbol) {
  let hash = 0;
  for (const char of String(symbol || "SPY").toUpperCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function buildOfflineSnapshot(symbol) {
  const upper = String(symbol || "SPY").toUpperCase();
  const presets = {
    SPY: { price: 567.42, prevClose: 566.18, atr: 2.18, trend: "BULLISH" },
    QQQ: { price: 485.76, prevClose: 484.33, atr: 1.94, trend: "BULLISH" },
    IWM: { price: 201.34, prevClose: 200.61, atr: 1.42, trend: "BULLISH" },
    AAPL: { price: 212.44, prevClose: 211.08, atr: 1.88, trend: "BULLISH" },
    MSFT: { price: 452.18, prevClose: 450.92, atr: 2.11, trend: "BULLISH" },
    AMZN: { price: 186.73, prevClose: 185.94, atr: 1.75, trend: "BULLISH" },
    NVDA: { price: 123.84, prevClose: 122.9, atr: 3.94, trend: "BULLISH" },
    TSLA: { price: 176.52, prevClose: 178.08, atr: 5.26, trend: "BEARISH" },
    META: { price: 515.62, prevClose: 513.97, atr: 3.06, trend: "BULLISH" },
    FIS: { price: 43.06, prevClose: 42.81, atr: 0.72, trend: "BULLISH" }
  };

  if (presets[upper]) {
    return { ...presets[upper] };
  }

  const hash = symbolHash(upper);
  const price = Number((20 + (hash % 9000) / 10).toFixed(2));
  const drift = (((hash >> 8) % 21) - 10) / 1000;
  const prevClose = Number((price * (1 + drift)).toFixed(2));
  const atr = Number(
    Math.max(0.35, Math.min(price * 0.08, Math.abs(price - prevClose) * 0.8 + 0.75)).toFixed(2)
  );

  return {
    price,
    prevClose,
    atr,
    trend: price >= prevClose ? "BULLISH" : "BEARISH"
  };
}

function applyOfflineSnapshot(symbol) {
  const snapshot = buildOfflineSnapshot(symbol);
  state.price = snapshot.price;
  state.prevClose = snapshot.prevClose;
  state.atr = snapshot.atr;
  state.trend = snapshot.trend;
  state.feed.lastSource = "offline-symbol";
}

async function handleSymbolUpdate(reason) {
  const prevSymbol = state.symbol;
  normalizeSymbolInput();
  syncStateFromInputs();

  if (!state.symbol) {
    state.symbol = "SPY";
    refs.symbol.value = state.symbol;
  }

  const symbolChanged = prevSymbol !== state.symbol;
  const quoteIsStaleForSymbol = lastQuotedSymbol !== state.symbol;
  if (!symbolChanged && !quoteIsStaleForSymbol && reason !== "enter") {
    return;
  }

  if (symbolChanged) {
    logLine(`Symbol switched to ${state.symbol}`);
    if (state.feed.connected && state.feed.mode === "api+websocket") {
      subscribeSymbol(state.symbol);
    }
  }

  // Keep values coherent immediately while quote request is in flight.
  recalcSignalFromCurrentPrice();
  paint();
  schedulePersist();

  if (!state.settings.apiKey) {
    applyOfflineSnapshot(state.symbol);
    lastQuotedSymbol = state.symbol;
    recalcSignalFromCurrentPrice();
    paint();
    schedulePersist();
    setFeedStatus(`Offline sample loaded for ${state.symbol} - enter API key for live data`, "disconnected");
    return;
  }

  setFeedStatus(`Fetching quote for ${state.symbol}...`, "connecting");
  const quoteResult = await fetchFinnhubQuote(false);
  if (quoteResult.authError) {
    handleFeedAuthFailure(quoteResult.message || "Invalid API token");
    return;
  }

  if (!quoteResult.ok) {
    setFeedStatus(`Quote unavailable for ${state.symbol}`, "error");
    logLine(`Quote refresh failed for ${state.symbol}`);
    return;
  }

  lastQuotedSymbol = state.symbol;

  recalcSignalFromCurrentPrice();
  paint();
  schedulePersist();
}

function setFeedStatus(label, className) {
  refs.feedStatus.textContent = label;
  refs.feedStatus.className = `feed-status ${className}`;
}

function refreshFeedUi() {
  if (state.feed.connected) {
    refs.connectFeedBtn.textContent = "Disconnect";
    if (state.feed.mode === "api-only") {
      setFeedStatus("Connected (REST polling fallback)", "connected");
    } else {
      setFeedStatus("Connected (live API + websocket)", "connected");
    }
  } else {
    refs.connectFeedBtn.textContent = "Connect Feed";
    if (state.settings.apiKey) {
      setFeedStatus("Offline (ready to connect)", "disconnected");
    } else {
      setFeedStatus("Offline (simulated mode - enter API key for live data)", "disconnected");
    }
  }
}

function handleFeedAuthFailure(reason) {
  feedAuthFailed = true;
  wantFeedConnection = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (quotePollTimer) {
    clearInterval(quotePollTimer);
    quotePollTimer = null;
  }

  if (feedSocket) {
    feedSocket.close();
    feedSocket = null;
  }

  state.feed.connected = false;
  state.feed.mode = "simulated";
  setFeedStatus("Auth failed: invalid/expired API key", "error");
  logLine(`Feed authentication failed: ${reason}`);
  schedulePersist();
}

function activateRestFallback(reason) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (feedSocket) {
    feedSocket.close();
    feedSocket = null;
  }

  wantFeedConnection = false;
  state.feed.connected = true;
  state.feed.mode = "api-only";
  startQuotePolling();
  refreshFeedUi();
  logLine(`Websocket unstable - switched to REST polling (${reason})`);
  schedulePersist();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSessionClockParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return { hour, minute };
}

function detectSessionFromClock(parts) {
  const total = parts.hour * 60 + parts.minute;
  const preOpen = 4 * 60;
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;
  const afterClose = 20 * 60;

  if (total >= preOpen && total < regularOpen) {
    return "pre";
  }
  if (total >= regularOpen && total < regularClose) {
    return "regular";
  }
  if (total >= regularClose && total < afterClose) {
    return "after";
  }
  return "closed";
}

function resolveSessionPolicy() {
  const detected = detectSessionFromClock(getSessionClockParts());
  const active = state.settings.sessionMode === "auto" ? detected : state.settings.sessionMode;

  let policy = {
    riskMultiplier: 1,
    scoreAdjustment: 0,
    cooldownMultiplier: 1,
    alertsEnabled: true
  };

  if (state.settings.autoSessionPresets) {
    if (active === "pre") {
      policy = {
        riskMultiplier: 0.65,
        scoreAdjustment: 8,
        cooldownMultiplier: 1.4,
        alertsEnabled: true
      };
    } else if (active === "after") {
      policy = {
        riskMultiplier: 0.55,
        scoreAdjustment: 10,
        cooldownMultiplier: 1.5,
        alertsEnabled: true
      };
    } else if (active === "closed") {
      policy = {
        riskMultiplier: 0,
        scoreAdjustment: 100,
        cooldownMultiplier: 2,
        alertsEnabled: false
      };
    }
  }

  state.session = {
    detected,
    active,
    ...policy
  };

  return state.session;
}

function evaluateRiskGuardrails(candidate) {
  const checks = [];
  const reasons = [];

  const atrPct = (state.atr / Math.max(1, state.price)) * 100;
  const estimatedSpreadPct = clamp(atrPct * 0.11, 0.01, 2.5);
  const realizedLoss = Math.max(0, -state.settings.currentDayPnl);

  const pushCheck = (name, ok, value) => {
    checks.push({ name, ok, value });
    if (!ok) {
      reasons.push(name);
    }
  };

  pushCheck(
    "Position size",
    candidate.shares <= state.settings.maxPositionSize,
    `${candidate.shares}/${state.settings.maxPositionSize}`
  );

  pushCheck(
    "Daily loss",
    realizedLoss < state.settings.maxDailyLoss,
    `$${fInt(Math.round(realizedLoss))}/$${fInt(Math.round(state.settings.maxDailyLoss))}`
  );

  pushCheck(
    "ATR limit",
    atrPct <= state.settings.maxAtrPct,
    `${atrPct.toFixed(2)}%/${state.settings.maxAtrPct.toFixed(2)}%`
  );

  pushCheck(
    "Spread estimate",
    estimatedSpreadPct <= state.settings.maxSpreadPct,
    `${estimatedSpreadPct.toFixed(2)}%/${state.settings.maxSpreadPct.toFixed(2)}%`
  );

  pushCheck(
    "Min R:R",
    candidate.rr >= state.settings.minRrGuardrail,
    `${candidate.rr.toFixed(2)}/${state.settings.minRrGuardrail.toFixed(2)}`
  );

  if (state.session.active === "closed") {
    checks.push({ name: "Session open", ok: false, value: "Closed" });
    reasons.push("Session open");
  } else {
    checks.push({ name: "Session open", ok: true, value: state.session.active });
  }

  state.guardrails = {
    blocked: reasons.length > 0,
    reasons,
    checks
  };

  return state.guardrails;
}

function shouldDispatchAlert(signal, setupScore) {
  if (signal.blocked) {
    return { allowed: false, reason: "blocked by guardrails" };
  }

  if (!state.session.alertsEnabled) {
    return { allowed: false, reason: "session alerts disabled" };
  }

  const adjustedMinScore = clamp(
    state.settings.minAlertScore + state.session.scoreAdjustment,
    0,
    100
  );
  if (setupScore < adjustedMinScore) {
    return {
      allowed: false,
      reason: `score ${setupScore} below threshold ${adjustedMinScore}`
    };
  }

  const now = Date.now();
  const cooldownMs = Math.max(0, state.settings.alertCooldownSec * 1000 * state.session.cooldownMultiplier);
  if (state.alerting.lastAnyAt && now - state.alerting.lastAnyAt < cooldownMs) {
    return { allowed: false, reason: "cooldown active" };
  }

  const duplicateWindowMs = Math.max(0, state.settings.duplicateThrottleSec * 1000);
  const signature = `${state.symbol}|${signal.side}|${signal.entry.toFixed(2)}|${signal.stop.toFixed(2)}|${signal.target.toFixed(2)}`;
  const previous = state.alerting.byKey[signature] || 0;
  if (previous && now - previous < duplicateWindowMs) {
    return { allowed: false, reason: "duplicate throttled" };
  }

  state.alerting.lastAnyAt = now;
  state.alerting.byKey[signature] = now;
  return { allowed: true, reason: "ok" };
}

function gradeFromScore(score) {
  if (score >= 85) {
    return "A";
  }
  if (score >= 72) {
    return "B";
  }
  if (score >= 58) {
    return "C";
  }
  return "D";
}

function computeSetupAnalysis(snapshot) {
  const rrTarget = Number(refs.rrTarget.value) || 2;
  const price = snapshot.price;
  const prevClose = snapshot.prevClose;
  const atr = Math.max(0.2, snapshot.atr);
  const trend = snapshot.trend;

  const ema20 = price - (trend === "BULLISH" ? 1.62 : -1.62);
  const atrPct = (atr / Math.max(1, price)) * 100;
  const pullback = Math.abs(price - ema20) < atr;
  const volatilityScore = clamp(100 - Math.abs(atrPct - 2.1) * 26, 25, 100);
  const trendScore = trend === "BULLISH" ? 86 : 78;
  const rrScore = clamp((rrTarget / 2.4) * 100, 45, 100);
  const pullbackScore = pullback ? 92 : 56;
  const alignment = trend === "BULLISH" ? price >= prevClose : price <= prevClose;
  const alignmentScore = alignment ? 90 : 42;

  const score = Math.round(
    trendScore * 0.24 +
      pullbackScore * 0.22 +
      alignmentScore * 0.2 +
      rrScore * 0.2 +
      volatilityScore * 0.14
  );

  return {
    score,
    grade: gradeFromScore(score),
    bias: trend === "BULLISH" ? "Bullish bias" : "Bearish bias",
    factors: [
      {
        name: "Trend",
        score: Math.round(trendScore),
        tooltip: `Direction: ${trend}. Price ${fMoney(price)} vs prev close ${fMoney(prevClose)}.`
      },
      {
        name: "Pullback",
        score: Math.round(pullbackScore),
        tooltip: `Distance to EMA20 is ${Math.abs(price - ema20).toFixed(2)} vs ATR ${atr.toFixed(2)}.`
      },
      {
        name: "HTF Align",
        score: Math.round(alignmentScore),
        tooltip: `Alignment check is ${alignment ? "pass" : "fail"} using trend and close bias.`
      },
      {
        name: "R:R",
        score: Math.round(rrScore),
        tooltip: `Configured R:R is ${rrTarget.toFixed(2)} with guardrail min ${state.settings.minRrGuardrail.toFixed(2)}.`
      },
      {
        name: "Volatility",
        score: Math.round(volatilityScore),
        tooltip: `ATR percent of price is ${atrPct.toFixed(2)}%. Ideal zone is near 2.10%.`
      }
    ]
  };
}

function renderSetupScorePanel() {
  const analysis = computeSetupAnalysis({
    price: state.price,
    prevClose: state.prevClose,
    atr: state.atr,
    trend: state.trend
  });

  refs.setupScoreValue.textContent = `${analysis.score}/100`;
  refs.setupScoreValue.className = `setup-score-value ${analysis.score >= 72 ? "positive" : analysis.score >= 58 ? "warning" : "negative"}`;
  refs.setupScoreGrade.textContent = `Grade ${analysis.grade}`;
  refs.setupScoreGrade.className = `setup-score-grade ${analysis.score >= 72 ? "positive" : analysis.score >= 58 ? "warning" : "negative"}`;
  refs.setupScoreBias.textContent = analysis.bias;
  refs.setupScoreBias.className = `setup-score-bias ${state.trend === "BULLISH" ? "positive" : "negative"}`;
  refs.setupScoreStamp.textContent = `Updated ${timeTag()}`;

  refs.setupScoreFactors.innerHTML = "";
  analysis.factors.forEach((factor) => {
    const row = document.createElement("div");
    row.className = "factor-row";
    const tip = (factor.tooltip || `${factor.name}: ${factor.score}`).replace(/"/g, "&quot;");
    row.innerHTML = `
      <span class="name" title="${tip}">${factor.name}</span>
      <span class="bar" title="${tip}"><span class="fill" style="width:${factor.score}%"></span></span>
      <span class="score" title="${tip}">${factor.score}</span>
    `;
    refs.setupScoreFactors.appendChild(row);
  });
}

function renderGuardrailPanel() {
  const statusText = state.guardrails.blocked
    ? `Blocked (${state.guardrails.reasons.length})`
    : "Pass";
  refs.guardrailSummary.textContent = `Status: ${statusText}`;
  refs.guardrailSummary.className = `guardrail-summary ${state.guardrails.blocked ? "negative" : "positive"}`;

  refs.guardrailList.innerHTML = "";
  state.guardrails.checks.forEach((check) => {
    const row = document.createElement("div");
    row.className = `guardrail-row ${check.ok ? "pass" : "fail"}`;
    row.innerHTML = `
      <span class="name">${check.name}</span>
      <span class="value">${check.value}</span>
    `;
    refs.guardrailList.appendChild(row);
  });

  refs.sessionStatus.textContent = `Session: ${state.session.active} (detected ${state.session.detected}) | risk x${state.session.riskMultiplier.toFixed(2)} | +score ${state.session.scoreAdjustment}`;
}

function parseWatchlistSymbols(rawText) {
  const tokens = rawText
    .split(/[,\n\t ]+/)
    .map((s) => s.trim().toUpperCase().replace(/[^A-Z.\-]/g, ""))
    .filter(Boolean);

  return [...new Set(tokens)].slice(0, 20);
}

async function fetchFinnhubQuoteForSymbol(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Quote fetch failed (${res.status})`);
  }

  const quote = await res.json();
  if (!Number.isFinite(quote.c) || quote.c <= 0) {
    throw new Error("Invalid quote payload");
  }

  return quote;
}

function renderWatchlistResults() {
  refs.watchlistResults.innerHTML = "";

  if (!state.watchlistResults.length) {
    refs.watchlistResults.innerHTML = '<div class="watchlist-empty">No results yet. Run watchlist scan.</div>';
    return;
  }

  state.watchlistResults.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "watchlist-row";
    row.innerHTML = `
      <span class="score">#${index + 1}</span>
      <span class="symbol ${item.trend === "BULLISH" ? "positive" : "negative"}">${item.symbol}</span>
      <span>${item.bias} | Grade ${item.grade}</span>
      <span class="price">${fMoney(item.price)}</span>
      <span class="score ${item.score >= 72 ? "positive" : item.score >= 58 ? "warning" : "negative"}">${item.score}</span>
      <button class="load-btn" data-load-symbol="${item.symbol}">Load</button>
    `;
    refs.watchlistResults.appendChild(row);
  });
}

async function runWatchlistScan() {
  syncStateFromInputs();
  const symbols = parseWatchlistSymbols(refs.watchlistInput.value);
  if (!symbols.length) {
    refs.watchlistMeta.textContent = "No valid symbols in watchlist.";
    state.watchlistResults = [];
    renderWatchlistResults();
    return;
  }

  refs.scanWatchlistBtn.disabled = true;
  refs.scanWatchlistBtn.textContent = "Scanning...";

  const apiKey = state.settings.apiKey;
  const results = [];
  let successCount = 0;

  for (const symbol of symbols) {
    try {
      let price;
      let prevClose;
      let atr;
      if (apiKey) {
        const quote = await fetchFinnhubQuoteForSymbol(symbol, apiKey);
        price = Number(quote.c);
        prevClose = Number.isFinite(quote.pc) && quote.pc > 0 ? Number(quote.pc) : price;
        const dailyDelta = Number.isFinite(quote.d) ? Math.abs(Number(quote.d)) : Math.abs(price - prevClose);
        atr = clamp(dailyDelta * 0.8 + 1.2, 0.6, Math.max(2.2, price * 0.08));
      } else {
        const drift = (Math.random() - 0.5) * 14;
        price = clamp(state.price + drift, 12, 1200);
        prevClose = clamp(price - (Math.random() - 0.45) * 4, 10, 1200);
        atr = clamp(Math.abs(price - prevClose) * 0.7 + 1.0, 0.5, Math.max(2.0, price * 0.08));
      }

      const trend = price >= prevClose ? "BULLISH" : "BEARISH";
      const analysis = computeSetupAnalysis({
        price,
        prevClose,
        atr,
        trend
      });

      results.push({
        symbol,
        price,
        prevClose,
        atr,
        trend,
        score: analysis.score,
        grade: analysis.grade,
        bias: analysis.bias
      });
      successCount += 1;
    } catch (_error) {
      continue;
    }
  }

  state.watchlistResults = results.sort((a, b) => b.score - a.score).slice(0, 20);
  renderWatchlistResults();
  refs.watchlistMeta.textContent = `${successCount}/${symbols.length} symbols scanned at ${timeTag()}`;
  logLine(`Watchlist scan complete: ${successCount}/${symbols.length} symbols`);
  schedulePersist();

  refs.scanWatchlistBtn.disabled = false;
  refs.scanWatchlistBtn.textContent = "Scan Watchlist";
}

function updateTopCards() {
  refs.priceCardLabel.textContent = `${state.symbol} Price`;
  refs.spyPrice.textContent = fMoney(state.price);

  const delta = state.price - state.prevClose;
  const pct = (delta / state.prevClose) * 100;
  refs.spyDelta.textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
  refs.spyDelta.className = `card-sub ${delta >= 0 ? "positive" : "negative"}`;

  refs.htfTrend.textContent = state.trend;
  refs.htfTrend.className = `card-value ${state.trend === "BULLISH" ? "positive" : "negative"}`;
  refs.trendDetail.textContent = state.trend === "BULLISH" ? "Price above 50 EMA" : "Price below 50 EMA";

  refs.atrValue.textContent = fMoney(state.atr);
  refs.stopHint.textContent = `Stop approx ${fMoney(state.atr * (Number(refs.atrMult.value) || 1.5))}`;

  const longCount = state.history.filter((h) => h.side === "LONG").length;
  const shortCount = state.history.filter((h) => h.side === "SHORT").length;
  refs.signalCount.textContent = String(state.history.length);
  refs.signalBreakdown.textContent = `${longCount} Long - ${shortCount} Short`;
}

function updateLatestSignal() {
  const s = state.signal;
  if (s.blocked) {
    refs.signalSideBadge.textContent = "BLOCKED";
    refs.signalSideBadge.className = "badge short";
  } else {
    refs.signalSideBadge.textContent = s.side;
    refs.signalSideBadge.className = `badge ${s.side === "LONG" ? "long" : "short"}`;
  }

  refs.latestSymbol.textContent = state.symbol;
  refs.entryPrice.textContent = fMoney(s.entry);
  refs.stopLoss.textContent = fMoney(s.stop);
  refs.targetPrice.textContent = fMoney(s.target);

  refs.stopLoss.className = `metric-value ${s.side === "LONG" ? "negative" : "negative"}`;
  refs.targetPrice.className = `metric-value ${s.side === "LONG" ? "positive" : "positive"}`;

  refs.shares.textContent = fInt(s.shares);
  refs.riskDollars.textContent = `$${fInt(s.risk)}`;
  refs.rewardDollars.textContent = `$${fInt(s.reward)}`;
  refs.rrDisplay.textContent = `${s.rr.toFixed(2)}:1`;

  if (s.blocked) {
    let failingChecks = (state.guardrails.checks || []).filter((check) => !check.ok);
    if (!failingChecks.length) {
      const fallback = evaluateRiskGuardrails(buildSignalCandidate());
      failingChecks = (fallback.checks || []).filter((check) => !check.ok);
    }
    const details = failingChecks.length
      ? failingChecks.map((check) => `${check.name} ${check.value}`).join(" | ")
      : s.reasons.join(" | ");
    refs.atpSteps.textContent = `Order blocked: ${details}`;
  } else {
    refs.atpSteps.textContent = `ATP Steps: Symbol -> ${state.symbol} | Order Type -> Limit | Qty -> ${s.shares} | Limit Price -> ${s.entry.toFixed(2)} | Stop Loss bracket -> ${s.stop.toFixed(2)} | Profit target -> ${s.target.toFixed(2)} | Review and Submit`;
  }
}

function updateIndicators() {
  const emaFast = Number(refs.emaFast.value) || 20;
  const emaSlow = Number(refs.emaSlow.value) || 50;
  const ema20 = state.price - (state.trend === "BULLISH" ? 1.62 : -1.62);
  const ema50 = state.price - (state.trend === "BULLISH" ? 9.12 : -9.12);

  refs.ema20Display.textContent = fMoney(ema20);
  refs.ema50Display.textContent = fMoney(ema50);

  refs.ema20State.textContent = `Price ${state.price >= ema20 ? "above" : "below"} (${emaFast})`;
  refs.ema20State.className = `card-sub ${state.price >= ema20 ? "positive" : "negative"}`;

  refs.ema50State.textContent = `Trend ${state.trend.toLowerCase()} (${emaSlow})`;
  refs.ema50State.className = `card-sub ${state.trend === "BULLISH" ? "positive" : "negative"}`;

  refs.atrIndicator.textContent = fMoney(state.atr);
  refs.atrState.textContent = state.atr > 3 ? "High volatility" : "Normal volatility";

  const pullback = Math.abs(state.price - ema20) < state.atr;
  refs.pullbackStatus.textContent = pullback ? "YES" : "NO";
  refs.pullbackStatus.className = `metric-value ${pullback ? "positive" : "negative"}`;
  refs.pullbackDetail.textContent = pullback ? "Setup near EMA" : "Extended move";
  refs.pullbackDetail.className = `card-sub ${pullback ? "positive" : "negative"}`;

  const filterPass = state.trend === "BULLISH" ? state.price > ema50 : state.price < ema50;
  refs.filterStatus.textContent = filterPass ? "PASS" : "FAIL";
  refs.filterStatus.className = `metric-value ${filterPass ? "positive" : "negative"}`;
  refs.filterDetail.textContent = filterPass ? "HTF EMA aligned" : "HTF filter mismatch";
  refs.filterDetail.className = `card-sub ${filterPass ? "positive" : "negative"}`;

  const score = computeSetupAnalysis({
    price: state.price,
    prevClose: state.prevClose,
    atr: state.atr,
    trend: state.trend
  }).score;
  const quality = score >= 72 ? "HIGH" : score >= 58 ? "MEDIUM" : "LOW";
  refs.qualityLabel.textContent = quality;
  refs.qualityLabel.className = `metric-value ${quality === "LOW" ? "negative" : "warning"}`;
  refs.qualityDetail.textContent = `Score ${score}/100`;
}

function renderHistory() {
  refs.historyList.innerHTML = "";
  state.history.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const sideClass = item.side === "LONG" ? "long" : "short";

    row.innerHTML = `
      <span class="time">${item.time}</span>
      <span class="badge ${sideClass}">${item.side}</span>
      <span>${item.symbol || state.symbol} - ${item.title}</span>
      <span class="price ${item.side === "LONG" ? "positive" : "negative"}">${fMoney(item.price)}</span>
      <span class="status-pill ${item.status.toLowerCase()}">${item.status}</span>
    `;

    refs.historyList.appendChild(row);
  });
}

function renderLogs() {
  refs.systemLog.textContent = state.logs.join("\n");
  refs.systemLog.scrollTop = refs.systemLog.scrollHeight;
}

function logLine(message) {
  state.logs.push(`[${timeTag()}] ${message}`);
  if (state.logs.length > 60) {
    state.logs.shift();
  }
  renderLogs();
  schedulePersist();
}

function createSignalFromPrice() {
  const candidate = buildSignalCandidate();
  const guardrailState = evaluateRiskGuardrails(candidate);

  state.signal = {
    ...candidate,
    blocked: guardrailState.blocked,
    reasons: guardrailState.reasons
  };

  if (guardrailState.blocked) {
    logLine(`Signal blocked by guardrails: ${guardrailState.reasons.join(", ")}`);
    return;
  }

  state.history.unshift({
    time: sessionTag(),
    symbol: state.symbol,
    side: candidate.side,
    title: candidate.side === "LONG" ? "Pullback to EMA reclaim" : "Pullback exhaustion short",
    price: candidate.entry,
    status: "Pending"
  });

  if (state.history.length > 12) {
    state.history.pop();
  }

  logLine(
    `SIGNAL ${candidate.side} ${state.symbol} @ ${candidate.entry.toFixed(2)} | SL ${candidate.stop.toFixed(2)} | TP ${candidate.target.toFixed(2)} | Qty ${candidate.shares}`
  );
}

function recalcSignalFromCurrentPrice() {
  const candidate = buildSignalCandidate();
  const guardrailState = evaluateRiskGuardrails(candidate);

  state.signal = {
    ...candidate,
    blocked: guardrailState.blocked,
    reasons: guardrailState.reasons
  };
}

function buildSignalCandidate() {
  const session = resolveSessionPolicy();
  const rr = Number(refs.rrTarget.value) || 2;
  const baseRiskPct = (Number(refs.riskPct.value) || 1) / 100;
  const riskPct = baseRiskPct * session.riskMultiplier;
  const account = Number(refs.accountSize.value) || 100000;
  const stopMult = Number(refs.atrMult.value) || 1.5;

  const side = state.trend === "BULLISH" ? "LONG" : "SHORT";
  const riskPerShare = Math.max(0.2, state.atr * stopMult);
  const entry = state.price;
  const stop = side === "LONG" ? entry - riskPerShare : entry + riskPerShare;
  const target = side === "LONG" ? entry + riskPerShare * rr : entry - riskPerShare * rr;

  const riskDollars = Math.round(account * riskPct);
  const shares = Math.max(1, Math.floor(riskDollars / riskPerShare));
  const reward = Math.round(riskDollars * rr);

  return {
    side,
    entry,
    stop,
    target,
    shares,
    risk: riskDollars,
    reward,
    rr
  };
}

function applyMarketPrice(nextPrice, source, sourceSymbol = state.symbol) {
  if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
    return;
  }

  if (String(sourceSymbol).toUpperCase() !== String(state.symbol).toUpperCase()) {
    return;
  }

  const oldPrice = state.price;
  state.price = Number(nextPrice);

  const absMove = Math.abs(state.price - oldPrice);
  state.atr = Math.max(0.6, Math.min(6.5, state.atr * 0.9 + absMove * 1.2));
  state.trend = state.price >= state.prevClose ? "BULLISH" : "BEARISH";
  state.feed.lastSource = source;
  lastQuotedSymbol = state.symbol;
  recalcSignalFromCurrentPrice();

  const now = Date.now();
  if (now - lastFeedLogAt > 25000) {
    logLine(`${source} update: ${state.symbol} ${state.price.toFixed(2)}`);
    lastFeedLogAt = now;
  }

  paint();
  schedulePersist();
}

function disconnectFeed() {
  wantFeedConnection = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (quotePollTimer) {
    clearInterval(quotePollTimer);
    quotePollTimer = null;
  }

  if (feedSocket) {
    feedSocket.close();
    feedSocket = null;
  }

  state.feed.connected = false;
  state.feed.mode = "simulated";
  refreshFeedUi();
  schedulePersist();
}

async function fetchFinnhubQuote(logFetch) {
  const apiKey = refs.apiKeyInput.value.trim();
  if (!apiKey) {
    setFeedStatus("Missing API key", "error");
    return { ok: false, authError: false };
  }

  const requestedSymbol = String(state.symbol || "SPY").toUpperCase();
  const requestSeq = ++quoteRequestSeq;

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(requestedSymbol)}&token=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          authError: true,
          message: `Quote auth failed (${res.status})`
        };
      }

      throw new Error(`Quote fetch failed (${res.status})`);
    }

    const quote = await res.json();

    if (requestSeq !== quoteRequestSeq) {
      return { ok: true, authError: false, stale: true };
    }

    if (requestedSymbol !== String(state.symbol).toUpperCase()) {
      return { ok: true, authError: false, stale: true };
    }

    if (Number.isFinite(quote.pc) && quote.pc > 0) {
      state.prevClose = quote.pc;
    }

    if (!Number.isFinite(quote.c) || quote.c <= 0) {
      throw new Error("Invalid quote payload");
    }

    applyMarketPrice(quote.c, "API quote", requestedSymbol);

    if (logFetch) {
      logLine(`Quote refreshed via REST for ${requestedSymbol}`);
    }

    lastQuotedSymbol = requestedSymbol;
    return { ok: true, authError: false };
  } catch (error) {
    setFeedStatus("REST quote failed", "error");
    if (logFetch) {
      logLine(`REST quote error: ${error.message}`);
    }
    return { ok: false, authError: false, message: error.message };
  }
}

function startQuotePolling() {
  if (quotePollTimer) {
    clearInterval(quotePollTimer);
  }

  quotePollTimer = setInterval(() => {
    fetchFinnhubQuote(false).catch(() => undefined);
  }, 60000);
}

function subscribeSymbol(symbol) {
  if (!feedSocket || feedSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  if (lastConnectedSymbol && lastConnectedSymbol !== symbol) {
    feedSocket.send(JSON.stringify({ type: "unsubscribe", symbol: lastConnectedSymbol }));
  }

  feedSocket.send(JSON.stringify({ type: "subscribe", symbol }));
  lastConnectedSymbol = symbol;
}

function scheduleReconnect() {
  if (!wantFeedConnection || reconnectTimer || feedAuthFailed) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectFeed().catch(() => undefined);
  }, 4000);
}

async function connectFeed() {
  syncStateFromInputs();
  feedAuthFailed = false;
  wsDisconnectStreak = 0;
  wsDisconnectWindowStart = 0;

  if (state.settings.feedProvider !== "finnhub") {
    setFeedStatus("Unsupported provider", "error");
    return;
  }

  if (!state.settings.apiKey) {
    setFeedStatus("Missing API key", "error");
    logLine("Feed connection blocked: API key required");
    return;
  }

  wantFeedConnection = true;
  setFeedStatus("Connecting...", "connecting");

  const preflight = await fetchFinnhubQuote(false);
  if (preflight.authError) {
    handleFeedAuthFailure(preflight.message || "Invalid API token");
    return;
  }

  if (!preflight.ok) {
    setFeedStatus("REST preflight failed", "error");
    logLine("Feed connect aborted: quote preflight failed");
    return;
  }

  startQuotePolling();

  if (feedSocket) {
    feedSocket.close();
    feedSocket = null;
  }

  const socketUrl = `wss://ws.finnhub.io?token=${encodeURIComponent(state.settings.apiKey)}`;
  feedSocket = new WebSocket(socketUrl);

  feedSocket.addEventListener("open", async () => {
    state.feed.connected = true;
    state.feed.mode = "api+websocket";
    wsDisconnectStreak = 0;
    wsDisconnectWindowStart = 0;
    refreshFeedUi();
    subscribeSymbol(state.symbol);
    await fetchFinnhubQuote(false);
    logLine(`Feed connected for ${state.symbol}`);
    schedulePersist();
  });

  feedSocket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "error") {
        const wsError = String(payload.msg || payload.error || "websocket error");
        const maybeAuth = /auth|token|key|invalid|forbidden|unauthorized/i.test(wsError);
        if (maybeAuth) {
          handleFeedAuthFailure(wsError);
          return;
        }

        setFeedStatus(`WS error: ${wsError}`, "error");
        logLine(`Feed WS error: ${wsError}`);
        return;
      }

      if (payload.type !== "trade" || !Array.isArray(payload.data) || payload.data.length === 0) {
        return;
      }

      const latest = payload.data[payload.data.length - 1];
      if (latest.s && String(latest.s).toUpperCase() !== state.symbol.toUpperCase()) {
        return;
      }
      applyMarketPrice(Number(latest.p), "Websocket", latest.s || state.symbol);
    } catch (_error) {
      setFeedStatus("WS parse error", "error");
    }
  });

  feedSocket.addEventListener("error", () => {
    setFeedStatus("Websocket error", "error");
  });

  feedSocket.addEventListener("close", () => {
    feedSocket = null;
    state.feed.connected = false;
    state.feed.mode = "simulated";
    refreshFeedUi();
    schedulePersist();

    const now = Date.now();
    if (!wsDisconnectWindowStart || now - wsDisconnectWindowStart > 30000) {
      wsDisconnectWindowStart = now;
      wsDisconnectStreak = 1;
    } else {
      wsDisconnectStreak += 1;
    }

    if (wantFeedConnection && !feedAuthFailed && wsDisconnectStreak >= 3) {
      activateRestFallback("too many disconnects");
      return;
    }

    if (wantFeedConnection && !feedAuthFailed) {
      logLine("Feed disconnected, retrying...");
      scheduleReconnect();
    }
  });
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => undefined);
  }
}

function pushNotification(title, body) {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function beep() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.value = 660;
  gain.gain.value = 0.08;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  setTimeout(() => {
    osc.stop();
    ctx.close();
  }, 180);
}

async function runScan(source) {
  syncStateFromInputs();
  const hasApi = Boolean(state.settings.apiKey);
  if (hasApi) {
    const activeSymbolAtStart = state.symbol;
    const quoteResult = await fetchFinnhubQuote(false);
    if (quoteResult.authError) {
      handleFeedAuthFailure(quoteResult.message || "Invalid API token");
    }
    if (activeSymbolAtStart !== state.symbol) {
      return;
    }
  }

  if (!state.feed.connected && !hasApi) {
    const drift = (Math.random() - 0.45) * 1.8;
    state.price = Math.max(120, state.price + drift);
    state.atr = Math.max(0.8, Math.min(4.8, state.atr + (Math.random() - 0.5) * 0.18));

    const emaPivot = state.price - (Math.random() > 0.5 ? 0.8 : -0.8);
    state.trend = state.price >= emaPivot ? "BULLISH" : "BEARISH";
  }

  createSignalFromPrice();

  const s = state.signal;
  const setupScore = computeSetupAnalysis({
    price: state.price,
    prevClose: state.prevClose,
    atr: state.atr,
    trend: state.trend
  }).score;
  const alertDecision = shouldDispatchAlert(s, setupScore);

  if (alertDecision.allowed) {
    if (refs.desktopPopup.checked) {
      pushNotification("AlertTrader Signal", `${s.side} ${state.symbol} @ ${s.entry.toFixed(2)} | SL ${s.stop.toFixed(2)} | TP ${s.target.toFixed(2)}`);
    }

    if (refs.audioAlert.checked) {
      beep();
    }
  } else {
    logLine(`Alert suppressed: ${alertDecision.reason}`);
  }

  logLine(`${source} scan completed - ${state.symbol}`);

  state.nextScanIn = SCAN_INTERVAL_SECONDS;
  paint();
  schedulePersist();
}

function copyOrder() {
  const s = state.signal;
  if (s.blocked) {
    refs.copyOrderBtn.textContent = "Blocked";
    setTimeout(() => {
      refs.copyOrderBtn.textContent = "Copy Order";
    }, 1200);
    logLine("Copy blocked: risk guardrails active");
    return;
  }

  const text = `${s.side} ${state.symbol} LIMIT ${s.entry.toFixed(2)} | STOP ${s.stop.toFixed(2)} | TARGET ${s.target.toFixed(2)} | QTY ${s.shares}`;

  navigator.clipboard
    .writeText(text)
    .then(() => {
      refs.copyOrderBtn.textContent = "Copied";
      setTimeout(() => {
        refs.copyOrderBtn.textContent = "Copy Order";
      }, 1200);
      logLine("Order ticket copied to clipboard");
    })
    .catch(() => {
      refs.copyOrderBtn.textContent = "Copy failed";
      setTimeout(() => {
        refs.copyOrderBtn.textContent = "Copy Order";
      }, 1200);
    });
}

function tickScanCountdown() {
  state.nextScanIn -= 1;
  if (state.nextScanIn <= 0) {
    runScan("Auto").catch((error) => {
      logLine(`Auto scan error: ${error.message}`);
    });
    return;
  }

  const min = Math.floor(state.nextScanIn / 60);
  const sec = state.nextScanIn % 60;
  refs.scanMeta.textContent = `Scanning every 5 min | next in ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function paint() {
  syncStateFromInputs();
  resolveSessionPolicy();
  recalcSignalFromCurrentPrice();
  updateTopCards();
  updateLatestSignal();
  updateIndicators();
  renderSetupScorePanel();
  renderGuardrailPanel();
  renderWatchlistResults();
  renderHistory();
  renderLogs();
  refreshFeedUi();
}

refs.scanNowBtn.addEventListener("click", () => {
  runScan("Manual").catch((error) => {
    logLine(`Manual scan error: ${error.message}`);
  });
});
refs.clearHistoryBtn.addEventListener("click", () => {
  state.history = [];
  logLine("Signal history cleared by operator");
  paint();
  schedulePersist();
});
refs.copyOrderBtn.addEventListener("click", copyOrder);
refs.themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("glow-off");
  schedulePersist();
});

refs.connectFeedBtn.addEventListener("click", () => {
  if (state.feed.connected) {
    disconnectFeed();
    logLine("Feed disconnected by operator");
    return;
  }

  connectFeed().catch((error) => {
    logLine(`Feed connect error: ${error.message}`);
  });
});

refs.quoteNowBtn.addEventListener("click", () => {
  syncStateFromInputs();
  fetchFinnhubQuote(true).catch(() => undefined);
});

refs.scanWatchlistBtn.addEventListener("click", () => {
  runWatchlistScan().catch((error) => {
    refs.scanWatchlistBtn.disabled = false;
    refs.scanWatchlistBtn.textContent = "Scan Watchlist";
    refs.watchlistMeta.textContent = "Watchlist scan failed.";
    logLine(`Watchlist scan error: ${error.message}`);
  });
});

refs.watchlistResults.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const symbol = target.getAttribute("data-load-symbol");
  if (!symbol) {
    return;
  }

  refs.symbol.value = symbol;
  handleSymbolUpdate("enter").catch(() => undefined);
});

refs.watchlistInput.addEventListener("change", () => {
  syncStateFromInputs();
  schedulePersist();
});

inputIds.forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("change", async () => {
    if (id === "symbol") {
      await handleSymbolUpdate("change");
      return;
    }

    syncStateFromInputs();
    recalcSignalFromCurrentPrice();
    paint();
    schedulePersist();
  });
});

refs.symbol.addEventListener("input", () => {
  normalizeSymbolInput();
  if (symbolInputDebounceTimer) {
    clearTimeout(symbolInputDebounceTimer);
  }
  symbolInputDebounceTimer = setTimeout(() => {
    handleSymbolUpdate("debounced-input").catch(() => undefined);
  }, 650);
});

refs.symbol.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  if (symbolInputDebounceTimer) {
    clearTimeout(symbolInputDebounceTimer);
    symbolInputDebounceTimer = null;
  }
  handleSymbolUpdate("enter").catch(() => undefined);
});

[refs.desktopPopup, refs.audioAlert, refs.emailAlert, refs.autoSessionPresets].forEach((el) => {
  el.addEventListener("change", () => {
    syncStateFromInputs();
    recalcSignalFromCurrentPrice();
    paint();
    schedulePersist();
  });
});

async function initializeState() {
  const [seedData, persistedData] = await Promise.all([loadSeedDataset(), Promise.resolve(loadPersistedData())]);
  applyData(seedData || {});

  if (persistedData) {
    applyData(persistedData);
    logLine("Recovered state from local storage");
  } else {
    logLine("Initialized from dataset.json");
  }

  applyInputsFromState();
  paint();
}

setInterval(() => {
  refs.clock.textContent = nowClock();
  resolveSessionPolicy();
  renderGuardrailPanel();
}, 1000);

setInterval(tickScanCountdown, 1000);

window.addEventListener("beforeunload", () => {
  persistState();
  if (feedSocket) {
    feedSocket.close();
  }
});

initializeState()
  .then(() => {
    requestNotificationPermission();
    refs.clock.textContent = nowClock();
    if (state.settings.autoConnectFeed && state.settings.apiKey) {
      connectFeed().catch(() => undefined);
    } else if (state.settings.apiKey) {
      handleSymbolUpdate("enter").catch(() => {
        logLine(`Startup quote refresh failed for ${state.symbol}`);
      });
    }
    schedulePersist();
  })
  .catch(() => {
    requestNotificationPermission();
    refs.clock.textContent = nowClock();
    paint();
  });
