function pickLine(lines, state = {}, key = "") {
  const source = `${key}|${state.balls}|${state.runs}|${state.wkts}|${state.commentary?.length || 0}`;
  const seed = [...source].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return lines[seed % lines.length];
}

export function chaseLine(state = {}) {
  const need = Math.max(Number(state.target || 0) - Number(state.runs || 0), 0);
  const ballsLeft = Math.max(Number(state.totalOvers || 20) * 6 - Number(state.balls || 0), 0);
  if (!need) return "Target achieved.";
  if (!ballsLeft) return "";
  return `Need ${need} from ${ballsLeft} balls.`;
}

function remember(streaks, field, key) {
  if (!key || streaks[field] === key) return false;
  streaks[field] = key;
  return true;
}

function isLegalLabel(label = "") {
  return !/Wd|Nb/i.test(String(label));
}

function isWicketLabel(label = "") {
  return /^W(?!d)|wicket/i.test(String(label));
}

function labelRuns(label = "") {
  const text = String(label);
  const n = Number((text.match(/\d+/) || [0])[0]);
  return Number.isFinite(n) ? n : 0;
}

function recentLegalLabels(state = {}, count = 6) {
  const currentOver = Array.isArray(state.over) ? [...state.over].reverse() : [];
  const recent = Array.isArray(state.recentBalls) ? state.recentBalls.map(x => x?.label) : [];
  const labels = [...currentOver, ...recent];
  return labels.filter(isLegalLabel).slice(0, count);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function matchMath(state = {}) {
  const totalOvers = Number(state.totalOvers || 20);
  const totalBalls = totalOvers * 6;
  const balls = Number(state.balls || 0);
  const runs = Number(state.runs || 0);
  const wkts = Number(state.wkts || 0);
  const ballsLeft = Math.max(totalBalls - balls, 0);
  const oversLeft = ballsLeft / 6;
  const crr = balls ? runs / (balls / 6) : 0;
  const need = state.target ? Math.max(Number(state.target || 0) - runs, 0) : 0;
  const rrr = need && ballsLeft ? (need * 6) / ballsLeft : 0;
  const projected = balls ? Math.round(crr * totalOvers) : 0;
  const wicketsLeft = Math.max(10 - wkts, 0);
  return { totalOvers, totalBalls, balls, runs, wkts, ballsLeft, oversLeft, crr, need, rrr, projected, wicketsLeft };
}

function powerplayOvers(state = {}) {
  const totalOvers = Number(state.totalOvers || 20);
  const value = Number(state.powerplayOvers ?? 4);
  if (!Number.isFinite(value) || value < 0) return Math.min(4, totalOvers);
  return Math.min(value, totalOvers);
}

function isPowerplay(state = {}) {
  return Number(state.balls || 0) <= powerplayOvers(state) * 6;
}

function hindiReadKey(text = "") {
  return String(text).replace(/\d+(\.\d+)?/g, "#").toLowerCase();
}

function emitHindiRead(state = {}, bucket, text = "", minBalls = 6) {
  if (!text) return "";
  const streaks = state.specialStreaks || (state.specialStreaks = {});
  const key = hindiReadKey(text);
  const lastKey = streaks[`${bucket}Key`];
  const lastBall = Number(streaks[`${bucket}Ball`] ?? -999);
  const nowBall = Number(state.balls || 0);
  if (lastKey === key && nowBall - lastBall < minBalls) return "";
  streaks[`${bucket}Key`] = key;
  streaks[`${bucket}Ball`] = nowBall;
  return text;
}

function bowlingPhrase(bowler = "", batter = "") {
  const same = bowler && batter && String(bowler).trim().toLowerCase() === String(batter).trim().toLowerCase();
  return same ? `${bowler} की गेंद` : `${bowler} से ${batter}`;
}

function hindiWinRead(state = {}) {
  const m = matchMath(state);
  if (!state.target || Number(state.inningNumber || 1) <= 1) return "";
  if (!m.need) return "लक्ष्य हासिल, बल्लेबाजी टीम ने काम पूरा कर दिया।";
  if (!m.ballsLeft) return "";

  let chance = 50 + ((m.crr - m.rrr) * 7) + (m.wicketsLeft * 3) - (m.wkts * 2);
  if (m.ballsLeft <= 6) {
    if (m.need <= 2) chance = 92;
    else if (m.need <= m.ballsLeft) chance = 72;
    else if (m.need <= m.ballsLeft + 4) chance = 52;
    else if (m.need <= 14) chance = 35;
    else chance = 18;
  }
  chance = Math.round(clamp(chance, 8, 92) / 5) * 5;

  if (m.ballsLeft <= 6) {
    if (m.need <= 2) return `${m.need} रन ${m.ballsLeft} गेंदों में, बल्लेबाजी टीम लगभग जीत के दरवाजे पर है। संभावना करीब ${chance}% दिख रही है।`;
    if (m.need <= m.ballsLeft) return `${m.need} रन ${m.ballsLeft} गेंदों में, सिंगल-डबल से भी मैच निकाला जा सकता है। बल्लेबाजी टीम आगे दिख रही है।`;
    if (m.need <= m.ballsLeft + 4) return `${m.need} रन ${m.ballsLeft} गेंदों में, मैच बिल्कुल बराबरी पर है। एक बाउंड्री पूरी कहानी बदल सकती है।`;
    return `${m.need} रन ${m.ballsLeft} गेंदों में, अब बल्लेबाज को बड़ा शॉट चाहिए। गेंदबाजी टीम की पकड़ मजबूत है।`;
  }

  if (m.rrr <= m.crr + 1 && m.wicketsLeft >= 5) return `चेज नियंत्रण में है: ${m.need} रन ${m.ballsLeft} गेंदों में। विकेट हाथ में हैं, इसलिए बल्लेबाजी टीम की संभावना करीब ${chance}% है।`;
  if (m.rrr <= m.crr + 3) return `समीकरण खुला हुआ है: ${m.need} रन ${m.ballsLeft} गेंदों में। एक अच्छा ओवर बल्लेबाजी टीम को आगे कर देगा।`;
  if (m.rrr >= 12 || m.need > m.ballsLeft * 1.8) return `जरूरी रन रेट ${m.rrr.toFixed(1)} तक पहुंच गया है। अब सिर्फ स्ट्राइक रोटेशन नहीं, हर ओवर में बाउंड्री चाहिए।`;
  return `${m.need} रन ${m.ballsLeft} गेंदों में चाहिए। मैच अभी 50-50 है, लेकिन अगला ओवर बहुत अहम होगा।`;
}

function hindiFirstInningsRead(state = {}) {
  const m = matchMath(state);
  if (Number(state.inningNumber || 1) > 1 || !m.balls) return "";
  if (m.balls < 12) {
    if (m.runs >= 14) return "शुरुआत आक्रामक है, लेकिन अभी लक्ष्य का अंदाजा लगाना जल्दी होगा।";
    if (m.wkts >= 2) return "शुरुआत में विकेट गिर गए हैं, अब बल्लेबाजी टीम को पारी संभालनी होगी।";
    return "पारी अभी शुरू हुई है, बल्लेबाज पिच और गेंदबाज की लाइन पढ़ रहे हैं।";
  }
  const phase = isPowerplay(state) ? "पावरप्ले में" : (m.ballsLeft <= 30 ? "डेथ ओवरों में" : "मिडिल ओवरों में");
  const currentRate = m.crr;
  const expectedRate = isPowerplay(state)
    ? clamp(currentRate * 0.82, 6.5, 10.5)
    : m.ballsLeft <= 30
      ? clamp(currentRate * 1.08, 7, 13)
      : clamp(currentRate, 6.5, 11.5);
  const baseProjection = Math.round((m.runs + expectedRate * m.oversLeft) / 5) * 5;
  const wicketDrag = m.wkts >= 6 ? 18 : m.wkts >= 4 ? 10 : m.wkts <= 1 ? -6 : 0;
  const targetLow = Math.max(m.runs, baseProjection - 8 - wicketDrag);
  const targetHigh = Math.max(targetLow + 5, baseProjection + 8 - Math.floor(wicketDrag / 2));
  if (m.ballsLeft <= 18) return `${phase} स्कोर ${m.runs}/${m.wkts} है। यहां से ${targetLow}-${targetHigh} के बीच का लक्ष्य बन सकता है।`;
  if (m.crr >= 9 && m.wkts <= 3) return `${phase} रन रेट बढ़िया है। अगर विकेट बचे रहे तो ${targetLow}-${targetHigh} का मजबूत लक्ष्य दिख रहा है।`;
  if (m.crr <= 6 || m.wkts >= 4) return `${phase} बल्लेबाजी टीम को रफ्तार बढ़ानी होगी। अभी अनुमानित लक्ष्य ${targetLow}-${targetHigh} के आसपास दिख रहा है।`;
  return `${phase} पारी संतुलित चल रही है। इस गति से ${targetLow}-${targetHigh} का लक्ष्य बन सकता है।`;
}

function hindiFirstInningsFinishRead(state = {}) {
  const m = matchMath(state);
  if (Number(state.inningNumber || 1) > 1 || m.ballsLeft > 0 || !m.balls) return "";
  const target = m.runs + 1;
  if (m.crr >= 10) return `पहली पारी खत्म, लक्ष्य ${target} रन का है। रन रेट ${m.crr.toFixed(1)} रहा, बल्लेबाजी टीम ने काफी अच्छा स्कोर खड़ा किया है।`;
  if (m.crr >= 8) return `पहली पारी खत्म, लक्ष्य ${target} रन का है। रन रेट ${m.crr.toFixed(1)} रहा, यह ठीक-ठाक स्कोर है और गेंदबाजों को अच्छी शुरुआत चाहिए।`;
  if (m.crr < 7) return `पहली पारी खत्म, लक्ष्य ${target} रन का है। रन रेट ${m.crr.toFixed(1)} रहा, स्कोर बहुत खास नहीं है और बचाव के लिए गेंदबाजी टीम को जल्दी विकेट चाहिए।`;
  return `पहली पारी खत्म, लक्ष्य ${target} रन का है। स्कोर मुकाबले लायक है, लेकिन दूसरी पारी की शुरुआत बहुत अहम होगी।`;
}

function hindiMomentumRead(state = {}, flags = {}) {
  const recent = recentLegalLabels(state, 6);
  const recentRuns = recent.reduce((sum, label) => sum + labelRuns(label), 0);
  const dots = recent.filter(label => labelRuns(label) === 0 && !isWicketLabel(label)).length;
  const wickets = recent.filter(isWicketLabel).length;
  if (wickets >= 2) return "लगातार विकेटों ने मैच का रुख गेंदबाजी टीम की तरफ मोड़ दिया है।";
  if (dots >= 4) return "डॉट गेंदों की लाइन बन गई है, बल्लेबाज पर शॉट खेलने का दबाव साफ दिख रहा है।";
  if (recentRuns >= 18) return "पिछली कुछ गेंदों में रन तेजी से आए हैं, मोमेंटम बल्लेबाजी टीम के पास जा रहा है।";
  return "";
}

function hindiIntentRead(state = {}, batter = "बल्लेबाज", bowler = "गेंदबाज", flags = {}) {
  const recent = recentLegalLabels(state, 8);
  const boundaries = recent.filter(label => [4, 6].includes(labelRuns(label))).length + (Number(flags.batRuns || 0) >= 4 ? 1 : 0);
  const dots = recent.filter(label => labelRuns(label) === 0 && !isWicketLabel(label)).length;
  const wickets = recent.filter(isWicketLabel).length;
  if (boundaries >= 3) return `${batter} साफ अटैक मोड में हैं, अब ${bowler} को लेंथ बदलनी पड़ेगी।`;
  if (dots >= 4) return `${bowler} ने लाइन टाइट रखी है, बल्लेबाज को रूम नहीं मिल रहा।`;
  if (wickets >= 2) return `${bowler} का स्पेल अब मैच पर असर डाल रहा है, बल्लेबाजी टीम को संभलकर खेलना होगा।`;
  return "";
}

function hindiPressureMemory(state = {}, flags = {}) {
  const recent = recentLegalLabels(state, 12);
  if (recent.length < 8) return "";
  const lastSix = recent.slice(0, 6);
  const beforeSix = recent.slice(6, 12);
  const lastRuns = lastSix.reduce((sum, label) => sum + labelRuns(label), 0);
  const beforeRuns = beforeSix.reduce((sum, label) => sum + labelRuns(label), 0);
  if (Number(flags.batRuns || 0) >= 4 && beforeRuns <= 5) return "काफी देर के दबाव के बाद यह बाउंड्री बहुत जरूरी थी।";
  if (flags.isWicket && lastRuns >= 12) return "रन तेज आ रहे थे, लेकिन यह विकेट गेंदबाजी टीम को वापस ला सकता है।";
  if (lastRuns <= 4 && beforeRuns <= 6) return "दो शांत ओवरों ने बल्लेबाजी टीम पर दबाव बना दिया है।";
  return "";
}

function hindiPhaseTone(state = {}, flags = {}) {
  const m = matchMath(state);
  const over = Math.ceil(m.balls / 6);
  const important = flags.isWicket || Number(flags.batRuns || 0) >= 4 || m.balls % 6 === 0;
  if (!important) return "";
  if (over <= powerplayOvers(state)) {
    if (Number(flags.batRuns || 0) >= 4) return "फील्डिंग पाबंदियों का पूरा फायदा उठाया गया।";
    if (flags.isWicket) return "पावरप्ले में विकेट हमेशा बड़ा झटका होता है।";
  }
  if (m.ballsLeft <= 30) {
    if (Number(flags.batRuns || 0) >= 4) return "डेथ ओवरों में ऐसी बाउंड्री सीधे दबाव बदल देती है।";
    if (flags.isWicket) return "आखिरी ओवरों में यह विकेट बहुत महंगा पड़ सकता है।";
  }
  if (over > powerplayOvers(state) && m.ballsLeft > 30) {
    if (Number(flags.batRuns || 0) >= 4) return "मिडिल ओवरों में यह बाउंड्री रन रेट को सांस देती है।";
    if (flags.isWicket) return "मिडिल ओवरों में यह ब्रेकथ्रू साझेदारी तोड़ सकता है।";
  }
  return "";
}

function hindiFinishTone(state = {}) {
  const m = matchMath(state);
  if (!state.target || Number(state.inningNumber || 1) <= 1) return "";
  if (!m.ballsLeft) {
    if (m.need <= 0) return "लक्ष्य हासिल, बल्लेबाजी टीम ने मैच खत्म कर दिया।";
    if (m.need === 1) return "स्कोर बराबर, मैच टाई हो गया। अब फैसला सुपर ओवर में जा सकता है।";
    return `चेज खत्म, बल्लेबाजी टीम ${m.need - 1} रन से पीछे रह गई। गेंदबाजी टीम ने लक्ष्य बचा लिया।`;
  }
  if (m.need <= 0) return "अब सिर्फ जीत की मुहर लगनी बाकी थी, काम पूरा हो गया।";
  if (m.ballsLeft <= 6) {
    if (m.need === 1) return `${m.ballsLeft} गेंद बाकी हैं, 1 रन से स्कोर बराबर होगा और अगला रन मैच जिता देगा। टाई भी खेल में है।`;
    if (m.need === 2) return `${m.ballsLeft} गेंद बाकी हैं, 1 रन से स्कोर बराबर और 2 रन से जीत। मैच अभी खत्म नहीं हुआ है।`;
    if (m.need > m.ballsLeft * 6) return `${m.need} रन ${m.ballsLeft} गेंदों में, अब मैच लगभग गेंदबाजी टीम के हाथ में है।`;
    if (m.need > m.ballsLeft * 4) return `${m.need} रन ${m.ballsLeft} गेंदों में, बल्लेबाजी टीम को चमत्कारी हिट्स चाहिए।`;
    if (m.need <= 2) return "यहां से मैच हाथ से निकलना मुश्किल है, बस समझदारी चाहिए।";
    if (m.need === 6) return "एक छक्का और मैच खत्म, लेकिन एक डॉट गेंद दबाव दोगुना कर देगी।";
    if (m.need <= m.ballsLeft + 2) return "हर गेंद पर फैसला बदल सकता है, बल्लेबाज और गेंदबाज दोनों पर बराबर दबाव है।";
    return "अब चमत्कारी हिट चाहिए, गेंदबाजी टीम मैच अपनी मुट्ठी में रखे हुए है।";
  }
  if (m.need <= 8 && m.ballsLeft >= 12) return "अब बल्लेबाजी टीम को जल्दबाजी की जरूरत नहीं, मैच उनके नियंत्रण में है।";
  return "";
}

function hindiWicketImpactRead(state = {}, batter = "बल्लेबाज") {
  const m = matchMath(state);
  const setBatter = Number(state?.bat1?.name === batter ? state.bat1.r : state?.bat2?.name === batter ? state.bat2.r : 0);
  if (Number(state.inningNumber || 1) > 1 && state.target) {
    if (m.ballsLeft <= 12) return "इस समय विकेट बहुत बड़ा झटका है, अब चेज में गलती की गुंजाइश कम हो गई है।";
    if (setBatter >= 25) return `${batter} सेट होकर गए हैं, यह विकेट मैच का रुख बदल सकता है।`;
    return "गेंदबाजी टीम को सही समय पर ब्रेकथ्रू मिला है।";
  }
  if (isPowerplay(state)) {
    if (setBatter >= 25) return `${batter} अच्छी लय में दिख रहे थे, पावरप्ले में यह बड़ा विकेट है।`;
    return "पावरप्ले में विकेट गिरना बल्लेबाजी टीम की रफ्तार रोक सकता है।";
  }
  if (m.ballsLeft <= 30) return "डेथ ओवरों से पहले यह विकेट फिनिशिंग प्लान को बिगाड़ सकता है।";
  return "यह ब्रेकथ्रू साझेदारी को रोक सकता है।";
}

function hindiHumanChaseRead(state = {}) {
  const m = matchMath(state);
  if (!state.target || Number(state.inningNumber || 1) <= 1) return "";
  if (!m.need) return "लक्ष्य हासिल, बल्लेबाजी टीम ने काम पूरा कर दिया।";
  if (!m.ballsLeft) return "";
  if (m.balls < 12) {
    if (m.rrr >= 14) return `लक्ष्य बड़ा है, अभी ${m.need} रन ${m.ballsLeft} गेंदों में चाहिए। शुरुआत अच्छी है, लेकिन चेज लंबा है।`;
    if (m.rrr >= 10) return `अभी ${m.need} रन ${m.ballsLeft} गेंदों में चाहिए। शुरुआत मायने रखेगी, लेकिन जल्दबाजी की जरूरत नहीं।`;
    return `चेज की शुरुआत है, ${m.need} रन ${m.ballsLeft} गेंदों में चाहिए। बल्लेबाजी टीम को बस विकेट संभालकर खेलना होगा।`;
  }
  if (m.ballsLeft <= 6) {
    if (m.need === 1) return `${m.ballsLeft} गेंद बाकी हैं, 1 रन से स्कोर बराबर होगा और अगला रन मैच जिता देगा। टाई भी खेल में है।`;
    if (m.need === 2) return `${m.ballsLeft} गेंद बाकी हैं, 1 रन से स्कोर बराबर और 2 रन से जीत। मैच अभी खत्म नहीं हुआ है।`;
    if (m.need <= 2) return `${m.need} रन ${m.ballsLeft} गेंदों में, बल्लेबाजी टीम मजबूत स्थिति में है।`;
    if (m.need <= m.ballsLeft) return `${m.need} रन ${m.ballsLeft} गेंदों में, सिंगल-डबल से भी मैच निकाला जा सकता है।`;
    if (m.need <= m.ballsLeft + 4) return `${m.need} रन ${m.ballsLeft} गेंदों में, मैच अभी पूरी तरह खुला है। एक बाउंड्री कहानी बदल सकती है।`;
    return `${m.need} रन ${m.ballsLeft} गेंदों में, अब बल्लेबाज को बड़ा शॉट चाहिए। गेंदबाजी टीम आगे दिख रही है।`;
  }
  if (m.rrr <= m.crr + 1 && m.wicketsLeft >= 5) return `चेज नियंत्रण में है: ${m.need} रन ${m.ballsLeft} गेंदों में। विकेट हाथ में हैं, बल्लेबाजी टीम आगे दिख रही है।`;
  if (m.rrr <= m.crr + 3) return `समीकरण खुला है: ${m.need} रन ${m.ballsLeft} गेंदों में। एक अच्छा ओवर मैच बल्लेबाजी टीम की तरफ झुका देगा।`;
  if (m.rrr >= 12 || m.need > m.ballsLeft * 1.8) return `जरूरी रन रेट ${m.rrr.toFixed(1)} तक पहुंच गया है। अब हर ओवर में बाउंड्री चाहिए।`;
  return `${m.need} रन ${m.ballsLeft} गेंदों में चाहिए। मैच अभी बराबरी पर है, अगला ओवर अहम होगा।`;
}

function hindiWicketDetail(flags = {}) {
  const type = flags.wicketInfo?.type || "";
  const helper = flags.wicketInfo?.helper || "";
  const map = {
    Bowled: "सीधा स्टंप पर वार, बल्लेबाज के पास जवाब नहीं था।",
    LBW: "पैड पर सीधी गेंद, अपील मजबूत थी और फैसला गेंदबाज के पक्ष में गया।",
    Caught: helper ? `${helper} ने दबाव में अच्छा कैच पकड़ा।` : "हवा में शॉट गया और फील्डर ने मौका नहीं छोड़ा।",
    "Run Out": "गलत कॉल और फील्डिंग टीम ने मौका भुना लिया।",
    Stumping: "क्रीज से बाहर निकले और कीपर ने बिजली जैसी तेजी दिखाई।",
    "Hit Wicket": "बल्लेबाज खुद स्टंप से टकरा गए, अजीब लेकिन बड़ा विकेट।",
    "Retired Out": "बल्लेबाज रिटायर्ड आउट हुए, अब नई जोड़ी पर जिम्मेदारी होगी।"
  };
  return map[type] || "";
}

function overLabels(state = {}) {
  return Array.isArray(state.over) ? state.over : [];
}

function labelsRuns(labels = []) {
  return labels.reduce((sum, label) => sum + labelRuns(label), 0);
}

function labelsWickets(labels = []) {
  return labels.filter(isWicketLabel).length;
}

function hindiOverStory(state = {}, runs = 0, wickets = 0) {
  const labels = overLabels(state);
  if (!labels.length) return "";
  const firstHalf = labels.slice(0, Math.ceil(labels.length / 2));
  const secondHalf = labels.slice(Math.ceil(labels.length / 2));
  const earlyRuns = labelsRuns(firstHalf);
  const lateRuns = labelsRuns(secondHalf);
  const boundaries = labels.filter(label => [4, 6].includes(labelRuns(label))).length;
  const dots = labels.filter(label => labelRuns(label) === 0 && !isWicketLabel(label)).length;
  if (wickets >= 2) return "दो झटकों ने इस ओवर को पूरी तरह गेंदबाजी टीम के नाम कर दिया।";
  if (wickets === 1 && runs <= 6) return "रन भी कम दिए और विकेट भी मिला, यह गेंदबाजी टीम के लिए बढ़िया ओवर रहा।";
  if (earlyRuns <= 2 && lateRuns >= 10) return "पहली गेंदें शांत रहीं, लेकिन आखिरी हिस्से में बल्लेबाजों ने ओवर छीन लिया।";
  if (earlyRuns >= 10 && lateRuns <= 3) return "शुरुआत महंगी थी, लेकिन आखिरी गेंदों में गेंदबाज ने अच्छी वापसी की।";
  if (boundaries >= 2) return "बाउंड्री ने इस ओवर का रंग बदल दिया।";
  if (dots >= 4) return "डॉट गेंदों ने ओवर में दबाव बनाए रखा।";
  return "";
}

function previousOverRead(state = {}, currentBowler = "") {
  const rows = Array.isArray(state.overSummary) ? state.overSummary : [];
  const previous = rows[1];
  if (!previous?.timeline?.length) return "";
  const previousRuns = labelsRuns(previous.timeline);
  const previousWkts = labelsWickets(previous.timeline);
  const previousBowler = previous.bowler || "";
  const sameBowler = previousBowler && currentBowler && previousBowler.trim().toLowerCase() === currentBowler.trim().toLowerCase();
  if (previousRuns >= 16) {
    return sameBowler
      ? `${currentBowler} ने पिछले महंगे ओवर के बाद वापसी की कोशिश की है।`
      : `पिछला ओवर ${previousBowler || "गेंदबाज"} के लिए महंगा रहा था, इसलिए बल्लेबाजी टीम मोमेंटम लेकर आई।`;
  }
  if (previousRuns <= 3 || previousWkts >= 2) {
    return sameBowler
      ? `${currentBowler} ने पिछले ओवर का दबाव आगे भी बनाए रखा।`
      : `पिछले ओवर में ${previousBowler || "गेंदबाज"} ने दबाव बनाया था, उसका असर अभी भी दिख रहा है।`;
  }
  return "";
}

function hindiScorePhrase(state = {}, flags = {}) {
  const m = matchMath(state);
  const score = `${m.runs}/${m.wkts}`;
  const important = flags.isWicket || Number(flags.batRuns || 0) >= 4 || Number(flags.totalRuns || 0) >= 4;
  const chasePressure = Number(state.inningNumber || 1) > 1 && state.target && (m.ballsLeft <= 12 || m.rrr >= 10);
  const show = important || chasePressure || m.balls % 6 === 0 || Number(state.commentary?.length || 0) % 3 === 0;
  if (!show) return "";
  const lines = [
    `स्कोर ${score}।`,
    `अब स्कोर ${score}।`,
    `स्कोरबोर्ड ${score} पर पहुंचा।`
  ];
  const lostChase = Number(state.inningNumber || 1) > 1 && state.target && m.ballsLeft <= 6 && m.need > m.ballsLeft * 4;
  if (!lostChase && Number(state.inningNumber || 1) > 1 && state.target && m.need > 0 && m.ballsLeft > 0) {
    lines.push(`अब चाहिए ${m.need} रन ${m.ballsLeft} गेंदों में।`);
  }
  return pickLine(lines, state, `hi-score-${score}-${m.balls}`);
}

function hindiSituationInsight(state = {}, flags = {}, batter = "बल्लेबाज", bowler = "गेंदबाज") {
  if ((state.commentaryMode || "en") !== "hi") return "";
  const m = matchMath(state);
  const importantBall = flags.isWicket || Number(flags.batRuns || 0) >= 4 || Number(flags.totalRuns || 0) >= 4;
  const overCheckpoint = m.balls > 0 && m.balls % 6 === 0;
  const chasePressure = Number(state.inningNumber || 1) > 1 && state.target && (m.ballsLeft <= 6 || m.rrr >= 10 || m.need <= m.ballsLeft + 6);
  const recent = recentLegalLabels(state, 6);
  const pressureTrigger = recent.filter(label => labelRuns(label) === 0 && !isWicketLabel(label)).length >= 4 || recent.filter(isWicketLabel).length >= 2;
  if (!importantBall && !overCheckpoint && !chasePressure && !pressureTrigger) return "";
  if (Number(state.inningNumber || 1) === 1 && m.balls < 12 && !importantBall) return "";
  const reads = [];
  const finish = hindiFinishTone(state);
  const coreSituation = importantBall || overCheckpoint || chasePressure;
  const lastOverChase = Number(state.inningNumber || 1) > 1 && state.target && m.ballsLeft <= 6;
  if (finish && Number(state.inningNumber || 1) > 1 && state.target && m.ballsLeft === 0) {
    return finish;
  }
  if (coreSituation) {
    if (flags.isWicket) reads.push(emitHindiRead(state, "lastHindiWicketImpact", hindiWicketImpactRead(state, batter), 8));
    else if (finish) reads.push(emitHindiRead(state, "lastHindiFinish", finish, 2));
    else if (Number(state.inningNumber || 1) > 1 && state.target) reads.push(emitHindiRead(state, "lastHindiChase", hindiHumanChaseRead(state), 4));
    else if (m.ballsLeft === 0) reads.push(emitHindiRead(state, "lastHindiFirstInningsFinish", hindiFirstInningsFinishRead(state), 12));
    else reads.push(emitHindiRead(state, "lastHindiProjection", hindiFirstInningsRead(state), 12));
  }
  const lostChase = Number(state.inningNumber || 1) > 1 && state.target && m.ballsLeft <= 6 && m.need > m.ballsLeft * 4;
  if (lastOverChase) return reads.filter(Boolean).slice(0, 1).join(" ");
  if (lostChase) return reads.filter(Boolean).slice(0, 1).join(" ");
  if (isFirstInningsFinished(state)) return reads.filter(Boolean).slice(0, 1).join(" ");
  if (flags.isWicket) reads.push(emitHindiRead(state, "lastHindiWicketDetail", hindiWicketDetail(flags), 8));
  if (!flags.isWicket) reads.push(emitHindiRead(state, "lastHindiIntent", hindiIntentRead(state, batter, bowler, flags), 8));
  reads.push(emitHindiRead(state, "lastHindiMemory", hindiPressureMemory(state, flags), 10));
  if (!flags.isWicket) reads.push(hindiPhaseTone(state, flags));
  reads.push(emitHindiRead(state, "lastHindiMomentum", hindiMomentumRead(state, flags), 8));
  if (Number(state.partnershipRuns || 0) >= 40 && !flags.isWicket) {
    reads.push(emitHindiRead(state, "lastHindiPartnership", `यह साझेदारी अब ${state.partnershipRuns} रन की हो गई है, गेंदबाजी टीम को यहां ब्रेकथ्रू चाहिए।`, 12));
  }
  const insight = reads.filter(Boolean).slice(0, 2).join(" ");
  if (!insight) return "";
  const streaks = state.specialStreaks || (state.specialStreaks = {});
  const key = insight.replace(/\d+(\.\d+)?/g, "#");
  const allowBallByBallEquation = Number(state.inningNumber || 1) > 1 && state.target && m.ballsLeft <= 6;
  if (!allowBallByBallEquation && streaks.lastHindiInsightKey === key) return "";
  streaks.lastHindiInsightKey = key;
  return insight;
}

function isFirstInningsFinished(state = {}) {
  const m = matchMath(state);
  return Number(state.inningNumber || 1) === 1 && m.ballsLeft === 0 && m.balls > 0;
}

function situationCopy(mode, data = {}) {
  const batter = data.batter || "batter";
  const outBatter = data.outBatter || batter;
  const need = Number(data.need || 0);
  const ballsLeft = Number(data.ballsLeft || 0);
  const rrr = Number(data.rrr || 0).toFixed(1);
  const shot = data.shot === 6 ? "six" : "four";
  const shotHi = data.shot === 6 ? "छक्का" : "चौका";
  const shotMix = data.shot === 6 ? "chhakka" : "four";
  const map = {
    hi: {
      firstBallBoundary: `पहली गेंद पर ${shotHi}, बल्लेबाज ने शुरुआत से ही इरादा साफ कर दिया।`,
      chaseEasy: `चेज अभी नियंत्रण में है, ${need} रन ${ballsLeft} गेंदों में चाहिए। बल्लेबाजी टीम को बस समझदारी से खेलना है।`,
      chaseBalanced: `मैच बराबरी पर खड़ा है, ${need} रन ${ballsLeft} गेंदों में चाहिए। एक बड़ा ओवर मैच घुमा सकता है।`,
      chaseHard: `अब काम मुश्किल होता जा रहा है, जरूरी रन रेट ${rrr} तक पहुंच गया है।`,
      chaseVeryHard: `यहां से बल्लेबाजी टीम को लगभग हर ओवर में बड़ा प्रहार चाहिए, ${need} रन सिर्फ ${ballsLeft} गेंदों में बाकी हैं।`,
      wicketSet: `${outBatter} सेट होकर आउट हुए, यह मैच का बड़ा मोड़ हो सकता है।`,
      wicketPressure: `विकेट से दबाव और बढ़ गया है, चेज में अब गलती की गुंजाइश कम है।`,
      tailPressure: `अब निचला क्रम मैदान पर है, गेंदबाजी टीम मैच पकड़ने की कोशिश करेगी।`,
      dotPressure: `लगातार डॉट गेंदों ने दबाव बना दिया है, बल्लेबाज को अब रन निकालना होगा।`,
      battingMomentum: `पिछली कुछ गेंदों में रन तेजी से आए हैं, बल्लेबाजी टीम ने मोमेंटम पकड़ लिया है।`,
      bowlingMomentum: `गेंदबाजी टीम ने लगातार झटके देकर मैच पर पकड़ मजबूत की है।`,
      partnershipControl: `यह साझेदारी मैच को संभाल रही है, दोनों बल्लेबाज बिना जोखिम के स्कोर आगे बढ़ा रहे हैं।`,
      chaseBack: `बड़ी गेंद ने दबाव कम किया, चेज फिर से खुलता दिख रहा है।`,
      lowScorePressure: `स्कोर रुक रहा है, रन रेट बढ़ाने के लिए अब बाउंड्री जरूरी हो गई है।`
    },
    mix: {
      firstBallBoundary: `Pehli ball par ${shotMix}, batter ne start se hi intent clear kar diya.`,
      chaseEasy: `Chase abhi control me hai, ${need} run ${ballsLeft} balls me chahiye. Smart batting kaafi hogi.`,
      chaseBalanced: `Match balance me hai, ${need} from ${ballsLeft}. Ek big over game palat sakta hai.`,
      chaseHard: `Kaam tough hota ja raha hai, required rate ${rrr} tak pahunch gaya hai.`,
      chaseVeryHard: `Yahan se batting side ko lagbhag har over me big hits chahiye, ${need} from ${ballsLeft}.`,
      wicketSet: `${outBatter} set hoke out hue, ye match ka bada turning point ho sakta hai.`,
      wicketPressure: `Wicket se chase me pressure aur badh gaya, ab mistakes ki jagah kam hai.`,
      tailPressure: `Lower order aa raha hai, bowling side match pakadne ki koshish karegi.`,
      dotPressure: `Back-to-back dots ne pressure bana diya, batter ko ab release shot chahiye.`,
      battingMomentum: `Last kuch balls me runs tez aaye hain, batting side momentum pakad rahi hai.`,
      bowlingMomentum: `Bowling side ne wickets se match apni taraf kheenchna shuru kiya hai.`,
      partnershipControl: `Ye partnership innings ko control kar rahi hai, dono batter smartly score badha rahe hain.`,
      chaseBack: `Badi ball se pressure halka hua, chase phir open ho raha hai.`,
      lowScorePressure: `Scoring ruk rahi hai, run rate uthane ke liye boundary zaroori hai.`
    },
    en: {
      firstBallBoundary: `Boundary first ball, ${batter} shows intent straight away.`,
      chaseEasy: `The chase is under control: ${need} needed from ${ballsLeft}. Smart batting should be enough.`,
      chaseBalanced: `This chase is finely balanced: ${need} from ${ballsLeft}. One big over can swing it.`,
      chaseHard: `The equation is getting tough, the required rate is up to ${rrr}.`,
      chaseVeryHard: `From here the batting side needs repeated big hits, ${need} from only ${ballsLeft}.`,
      wicketSet: `${outBatter} was set, that wicket can be a major turning point.`,
      wicketPressure: `That wicket adds serious pressure to the chase; there is little room for error now.`,
      tailPressure: `The lower order is exposed now, the bowling side will feel they can close this out.`,
      dotPressure: `A run of dot balls has built pressure, the batter needs a release shot.`,
      battingMomentum: `Runs have come quickly in the last few balls, the batting side has momentum.`,
      bowlingMomentum: `The bowling side has struck repeatedly and is pulling the match back.`,
      partnershipControl: `This partnership is controlling the innings and moving the score along calmly.`,
      chaseBack: `That big hit releases pressure and brings the chase back to life.`,
      lowScorePressure: `The scoring has stalled, the batting side needs a boundary to lift the rate.`
    }
  };
  return map[mode] || map.en;
}

export function buildSpecialCommentary({ state, batter, bowlerName, bowlerKey, flags = {} }) {
  const s = state || {};
  const mode = s.commentaryMode || "en";
  const streaks = s.specialStreaks || (s.specialStreaks = { batterId: "", shot: "", shotCount: 0, bowlerId: "", wicketCount: 0, partnershipMark: 0, lastPressureKey: "", lastPhaseKey: "", bowlerHighlightKey: "" });
  const playerKey = batter?.playerId || batter?.name || "";
  const parts = [];
  const before = Number(flags.beforeRuns || 0);
  const after = Number(batter?.r || 0);
  const mm = matchMath(s);
  const lostChase = Number(s.inningNumber || 1) > 1 && s.target && mm.ballsLeft <= 6 && mm.need > mm.ballsLeft * 4;
  const lastOverChase = Number(s.inningNumber || 1) > 1 && s.target && mm.ballsLeft <= 6;
  const milestoneNow = [200, 150, 100, 50].find(mark => before < mark && after >= mark);
  if (mode === "hi" && lostChase) return "";
  if (mode === "hi" && lastOverChase) {
    if (!milestoneNow) return "";
    return milestoneNow === 50 ? `${batter.name} का अर्धशतक पूरा, शानदार पारी।` : `${batter.name} ने ${milestoneNow} रन पूरे किए, बेहतरीन बल्लेबाजी।`;
  }
  const copy = {
    hi: {
      pressure: "दबाव बढ़ रहा है, अब हर गेंद अहम है।",
      lastOver: (need) => `आखिरी ओवर में ${need} रन चाहिए, मैच रोमांचक मोड़ पर है।`,
      powerplay: "पावरप्ले में बल्लेबाजी टीम तेज शुरुआत चाहती है।",
      death: "डेथ ओवर शुरू, अब बड़े शॉट और दबाव दोनों साथ चलेंगे।",
      middle: "बीच के ओवरों में स्ट्राइक रोटेशन अहम रहेगा।",
      partnership: (mark) => `इस जोड़ी ने ${mark} रन की साझेदारी पूरी की।`,
      economy: `${bowlerName} ने कसी हुई गेंदबाजी से रन रोक रखे हैं।`,
      wickets: `${bowlerName} का स्पेल असरदार रहा है, विकेट लगातार दबाव बना रहे हैं।`,
      fast: `${batter.name} तेज खेल रहे हैं, स्ट्राइक रेट लगातार ऊपर जा रहा है।`
    },
    mix: {
      pressure: "Pressure badh raha hai, ab har ball important hai.",
      lastOver: (need) => `Last over me ${need} run chahiye, match ekdum tight hai.`,
      powerplay: "Powerplay me batting side fast start dhoondh rahi hai.",
      death: "Death overs shuru, ab bade shots aur pressure dono rahenge.",
      middle: "Middle overs me strike rotation bahut important rahega.",
      partnership: (mark) => `Is pair ne ${mark} run ki partnership complete kar li.`,
      economy: `${bowlerName} tight bowling kar rahe hain, runs rok diye hain.`,
      wickets: `${bowlerName} ka spell impactful hai, wickets se pressure bana hai.`,
      fast: `${batter.name} attacking mood me hain, strike rate upar ja raha hai.`
    },
    en: {
      pressure: "Pressure is rising, every ball matters now.",
      lastOver: (need) => `${need} needed in the final over, this match is on a knife edge.`,
      powerplay: "Powerplay phase, the batting side will want a fast start.",
      death: "Death overs now, big shots and pressure come together.",
      middle: "Middle overs phase, strike rotation will be important.",
      partnership: (mark) => `This pair brings up a ${mark}-run partnership.`,
      economy: `${bowlerName} has kept it tight and dried up the scoring.`,
      wickets: `${bowlerName} is making this spell count with wickets.`,
      fast: `${batter.name} is scoring quickly and lifting the tempo.`
    }
  }[mode] || {};

  const milestone = milestoneNow;
  if (milestone) {
    if (mode === "hi") {
      const m = matchMath(s);
      const pressure = s.inningNumber > 1 && s.target && m.rrr >= 10 ? ` लेकिन जरूरी रन रेट ${m.rrr.toFixed(1)} है, काम अभी बाकी है।` : "";
      parts.push(milestone === 50 ? `${batter.name} का अर्धशतक पूरा, शानदार पारी।${pressure}` : `${batter.name} ने ${milestone} रन पूरे किए, बेहतरीन बल्लेबाजी।${pressure}`);
    }
    else if (mode === "mix") parts.push(milestone === 50 ? `${batter.name} ka fifty complete, kamaal ki batting.` : `${batter.name} ne ${milestone} runs complete kiye, top-class knock.`);
    else parts.push(milestone === 50 ? `${batter.name} brings up a fine fifty.` : `${batter.name} reaches ${milestone}, outstanding batting.`);
  }

  if (flags.legal && (flags.batRuns === 4 || flags.batRuns === 6)) {
    const shot = flags.batRuns === 6 ? "six" : "four";
    if (streaks.batterId === playerKey && streaks.shot === shot) streaks.shotCount = Number(streaks.shotCount || 0) + 1;
    else Object.assign(streaks, { batterId: playerKey, shot, shotCount: 1 });
    if (streaks.shotCount === 3) {
      const shotHi = shot === "six" ? "छक्के" : "चौके";
      const shotMix = shot === "six" ? "sixes" : "fours";
      parts.push(mode === "hi" ? `${batter.name} ने लगातार तीन ${shotHi} लगाए।` : mode === "mix" ? `${batter.name} ke back-to-back three ${shotMix}, pressure badh gaya.` : `${batter.name} makes it three ${shotMix} in a row.`);
    }
  } else if (flags.legal) {
    Object.assign(streaks, { batterId: playerKey, shot: "", shotCount: 0 });
  }

  const wicketType = flags.wicketInfo?.type || "";
  const bowlerWicket = flags.legal && flags.isWicket && !["Run Out", "Retired Out"].includes(wicketType);
  if (bowlerWicket) {
    if (streaks.bowlerId === bowlerKey) streaks.wicketCount = Number(streaks.wicketCount || 0) + 1;
    else Object.assign(streaks, { bowlerId: bowlerKey, wicketCount: 1 });
    if (streaks.wicketCount === 2) parts.push(mode === "hi" ? `${bowlerName} अब हैट्रिक पर हैं।` : mode === "mix" ? `${bowlerName} hat-trick ball par aa gaye.` : `${bowlerName} is on a hat-trick.`);
    else if (streaks.wicketCount === 3) parts.push(mode === "hi" ? `हैट्रिक! ${bowlerName} ने लगातार तीन विकेट लिए।` : mode === "mix" ? `HAT-TRICK! ${bowlerName} ne lagatar teen wicket le liye.` : `HAT-TRICK! ${bowlerName} has three wickets in three balls.`);
  } else if (flags.legal && !flags.isWicket) {
    Object.assign(streaks, { bowlerId: bowlerKey, wicketCount: 0 });
  }

  if (!flags.isWicket && !isFirstInningsFinished(s)) {
    const partnership = Number(s.partnershipRuns || 0);
    const mark = [150, 100, 50].find(x => partnership >= x && Number(streaks.partnershipMark || 0) < x);
    if (mark) {
      streaks.partnershipMark = mark;
      parts.push(copy.partnership(mark));
    }
  } else streaks.partnershipMark = 0;

  const totalBalls = Number(s.totalOvers || 20) * 6;
  const ballsLeft = Math.max(totalBalls - Number(s.balls || 0), 0);
  const need = s.target ? Math.max(Number(s.target || 0) - Number(s.runs || 0), 0) : 0;
  const rrr = need && ballsLeft ? (need * 6) / ballsLeft : 0;
  if (s.inningNumber > 1 && need > 0 && ballsLeft > 0) {
    const earlyChase = Number(s.balls || 0) < 12;
    if (ballsLeft <= 6) {
      const key = `last-${need}-${ballsLeft}`;
      if (streaks.lastPressureKey !== key) {
        streaks.lastPressureKey = key;
        const finishLine = mode === "hi" ? hindiFinishTone(s) : copy.lastOver(need);
        parts.push(finishLine || copy.lastOver(need));
      }
    } else if (!earlyChase && (rrr >= 10 || (ballsLeft <= 18 && need >= ballsLeft))) {
      const key = `pressure-${Math.ceil(rrr)}-${Math.ceil(ballsLeft / 6)}`;
      if (streaks.lastPressureKey !== key) {
        streaks.lastPressureKey = key;
        parts.push(copy.pressure);
      }
    }
  }

  if (flags.legal) {
    const overNo = Math.floor(Number(s.balls || 0) / 6) + 1;
    const phase = overNo <= powerplayOvers(s) ? "powerplay" : ballsLeft <= 24 ? "death" : "middle";
    const key = `${s.inningNumber}-${phase}`;
    const phaseCheckpoint = Number(s.balls || 0) >= 12 && Number(s.balls || 0) % 6 === 0;
    if (!isFirstInningsFinished(s) && phaseCheckpoint && streaks.lastPhaseKey !== key) {
      streaks.lastPhaseKey = key;
      parts.push(copy[phase]);
    }
  }

  const bowlerStat = s.bowlerStats?.[bowlerKey] || {};
  const bowlerBalls = Number(bowlerStat.balls || 0);
  const bowlerRuns = Number(bowlerStat.runs || 0);
  const bowlerWkts = Number(bowlerStat.wkts || 0);
  const economy = bowlerBalls ? (bowlerRuns / (bowlerBalls / 6)) : 0;
  if (bowlerBalls >= 12 && economy > 0 && economy <= 4) {
    const key = `${bowlerKey}-eco-${Math.floor(bowlerBalls / 6)}`;
    if (streaks.bowlerHighlightKey !== key) {
      streaks.bowlerHighlightKey = key;
      parts.push(copy.economy);
    }
  } else if (bowlerWkts >= 3) {
    const key = `${bowlerKey}-wkts-${bowlerWkts}`;
    if (streaks.bowlerHighlightKey !== key) {
      streaks.bowlerHighlightKey = key;
      parts.push(copy.wickets);
    }
  }

  if (Number(batter?.b || 0) >= 8 && Number(batter?.r || 0) >= 20) {
    const strikeRate = (Number(batter.r || 0) * 100) / Number(batter.b || 1);
    const key = `${playerKey}-fast-${Math.floor(Number(batter.r || 0) / 20)}`;
    if (!isFirstInningsFinished(s) && strikeRate >= 160 && streaks.fastBatterKey !== key) {
      streaks.fastBatterKey = key;
      parts.push(copy.fast);
    }
  }

  return parts.join(" ");
}

export function buildBallCommentary({ state, ballNo, batter, bowler, label, flags = {} }) {
  const run = Number(flags.run || 0);
  const score = `${state.runs}/${state.wkts}`;
  const chase = state.inningNumber > 1 && state.target ? chaseLine(state) : "";
  const base = `${bowler} to ${batter}`;
  const mode = state.commentaryMode || "en";
  const total = Number(flags.totalRuns ?? run ?? 0);
  const rawType = flags.wicketInfo?.type || "Wicket";
  const hiTypes = { Bowled: "बोल्ड", LBW: "एलबीडब्ल्यू", Caught: "कैच आउट", "Run Out": "रन आउट", Stumping: "स्टंपिंग", "Hit Wicket": "हिट विकेट", "Retired Out": "रिटायर्ड आउट", Wicket: "विकेट" };
  const type = mode === "hi" ? (hiTypes[rawType] || rawType) : rawType;
  const helper = flags.wicketInfo?.helper ? (mode === "hi" ? `, ${flags.wicketInfo.helper} शामिल` : `, ${flags.wicketInfo.helper} involved`) : "";
  const outBatter = flags.wicketInfo?.outBatsman || batter;
  const packs = {
    en: {
      wicket: [`WICKET! ${type}${helper}. ${outBatter} is gone.`, `Breakthrough! ${type}${helper}, ${outBatter} has to walk back.`, `Huge moment. ${outBatter} falls by ${type}${helper}.`],
      wide: [`Wide ball. Extra run added.`, `Sprayed down the side, called wide.`, `The line is off, wide signalled.`],
      wideRuns: [`Wide, ${total} runs added.`, `Loose ball and ${total} wides on the board.`, `${total} added from the wide.`],
      no: [`No ball. Free hit coming.`, `Overstepped, no ball called.`, `No ball from ${bowler}; the next one is a free hit.`],
      noRuns: [`No ball and ${run} run${run > 1 ? "s" : ""}. Free hit coming.`, `Overstepped, and they take ${run}. Free hit next.`, `${run} off the no ball, pressure on the bowler.`],
      bye: [`${total} bye${total > 1 ? "s" : ""}.`, `Missed by everyone, ${total} bye${total > 1 ? "s" : ""}.`, `Extras ticking along, ${total} bye${total > 1 ? "s" : ""}.`],
      lb: [`${total} leg bye${total > 1 ? "s" : ""}.`, `Off the pad, ${total} leg bye${total > 1 ? "s" : ""}.`, `Leg bye taken, ${total} added.`],
      six: [`SIX! Clean strike, all the way.`, `SIX! That has been launched into the stands.`, `Massive hit from ${batter}, six runs.`],
      four: [`FOUR! Finds the gap and races away.`, `FOUR! Timed well and the outfield does the rest.`, `Boundary for ${batter}, placed perfectly.`],
      dot: [`Dot ball. Good control from the bowler.`, `No run, tight line from ${bowler}.`, `Beaten for pace and there is no single there.`],
      one: [`Worked away for a single.`, `Quick single taken.`, `${batter} rotates the strike.`],
      two: [`Pushed into the gap, they come back for two.`, `Good running, two added.`, `Placed softly and they complete a couple.`],
      three: [`Excellent running, three taken.`, `They push hard and get three.`, `Long chase in the deep, three runs.`],
      other: [`${run} runs taken.`, `${run} added to the total.`, `They collect ${run}.`],
      score: `Score ${score}.`
    },
    mix: {
      wicket: [`WICKET! ${type}${helper}. ${outBatter} ko jaana padega.`, `Breakthrough! ${type}${helper}, match me twist aa gaya.`, `Bada moment, ${outBatter} ${type}${helper} out.`],
      wide: [`Wide ball, extra run add hua.`, `Line miss hui, umpire ne wide diya.`, `Bowler direction se bhatak gaya, wide.`],
      wideRuns: [`Wide, ${total} runs add hue.`, `Loose ball, ${total} wides mil gaye.`, `${total} run wide se aa gaye.`],
      no: [`No ball. Free hit coming.`, `Overstep hua, no ball.`, `No ball by ${bowler}, ab free hit.`],
      noRuns: [`No ball aur ${run} run${run > 1 ? "s" : ""}. Free hit coming.`, `No ball pe ${run} run bhi mil gaya.`, `${run} run no ball se, pressure badhega.`],
      bye: [`${total} bye run.`, `Keeper miss, ${total} bye mil gaya.`, `Ball sabko beat kar gayi, ${total} bye.`],
      lb: [`${total} leg bye run.`, `Pad se laga, ${total} leg bye.`, `Leg bye se ${total} add.`],
      six: [`SIX! Zabardast hit, seedha bahar.`, `SIX! Badiya connection, crowd me ball.`, `${batter} ne pura shot khola, six.`],
      four: [`FOUR! Gap mila aur boundary.`, `FOUR! Timing superb thi.`, `${batter} ne placement se four nikala.`],
      dot: [`Dot ball. Bowler ka achha control.`, `No run, tight bowling.`, `Batter ko room nahi mila.`],
      one: [`Single nikal liya.`, `Strike rotate kar di.`, `Soft hands se ek run.`],
      two: [`Gap me push kiya, do run complete.`, `Achhi running, two mil gaye.`, `Dono batsman tez bhaage, two.`],
      three: [`Achhi running, teen run mil gaye.`, `Deep me ball gayi, three complete.`, `Fitness ka kaam, teen run.`],
      other: [`${run} runs liye.`, `${run} run add hue.`, `${run} mil gaye.`],
      score: `Score ${score}.`
    },
    hi: {
      wicket: [`विकेट! ${type}${helper}. ${outBatter} आउट।`, `बड़ी सफलता! ${type}${helper}, ${outBatter} को लौटना होगा।`, `मैच का बड़ा पल, ${outBatter} ${type}${helper}।`],
      wide: [`वाइड गेंद। एक अतिरिक्त रन।`, `लाइन बाहर रही, अंपायर ने वाइड दिया।`, `वाइड से एक रन जुड़ा।`],
      wideRuns: [`वाइड, ${total} रन जुड़े।`, `${total} रन वाइड से मिले।`, `वाइड गेंद और ${total} रन।`],
      no: [`नो बॉल। अब फ्री हिट आएगी।`, `ओवरस्टेप हुआ, नो बॉल।`, `${bowler} से नो बॉल।`],
      noRuns: [`नो बॉल और ${run} रन। फ्री हिट आएगी।`, `नो बॉल पर ${run} रन भी मिल गए।`, `${run} रन नो बॉल से जुड़े।`],
      bye: [`${total} बाई रन।`, `कीपर से चूक, ${total} बाई।`, `बाई से ${total} रन जुड़े।`],
      lb: [`${total} लेग बाई रन।`, `पैड से लगी गेंद, ${total} लेग बाई।`, `लेग बाई से ${total} रन जुड़े।`],
      six: [`छक्का! शानदार शॉट।`, `छक्का! गेंद सीमा रेखा के पार।`, `${batter} का बड़ा शॉट, छह रन।`],
      four: [`चौका! गैप मिला और गेंद बाउंड्री तक।`, `चौका! बहुत अच्छी टाइमिंग।`, `${batter} ने बेहतरीन चौका निकाला।`],
      dot: [`डॉट गेंद। गेंदबाज का अच्छा नियंत्रण।`, `कोई रन नहीं।`, `बल्लेबाज को जगह नहीं मिली।`],
      one: [`एक रन लिया।`, `सिंगल मिल गया।`, `स्ट्राइक बदली।`],
      two: [`दो रन पूरे।`, `गैप में खेला, दो रन।`, `अच्छी दौड़ से दो रन मिले।`],
      three: [`तीन रन मिल गए।`, `बहुत अच्छी दौड़, तीन रन।`, `गेंद डीप में गई, तीन रन।`],
      other: [`${run} रन लिए।`, `${run} रन जुड़े।`, `${run} रन मिले।`],
      score: `स्कोर ${score}।`
    }
  };
  const pack = packs[mode] || packs.en;
  let lines;
  if (flags.isWicket) lines = pack.wicket;
  else if (flags.isWide) lines = total > 1 ? pack.wideRuns : pack.wide;
  else if (flags.isNo) lines = run ? pack.noRuns : pack.no;
  else if (flags.isBye) lines = pack.bye;
  else if (flags.isLb) lines = pack.lb;
  else if (run === 6) lines = pack.six;
  else if (run === 4) lines = pack.four;
  else if (run === 0) lines = pack.dot;
  else if (run === 1) lines = pack.one;
  else if (run === 2) lines = pack.two;
  else if (run === 3) lines = pack.three;
  else lines = pack.other;
  let action = pickLine(lines, state, `${mode}-${label}-${batter}-${bowler}`);
  if (mode === "hi" && flags.isNo && !/फ्री हिट/.test(action)) {
    action = `${action} अगली गेंद फ्री हिट होगी, बल्लेबाज खुलकर जा सकता है।`;
  } else if (mode === "hi" && flags.freeHitActive) {
    action = `फ्री हिट पर ${action}`;
  }
  const scoreText = mode === "hi" ? hindiScorePhrase(state, flags) : pack.score;
  const insight = hindiSituationInsight(state, flags, batter, bowler);
  if (mode === "hi") return [`${bowlingPhrase(bowler, batter)}, ${action}`, scoreText, insight].filter(Boolean).join(" ");
  return `${base}, ${action} ${pack.score}${chase ? " " + chase : ""}`;
}

export function buildOverCommentary({ state, overNo, runs, wickets }) {
  const score = `${state.runs}/${state.wkts}`;
  const mode = state.commentaryMode || "en";
  if (mode === "hi") {
    const wicketText = wickets ? `${wickets} विकेट` : "कोई विकेट नहीं";
    let note = "ओवर संतुलित रहा।";
    if (wickets >= 2) note = "इस ओवर ने मैच का रुख बदल दिया।";
    else if (wickets === 1) note = "गेंदबाजी टीम को जरूरी ब्रेकथ्रू मिला।";
    else if (runs >= 16) note = "बल्लेबाजी टीम के लिए बड़ा ओवर, दबाव अब गेंदबाजों पर।";
    else if (runs <= 3) note = "कसा हुआ ओवर, बल्लेबाजों पर दबाव बढ़ा।";
    const read = Number(state.inningNumber || 1) > 1 && state.target
      ? emitHindiRead(state, "lastHindiChase", hindiHumanChaseRead(state), 4)
      : (matchMath(state).ballsLeft === 0
        ? emitHindiRead(state, "lastHindiFirstInningsFinish", hindiFirstInningsFinishRead(state), 12)
        : emitHindiRead(state, "lastHindiProjection", hindiFirstInningsRead(state), 12));
    const finish = hindiFinishTone(state);
    const story = emitHindiRead(state, "lastHindiOverStory", hindiOverStory(state, runs, wickets), 6);
    const previous = emitHindiRead(state, "lastHindiPreviousOver", previousOverRead(state, state.bowler?.name || ""), 6);
    return `खत्म: ${runs} रन, ${wicketText}। स्कोर ${score}। ${note}${story ? " " + story : ""}${previous ? " " + previous : ""}${finish ? " " + finish : (read ? " " + read : "")}`;
  }
  const wicketText = wickets ? `${wickets} wicket${wickets > 1 ? "s" : ""}` : "no wickets";
  let note = "Steady over.";
  if (wickets >= 2) note = "Major shift in momentum.";
  else if (wickets === 1) note = "Breakthrough over.";
  else if (runs >= 16) note = "Big over for the batting side.";
  else if (runs <= 3) note = "Tidy over from the bowler.";
  const chase = state.inningNumber > 1 && state.target ? chaseLine(state) : "";
  return `End of over ${overNo}: ${runs} run${runs === 1 ? "" : "s"}, ${wicketText}. Score ${score}. ${note}${chase ? " " + chase : ""}`;
}
