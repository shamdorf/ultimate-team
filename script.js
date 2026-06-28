// ======================
// ACCOUNT
// ======================

// Firebase email key: "." und "@" sind in Firebase-Keys verboten
function encodeEmail(email){
    return email.replace(/\./g, ",").replace(/@/g, "__at__");
}
function decodeEmail(key){
    return key.replace(/,/g, ".").replace(/__at__/g, "@");
}

let currentUser =
JSON.parse(
localStorage.getItem("ut_session")
) || null;

function storageKey(key){
    return currentUser.email + "_" + key;
}

function saveData(key, val){
    localStorage.setItem(storageKey(key), val);
}

function loadData(key){
    return localStorage.getItem(storageKey(key));
}

let coins = 0;
let gems = 0;
let club = [];
let team = [];
let coinLevel = 1;
let xp = 0;
let passLevel = 1;

// ======================
// SPIEL LADEN
// ======================

function initGame(){

    coins =
    parseInt(loadData("coins"))
    || 100000;

    gems =
    parseInt(loadData("gems"))
    || 0;

    club =
    JSON.parse(loadData("club"))
    || [];

    team =
    JSON.parse(loadData("team"))
    || [];

    coinLevel =
    parseInt(loadData("coinLevel"))
    || 1;

    xp =
    parseInt(loadData("xp"))
    || 0;

    passLevel =
    parseInt(loadData("passLevel"))
    || 1;

    document
    .getElementById("playerName")
    .innerHTML = currentUser.name;

    document
    .getElementById("loginScreen")
    .style.display = "none";

    updateCurrency();
    updateStats();
    loadSidebarReports();
    updateNotifBadge();
    updateQuestBadge();
    updateWheelState();
    initTicker();
    setTimeout(checkAllAchievements, 1000);
    setTimeout(checkLoginStreak, 800);
    setTimeout(syncUserStats, 2000);
    setInterval(syncUserStats, 60000);
    if(loadData("vip") === "1"){
        const pn = document.getElementById("playerName");
        if(pn) pn.innerHTML =
        currentUser.name + ' <span class="vip-tag">👑 VIP</span>';
    }
    applyAccentColor(
    localStorage.getItem("ut_accent") || "#00d4ff");
    if(localStorage.getItem("ut_animations")==="off")
        document.body.classList.add("no-animations");
    if(localStorage.getItem("ut_ticker")==="off")
        applyTickerSetting(false);
}

window.onload = () => {

    if(currentUser && accounts[currentUser.email]){
        initGame();
    }
};

// ======================
// LOGIN / REGISTER
// ======================

function showRegister(){
    document.getElementById("loginForm")
    .style.display = "none";
    document.getElementById("registerForm")
    .style.display = "block";
    document.getElementById("loginError")
    .textContent = "";
}

function showLogin(){
    document.getElementById("registerForm")
    .style.display = "none";
    document.getElementById("loginForm")
    .style.display = "block";
    document.getElementById("loginError")
    .textContent = "";
}

async function login(){

    const email =
    document.getElementById("loginEmail")
    .value.trim().toLowerCase();

    const password =
    document.getElementById("loginPassword")
    .value;

    const errorEl =
    document.getElementById("loginError");

    if(!email || !password){
        errorEl.textContent = "Bitte alle Felder ausfüllen!";
        return;
    }

    errorEl.textContent = "⏳ Einloggen…";

    try {
        const snap = await db.ref("accounts/" + encodeEmail(email)).once("value");
        if(!snap.exists()){
            errorEl.textContent = "Kein Konto mit dieser E-Mail!";
            return;
        }
        const acc = snap.val();
        if(acc.password !== password){
            errorEl.textContent = "Falsches Passwort!";
            return;
        }
        currentUser = { email, name: acc.name };
        localStorage.setItem("ut_session", JSON.stringify(currentUser));
        errorEl.textContent = "";
        initGame();
    } catch(e){
        errorEl.textContent = "Verbindungsfehler. Bitte erneut versuchen.";
    }
}

async function register(){

    const name =
    document.getElementById("regName")
    .value.trim();

    const email =
    document.getElementById("regEmail")
    .value.trim().toLowerCase();

    const password =
    document.getElementById("regPassword")
    .value;

    const confirm =
    document.getElementById("regConfirm")
    .value;

    const errorEl =
    document.getElementById("loginError");

    if(!name || !email || !password || !confirm){
        errorEl.textContent = "Bitte alle Felder ausfüllen!";
        return;
    }
    if(!email.includes("@")){
        errorEl.textContent = "Ungültige E-Mail-Adresse!";
        return;
    }
    if(password.length < 6){
        errorEl.textContent = "Passwort: mind. 6 Zeichen!";
        return;
    }
    if(password !== confirm){
        errorEl.textContent = "Passwörter stimmen nicht überein!";
        return;
    }

    errorEl.textContent = "⏳ Registrieren…";

    try {
        const snap = await db.ref("accounts/" + encodeEmail(email)).once("value");
        if(snap.exists()){
            errorEl.textContent = "E-Mail bereits registriert!";
            return;
        }
        await db.ref("accounts/" + encodeEmail(email)).set({
            name, email, password,
            coins: 100000, gems: 0, wins: 0, clubSize: 0
        });
        currentUser = { email, name };
        localStorage.setItem("ut_session", JSON.stringify(currentUser));
        errorEl.textContent = "";
        initGame();
    } catch(e){
        errorEl.textContent = "Verbindungsfehler. Bitte erneut versuchen.";
    }
}

function logout(){

    currentUser = null;

    localStorage.removeItem("ut_session");

    location.reload();
}

function syncUserStats(){
    if(!currentUser) return;
    db.ref("accounts/" + encodeEmail(currentUser.email)).update({
        coins,
        gems,
        wins: parseInt(loadData("wins") || 0),
        clubSize: club.length,
        name: currentUser.name
    });
}

// ======================
// RANGLISTE
// ======================

function loadLeaderboard(){

    const container =
    document.getElementById("leaderboardContainer");
    if(!container) return;
    container.innerHTML = '<p style="opacity:.5;margin-top:20px">⏳ Lade Rangliste…</p>';

    db.ref("accounts").once("value").then(snap => {
        const all = snap.val() || {};
        const entries = Object.values(all)
            .map(acc => ({
                name:     acc.name || "Unbekannt",
                email:    acc.email || "",
                coins:    acc.coins || 0,
                gems:     acc.gems || 0,
                wins:     acc.wins || 0,
                clubSize: acc.clubSize || 0,
                isMe:     currentUser && currentUser.email === acc.email
            }))
            .sort((a,b) => b.coins - a.coins);

        if(entries.length === 0){
            container.innerHTML = '<p style="opacity:.5;margin-top:20px">Noch keine Spieler registriert.</p>';
            return;
        }

        const medals = ["🥇","🥈","🥉"];
        container.innerHTML = entries.map((e,i) => `
        <div class="lb-row ${e.isMe ? "lb-me" : ""}">
            <div class="lb-rank">${i < 3 ? medals[i] : "#"+(i+1)}</div>
            <div class="lb-name">
                ${e.name}
                ${e.isMe ? '<span class="lb-you">Du</span>' : ""}
            </div>
            <div class="lb-stat">
                <span class="lb-stat-label">Coins</span>
                <span class="lb-stat-val">${e.coins.toLocaleString("de-DE")} 🪙</span>
            </div>
            <div class="lb-stat">
                <span class="lb-stat-label">Siege</span>
                <span class="lb-stat-val">${e.wins} 🏆</span>
            </div>
            <div class="lb-stat">
                <span class="lb-stat-label">Verein</span>
                <span class="lb-stat-val">${e.clubSize} Spieler</span>
            </div>
            <div class="lb-stat">
                <span class="lb-stat-label">Gems</span>
                <span class="lb-stat-val">${e.gems} 💎</span>
            </div>
        </div>`).join("");
    }).catch(() => {
        container.innerHTML = '<p style="opacity:.5;color:#ff5555">Verbindungsfehler.</p>';
    });
}

// ======================
// SAISON-RANG
// ======================

const rankTiers = [
    { name:"Bronze",  min:0,  color:"#cd7f32", glow:"rgba(205,127,50,.4)",  icon:"🥉" },
    { name:"Silber",  min:5,  color:"#c0c0c0", glow:"rgba(192,192,192,.4)", icon:"🥈" },
    { name:"Gold",    min:15, color:"#ffd700", glow:"rgba(255,215,0,.4)",   icon:"🥇" },
    { name:"Platin",  min:30, color:"#00e5ff", glow:"rgba(0,229,255,.4)",   icon:"💎" },
    { name:"Elite",   min:60, color:"#ff00ff", glow:"rgba(255,0,255,.4)",   icon:"👑" },
];

function getSaisonRank(){
    const wins = parseInt(loadData("wins") || 0);
    let tier = rankTiers[0];
    for(const t of rankTiers) if(wins >= t.min) tier = t;
    const next = rankTiers[rankTiers.indexOf(tier)+1];
    return { tier, wins, next };
}

function updateRankBanner(){
    const el = document.getElementById("rankBanner");
    if(!el) return;
    const { tier, wins, next } = getSaisonRank();
    const pct = next
        ? Math.min(100, ((wins - tier.min) / (next.min - tier.min)) * 100)
        : 100;
    el.innerHTML = `
    <div class="rank-tier-icon">${tier.icon}</div>
    <div class="rank-info">
        <div class="rank-tier-name" style="color:${tier.color}">${tier.name}</div>
        <div class="rank-progress-bar">
            <div class="rank-fill" style="width:${pct}%;background:${tier.color};
            box-shadow:0 0 10px ${tier.glow}"></div>
        </div>
        <div class="rank-prog-text">${wins} Siege${next ? ` · ${next.min - wins} bis ${next.name}` : " · Max. Rang!"}</div>
    </div>
    <div class="rank-wins-count" style="color:${tier.color}">${wins}<span>W</span></div>`;
    el.style.borderColor = tier.color.replace(")",", .3)").replace("rgb","rgba") || "rgba(255,215,0,.3)";
    el.style.boxShadow = `0 0 30px ${tier.glow}`;
}

// ======================
// GLÜCKSRAD
// ======================

const wheelSegments = [
    { label:"🪙 10.000",  icon:"🪙", text:"10.000 Coins",   coins:10000,  gems:0,    pack:null },
    { label:"🪙 50.000",  icon:"🪙", text:"50.000 Coins",   coins:50000,  gems:0,    pack:null },
    { label:"💎 500",     icon:"💎", text:"500 Gems",        coins:0,      gems:500,  pack:null },
    { label:"📦 Pack",    icon:"📦", text:"1 Gold Pack",     coins:0,      gems:0,    pack:"gold" },
    { label:"🪙 100.000", icon:"🪙", text:"100.000 Coins",  coins:100000, gems:0,    pack:null },
    { label:"👑 TOTY",    icon:"👑", text:"1 TOTY Pack!",    coins:0,      gems:0,    pack:"toty" },
    { label:"💎 2.000",   icon:"💎", text:"2.000 Gems",      coins:0,      gems:2000, pack:null },
];
const SEG = 360 / wheelSegments.length;
let wheelSpinning = false;
let wheelRotation = 0;

function loadWheel(){
    renderWheelPrizes();
    updateWheelState();
}

function renderWheelPrizes(){
    const el = document.getElementById("wheelPrizeList");
    if(!el) return;
    el.innerHTML = wheelSegments.map(s => `
        <div class="wheel-prize-item">
            <span class="wheel-prize-icon">${s.icon}</span>
            <span>${s.text}</span>
        </div>`).join("");
}

function updateWheelState(){
    const today = new Date().toISOString().slice(0,10);
    const lastSpin = loadData("wheelDate");
    const used = lastSpin === today;
    const btn = document.getElementById("wheelSpinBtn");
    const badge = document.getElementById("wheelBadge");
    if(btn) btn.disabled = used;
    if(badge) badge.style.display = used ? "none" : "inline";
    const timer = document.getElementById("wheelTimer");
    if(timer && used){
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24,0,0,0);
        const diff = midnight - now;
        const h = Math.floor(diff/3600000);
        const m = Math.floor((diff%3600000)/60000);
        timer.textContent = `Nächste Drehung in ${h}h ${m}m`;
    } else if(timer){
        timer.textContent = "";
    }
}

function spinWheel(){
    const today = new Date().toISOString().slice(0,10);
    if(loadData("wheelDate") === today || wheelSpinning) return;
    wheelSpinning = true;

    const idx = Math.floor(Math.random() * wheelSegments.length);
    const spins = (Math.floor(Math.random()*4)+6) * 360;
    const target = spins + (360 - idx * SEG - SEG/2);
    wheelRotation += target;

    const wheel = document.getElementById("spinWheel");
    wheel.style.transition = "transform 4s cubic-bezier(.17,.67,.12,1)";
    wheel.style.transform = `rotate(${wheelRotation}deg)`;

    setTimeout(() => {
        wheelSpinning = false;
        saveData("wheelDate", today);
        updateWheelState();
        giveWheelPrize(wheelSegments[idx]);
    }, 4200);
}

function giveWheelPrize(seg){
    if(seg.coins){ coins += seg.coins; saveData("coins", coins); }
    if(seg.gems){ gems += seg.gems; saveData("gems", gems); }
    if(seg.pack){
        const pool = players.filter(p => p.rarity === seg.pack);
        if(pool.length){
            const p = pool[Math.floor(Math.random()*pool.length)];
            club.push(p);
            saveData("club", JSON.stringify(club));
        }
    }
    updateCurrency();
    pushNotif("🎰","Glücksrad: " + seg.text + " gewonnen!");
    checkAllAchievements();
    const res = document.getElementById("wheelResult");
    if(res){
        res.style.display = "block";
        res.innerHTML = `
        <div class="wheel-result-icon">${seg.icon}</div>
        <div class="wheel-result-text">${seg.text}</div>
        <div class="wheel-result-sub">Gewonnen! 🎉</div>`;
    }
}

// ======================
// LOGIN STREAK
// ======================

const streakRewards = [
    { day:1, icon:"🪙", label:"5.000 Coins",   coins:5000,  gems:0,   pack:null },
    { day:2, icon:"🪙", label:"10.000 Coins",  coins:10000, gems:0,   pack:null },
    { day:3, icon:"💎", label:"500 Gems",       coins:0,     gems:500, pack:null },
    { day:4, icon:"🪙", label:"25.000 Coins",  coins:25000, gems:0,   pack:null },
    { day:5, icon:"💎", label:"1.000 Gems",     coins:0,     gems:1000,pack:null },
    { day:6, icon:"🪙", label:"50.000 Coins",  coins:50000, gems:0,   pack:null },
    { day:7, icon:"👑", label:"TOTY Pack!",     coins:0,     gems:0,   pack:"toty" },
];

function checkLoginStreak(){
    const today = new Date().toISOString().slice(0,10);
    const data = JSON.parse(loadData("streak") || "{}");
    if(data.lastLogin === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate()-1);
    const yStr = yesterday.toISOString().slice(0,10);

    if(data.lastLogin === yStr){
        data.current = Math.min((data.current||0)+1, 7);
    } else {
        data.current = 1;
    }
    data.lastLogin = today;
    data.claimed = false;
    saveData("streak", JSON.stringify(data));
    showStreakModal(data);
}

function showStreakModal(data){
    const modal = document.getElementById("streakModal");
    if(!modal) return;
    const day = data.current;
    document.getElementById("streakSubtitle").textContent = `Tag ${day} von 7`;
    const grid = document.getElementById("streakGrid");
    grid.innerHTML = streakRewards.map(r => {
        const past    = r.day < day;
        const current = r.day === day;
        const future  = r.day > day;
        return `
        <div class="streak-day ${past?"streak-past":""} ${current?"streak-current":""} ${future?"streak-future":""}">
            <div class="streak-day-num">Tag ${r.day}</div>
            <div class="streak-day-icon">${r.icon}</div>
            <div class="streak-day-label">${r.label}</div>
            ${past ? '<div class="streak-check">✔</div>' : ""}
        </div>`;
    }).join("");
    modal.style.display = "flex";
}

function claimStreak(){
    const data = JSON.parse(loadData("streak") || "{}");
    if(data.claimed) return;
    const reward = streakRewards.find(r => r.day === data.current);
    if(!reward) return;
    data.claimed = true;
    saveData("streak", JSON.stringify(data));
    if(reward.coins){ coins += reward.coins; saveData("coins", coins); }
    if(reward.gems){ gems += reward.gems; saveData("gems", gems); }
    if(reward.pack){
        const pool = players.filter(p => p.rarity === reward.pack);
        if(pool.length){
            const p = pool[Math.floor(Math.random()*pool.length)];
            club.push(p);
            saveData("club", JSON.stringify(club));
        }
    }
    updateCurrency();
    pushNotif("📅","Login-Streak Tag " + data.current + ": " + reward.label + " erhalten!");
    document.getElementById("streakModal").style.display = "none";
    if(data.current === 7) checkAchievement("streak_7");
}

function closeStreakModal(e){
    if(e.target === e.currentTarget)
        document.getElementById("streakModal").style.display = "none";
}

// ======================
// TRANSFER TICKER
// ======================

const tickerNews = [
    "🔴 BREAKING: Mbappé verlängert Vertrag bis 2030!",
    "💰 Ronaldo für 800 Mio. € zu Al-Nassr gewechselt",
    "⭐ Bellingham: 'Ich will den Ballon d'Or gewinnen'",
    "🏆 Real Madrid gewinnt die Champions League zum 16. Mal!",
    "😱 Haaland bricht Bundesliga-Torrekord mit 52 Toren",
    "🔵 Manchester City verpflichtet Lamine Yamal für 400 Mio.",
    "🇧🇷 Brasilien ist Favorit für die WM 2026",
    "🤝 Neymar kehrt zu Barcelona zurück — offiziell bestätigt!",
    "🔥 Vinicius Jr. ist der wertvollste Spieler der Welt",
    "⚽ Kylian Mbappé: 'Ultimate Team ist mein Lieblingsspiel'",
    "🏟️ Neues 120.000-Plätze-Stadion in Riad eröffnet",
    "💎 Pele-TOTY-Karte bricht alle Preisrekorde",
    "🚀 Jindaui gilt als bester Spieler seiner Generation",
    "📊 FIFA 27: Haaland mit Rating 99 angekündigt",
];

function initTicker(){
    const el = document.getElementById("tickerContent");
    if(!el) return;
    const doubled = [...tickerNews, ...tickerNews];
    el.textContent = doubled.join("   ·   ");
}

// ======================
// TÄGLICHE AUFGABEN
// ======================

const questDefs = [
    { id:"open_pack",  icon:"📦", label:"Öffne 3 Packs",         target:3,  reward:"50.000 🪙",  coins:50000 },
    { id:"win_match",  icon:"🏆", label:"Gewinne 2 Spiele",      target:2,  reward:"30.000 🪙",  coins:30000 },
    { id:"sell_player",icon:"💸", label:"Verkaufe 1 Spieler",    target:1,  reward:"20.000 🪙",  coins:20000 },
    { id:"buy_shop",   icon:"🛒", label:"Kaufe 1 Spieler im Shop",target:1, reward:"1 TOTY Pack", coins:0, pack:"toty" },
    { id:"add_team",   icon:"⚽", label:"Stelle 5 Spieler auf",  target:5,  reward:"15.000 🪙",  coins:15000 },
];

function getQuestData(){
    const today = new Date().toISOString().slice(0,10);
    const raw = JSON.parse(loadData("quests") || "{}");
    if(raw.date !== today){
        const fresh = { date: today, progress:{}, claimed:{} };
        questDefs.forEach(q => fresh.progress[q.id] = 0);
        saveData("quests", JSON.stringify(fresh));
        return fresh;
    }
    return raw;
}

function saveQuestData(data){
    saveData("quests", JSON.stringify(data));
}

function questProgress(id, amount = 1){
    const data = getQuestData();
    if(data.claimed[id]) return;
    data.progress[id] = (data.progress[id] || 0) + amount;
    saveQuestData(data);
    updateQuestBadge();
}

function updateQuestBadge(){
    const data = getQuestData();
    const hasReady = questDefs.some(q =>
        !data.claimed[q.id] &&
        (data.progress[q.id] || 0) >= q.target);
    const badge = document.getElementById("questBadge");
    if(badge) badge.style.display = hasReady ? "inline" : "none";
}

function loadQuests(){
    const data = getQuestData();
    const el = document.getElementById("questList");
    if(!el) return;

    const total = questDefs.length;
    const claimedCount = questDefs.filter(q => data.claimed[q.id]).length;
    const todayStr = new Date().toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"});

    el.innerHTML = `
    <div class="quest-header">
        <div class="quest-header-left">
            <div class="quest-header-title">Tägliche Aufgaben</div>
            <div class="quest-header-sub">${claimedCount} von ${total} abgeschlossen</div>
        </div>
        <div class="quest-header-right">
            <div class="quest-header-date">${todayStr}</div>
            <div class="quest-header-reset">Reset um 00:00 Uhr</div>
        </div>
    </div>` +
    questDefs.map(q => {
        const prog = data.progress[q.id] || 0;
        const isDone = prog >= q.target;
        const claimed = data.claimed[q.id];
        const pct = Math.min(100, (prog / q.target) * 100);

        return `
        <div class="quest-card ${claimed ? "quest-done" : ""}">
            <div class="quest-icon-wrap">${q.icon}</div>
            <div class="quest-body">
                <div class="quest-label">${q.label}</div>
                <div class="quest-progress-bar">
                    <div class="quest-fill" style="width:${pct}%"></div>
                </div>
                <div class="quest-prog-text">${prog} / ${q.target}</div>
            </div>
            <div class="quest-right">
                <div class="quest-reward">🎁 ${q.reward}</div>
                ${claimed
                    ? '<div class="quest-claimed">✔ Erhalten</div>'
                    : isDone
                    ? `<button class="quest-claim-btn" onclick="claimQuest('${q.id}')">✨ Abholen</button>`
                    : ""}
            </div>
        </div>`;
    }).join("");
}

function claimQuest(id){
    const data = getQuestData();
    if(data.claimed[id]) return;
    const q = questDefs.find(x => x.id === id);
    if(!q) return;

    data.claimed[id] = true;
    saveQuestData(data);

    if(q.coins){
        coins += q.coins;
        saveData("coins", coins);
        updateCurrency();
        pushNotif("🎯", "Aufgabe abgeschlossen: " + q.label + " +" + q.reward);
    }
    if(q.pack){
        const pool = players.filter(p =>
            p.rarity === q.pack &&
            !club.some(c => c.name === p.name));
        if(pool.length > 0){
            const p = pool[Math.floor(Math.random()*pool.length)];
            club.push(p);
            saveData("club", JSON.stringify(club));
            pushNotif("📦", "Quest-Pack geöffnet: " + p.name + " (" + p.rating + ")");
        }
    }

    checkAchievement("quest_master");
    loadQuests();
    updateQuestBadge();
}

// ======================
// ERFOLGE
// ======================

const achieveDefs = [
    { id:"first_card",   icon:"🃏", name:"Erste Karte",       desc:"Ziehe deinen ersten Spieler",        check: ()=> club.length >= 1 },
    { id:"ten_cards",    icon:"👥", name:"Zehn Hoch",         desc:"10 Spieler im Verein",                check: ()=> club.length >= 10 },
    { id:"full_team",    icon:"⚽", name:"Volle Kraft",       desc:"11 Spieler im Team aufstellen",       check: ()=> team.length >= 11 },
    { id:"first_win",    icon:"🏆", name:"Erster Sieg",       desc:"Ein Spiel gewinnen",                  check: ()=> parseInt(loadData("wins")||0) >= 1 },
    { id:"five_wins",    icon:"🔥", name:"Siegesserie",       desc:"5 Spiele gewinnen",                   check: ()=> parseInt(loadData("wins")||0) >= 5 },
    { id:"toty_owner",   icon:"👑", name:"Elite-Sammler",     desc:"Einen TOTY-Spieler besitzen",         check: ()=> club.some(p=>p.rarity==="toty") },
    { id:"vip_member",   icon:"💎", name:"VIP-Status",        desc:"VIP-Mitgliedschaft kaufen",           check: ()=> loadData("vip")==="1" },
    { id:"rich",         icon:"💰", name:"Millionär",         desc:"1 Mio. Coins besitzen",               check: ()=> coins >= 1000000 },
    { id:"mega_rich",    icon:"🤑", name:"Milliardär",        desc:"1 Mrd. Coins besitzen",               check: ()=> coins >= 1000000000 },
    { id:"quest_master", icon:"🎯", name:"Aufgaben-Meister", desc:"Eine tägliche Aufgabe abschließen",   check: ()=> { const d=getQuestData(); return Object.keys(d.claimed||{}).length>=1; } },
    { id:"fifty_cards",  icon:"🗂️", name:"Großer Kader",     desc:"50 Spieler im Verein",                check: ()=> club.length >= 50 },
    { id:"pack_addict",  icon:"📦", name:"Pack-Junkie",       desc:"100 Packs öffnen",                    check: ()=> parseInt(loadData("packsOpened")||0) >= 100 },
    { id:"streak_7",     icon:"🔥", name:"7-Tage-Streak",     desc:"7 Tage hintereinander einloggen",     check: ()=> { const d=JSON.parse(loadData("streak")||"{}"); return d.current>=7 && d.claimed; } },
    { id:"wheel_lucky",  icon:"🎰", name:"Glückspilz",        desc:"Das Glücksrad drehen",                check: ()=> !!loadData("wheelDate") },
    { id:"elite_rank",   icon:"👑", name:"Elite-Spieler",     desc:"Den Elite-Rang erreichen",            check: ()=> parseInt(loadData("wins")||0) >= 60 },
];

function getUnlockedAchievements(){
    return JSON.parse(loadData("achievements") || "[]");
}

function checkAchievement(id){
    const unlocked = getUnlockedAchievements();
    if(unlocked.includes(id)) return;
    const def = achieveDefs.find(a => a.id === id);
    if(!def || !def.check()) return;

    unlocked.push(id);
    saveData("achievements", JSON.stringify(unlocked));
    showAchievementPopup(def);
    pushNotif("🏆", "Erfolg: " + def.name + " — " + def.desc);
}

function checkAllAchievements(){
    achieveDefs.forEach(a => checkAchievement(a.id));
}

function showAchievementPopup(def){
    const popup = document.getElementById("achievePopup");
    document.getElementById("achieveIcon").innerHTML = def.icon;
    document.getElementById("achieveName").textContent = def.name;
    popup.style.display = "flex";
    clearTimeout(window._achieveTimer);
    window._achieveTimer = setTimeout(()=>{
        popup.style.display = "none";
    }, 3500);
}

function loadAchievements(){
    const unlocked = getUnlockedAchievements();
    const el = document.getElementById("achieveList");
    if(!el) return;

    const total = achieveDefs.length;
    const done  = unlocked.length;
    const pct   = Math.round((done/total)*100);

    el.innerHTML = `
    <div class="achieve-page-header" style="grid-column:1/-1">
        <div>
            <div class="achieve-page-count">${done} / ${total}</div>
            <div class="achieve-page-sub">Erfolge freigeschaltet</div>
        </div>
        <div style="text-align:right">
            <div class="achieve-page-pct">${pct}% abgeschlossen</div>
            <div style="margin-top:8px;width:140px;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ffa000,#ffd700);border-radius:4px;transition:.4s"></div>
            </div>
        </div>
    </div>` +
    achieveDefs.map(a => {
        const isDone = unlocked.includes(a.id);
        return `
        <div class="achieve-card ${isDone ? "achieve-unlocked" : "achieve-locked"}">
            <div class="achieve-card-icon-wrap">${isDone ? a.icon : "🔒"}</div>
            <div class="achieve-card-body">
                <div class="achieve-card-name">${a.name}</div>
                <div class="achieve-card-desc">${a.desc}</div>
            </div>
            ${isDone ? '<div class="achieve-check">✔</div>' : ""}
        </div>`;
    }).join("");
}

// ======================
// BENACHRICHTIGUNGEN
// ======================

function getNotifs(){
    return JSON.parse(
    loadData("notifs") || "[]") || [];
}

function pushNotif(icon, text){
    const notifs = getNotifs();
    notifs.unshift({
        icon, text,
        time: new Date().toLocaleString(
        "de-DE",{day:"2-digit",month:"2-digit",
        hour:"2-digit",minute:"2-digit"}),
        read: false
    });
    if(notifs.length > 30) notifs.pop();
    saveData("notifs", JSON.stringify(notifs));
    updateNotifBadge();
}

function updateNotifBadge(){
    const notifs = getNotifs();
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById("notifBadge");
    if(!badge) return;
    if(unread > 0){
        badge.style.display = "flex";
        badge.textContent = unread > 9 ? "9+" : unread;
    } else {
        badge.style.display = "none";
    }
}

function toggleNotifs(){
    const dd = document.getElementById("notifDropdown");
    const open = dd.style.display !== "none";
    dd.style.display = open ? "none" : "block";
    if(!open){
        renderNotifs();
        markNotifsRead();
    }
}

function renderNotifs(){
    const notifs = getNotifs();
    const el = document.getElementById("notifList");
    if(!el) return;
    if(notifs.length === 0){
        el.innerHTML =
        '<p class="notif-empty">Keine Benachrichtigungen.</p>';
        return;
    }
    el.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read?"":"notif-unread"}">
        <span class="notif-icon">${n.icon}</span>
        <div class="notif-body">
            <div class="notif-text">${n.text}</div>
            <div class="notif-time">${n.time}</div>
        </div>
    </div>`).join("");
}

function markNotifsRead(){
    const notifs = getNotifs();
    notifs.forEach(n => n.read = true);
    saveData("notifs", JSON.stringify(notifs));
    updateNotifBadge();
}

function clearNotifs(){
    saveData("notifs", "[]");
    renderNotifs();
    updateNotifBadge();
}

document.addEventListener("click", e => {
    const wrapper =
    document.querySelector(".notif-wrapper");
    if(wrapper && !wrapper.contains(e.target)){
        const dd =
        document.getElementById("notifDropdown");
        if(dd) dd.style.display = "none";
    }
});

// ======================
// VIP
// ======================

function buyVIP(){
    if(loadData("vip") === "1"){
        alert("Du bist bereits VIP!"); return;
    }
    const cost = 3000000;
    if(gems < cost){
        alert("Nicht genügend Diamanten!\nDu hast: "
        + gems.toLocaleString("de-DE") + " 💎\nBenötigt: "
        + cost.toLocaleString("de-DE") + " 💎");
        return;
    }
    if(!confirm("VIP kaufen für 3.000.000 💎?\nDu erhältst täglich 3 TOTY Packs!"))
        return;
    gems -= cost;
    saveData("gems", gems);
    saveData("vip", "1");
    updateCurrency();
    loadShop("fix");
    pushNotif("👑", "Du bist jetzt VIP! Hole täglich 3 TOTY Packs ab.");
    alert("🎉 Willkommen als VIP! Hole jeden Tag deine 3 TOTY Packs ab.");
}

function claimDailyPacks(){
    if(loadData("vip") !== "1"){
        alert("Nur für VIP-Mitglieder!"); return;
    }
    const today = new Date().toISOString().slice(0,10);
    if(loadData("vip_lastclaim") === today){
        alert("Heute bereits abgeholt! Komm morgen wieder."); return;
    }

    const totyPlayers = players.filter(
    p => p.rarity === "toty" &&
    !club.some(c => c.name === p.name));

    if(totyPlayers.length === 0){
        alert("Du besitzt bereits alle TOTY Spieler!"); return;
    }

    const drawn = [];
    for(let i = 0; i < 3; i++){
        const pool = players.filter(
        p => p.rarity === "toty" &&
        !club.some(c => c.name === p.name) &&
        !drawn.some(d => d.name === p.name));
        if(pool.length === 0) break;
        drawn.push(pool[
        Math.floor(Math.random() * pool.length)]);
    }

    drawn.forEach(p => club.push(p));
    saveData("club", JSON.stringify(club));
    saveData("vip_lastclaim", today);
    addXP(300);
    loadShop("fix");
    pushNotif("🎁", "VIP Tagespacks abgeholt: " +
    drawn.map(p => p.name).join(", "));
    alert("🎁 Tägliche VIP Packs!\n\nDu hast erhalten:\n"
    + drawn.map(p => "⭐ " + p.name + " (" + p.rating + ")").join("\n"));
}

// ======================
// TRAININGSPLAN
// ======================

const dayNames = ["Montag","Dienstag","Mittwoch",
"Donnerstag","Freitag","Samstag","Sonntag"];

let currentPlan = {
    name: "",
    days: [[],[],[],[],[],[],[]]
};

let tpEditDay = null;

function loadTraining(){
    const plans = getTrainingPlans();
    renderSavedPlans(plans);
    renderAllDays();
}

function getTrainingPlans(){
    return JSON.parse(
    loadData("ut_tp") || "[]") || [];
}

function renderSavedPlans(plans){
    const el =
    document.getElementById("savedPlans");
    if(!el) return;
    if(plans.length === 0){
        el.innerHTML =
        '<p style="opacity:.4;font-size:13px">Noch keine gespeicherten Pläne.</p>';
        return;
    }
    el.innerHTML = plans.map((p,i) => `
    <button class="saved-plan-btn"
    onclick="loadPlan(${i})">
        📋 ${p.name}
        <span onclick="deletePlan(event,${i})"
        class="del-plan">✕</span>
    </button>`).join("");
}

function loadPlan(index){
    const plans = getTrainingPlans();
    currentPlan = JSON.parse(
    JSON.stringify(plans[index]));
    document.getElementById("tpName")
    .value = currentPlan.name;
    renderAllDays();
}

function deletePlan(e, index){
    e.stopPropagation();
    if(!confirm("Plan löschen?")) return;
    const plans = getTrainingPlans();
    plans.splice(index, 1);
    saveData("ut_tp", JSON.stringify(plans));
    renderSavedPlans(plans);
}

function newTrainingPlan(){
    currentPlan = {
        name: "",
        days: [[],[],[],[],[],[],[]]
    };
    document.getElementById("tpName").value = "";
    renderAllDays();
}

function saveTrainingPlan(){
    const name =
    document.getElementById("tpName")
    .value.trim() ||
    "Plan " + (getTrainingPlans().length + 1);

    currentPlan.name = name;
    document.getElementById("tpName")
    .value = name;

    const plans = getTrainingPlans();
    const existing = plans.findIndex(
    p => p.name === name);

    if(existing >= 0){
        plans[existing] = JSON.parse(
        JSON.stringify(currentPlan));
    } else {
        plans.push(JSON.parse(
        JSON.stringify(currentPlan)));
    }

    saveData("ut_tp", JSON.stringify(plans));
    renderSavedPlans(plans);
    alert("Plan \"" + name + "\" gespeichert!");
}

function renderAllDays(){
    for(let d = 0; d < 7; d++){
        renderDay(d);
    }
}

function renderDay(d){
    const el =
    document.getElementById("day-" + d);
    if(!el) return;
    const entries = currentPlan.days[d] || [];
    if(entries.length === 0){
        el.innerHTML =
        '<p class="tp-empty">Kein Training</p>';
        return;
    }
    el.innerHTML = entries.map((e, i) => `
    <div class="tp-entry">
        <div class="tp-entry-type">${e.type}</div>
        <div class="tp-entry-dur">${e.duration}</div>
        ${e.note
        ? `<div class="tp-entry-note">${e.note}</div>`
        : ""}
        <button class="tp-del-btn"
        onclick="removeEntry(${d},${i})">✕</button>
    </div>`).join("");
}

function addEntry(day){
    tpEditDay = day;
    document.getElementById("tpModalDayLabel")
    .textContent = "— " + dayNames[day] + " —";
    document.getElementById("tpNote").value = "";
    document.getElementById("tpModal")
    .style.display = "flex";
}

function closeTpModal(e){
    if(e && e.target !==
    document.getElementById("tpModal")) return;
    document.getElementById("tpModal")
    .style.display = "none";
}

function confirmTpEntry(){
    const type =
    document.getElementById("tpType").value;
    const duration =
    document.getElementById("tpDuration").value;
    const note =
    document.getElementById("tpNote")
    .value.trim();

    if(!currentPlan.days[tpEditDay])
        currentPlan.days[tpEditDay] = [];

    currentPlan.days[tpEditDay].push(
    {type, duration, note});

    document.getElementById("tpModal")
    .style.display = "none";

    renderDay(tpEditDay);
}

function removeEntry(day, index){
    currentPlan.days[day].splice(index, 1);
    renderDay(day);
}

// ======================
// EINSTELLUNGEN
// ======================

function loadSettings(){
    const el = id => document.getElementById(id);
    if(el("settingsEmail"))
        el("settingsEmail").textContent =
        currentUser.email;
    if(el("settingsCPS"))
        el("settingsCPS").textContent =
        (40 * coinLevel).toLocaleString("de-DE");
    if(el("settingsClubSize"))
        el("settingsClubSize").textContent =
        club.length;
    if(el("settingsPassLvl"))
        el("settingsPassLvl").textContent =
        passLevel;
    const anim =
    localStorage.getItem("ut_animations") !== "off";
    if(el("toggleAnimations"))
        el("toggleAnimations").checked = anim;
    const ticker =
    localStorage.getItem("ut_ticker") !== "off";
    if(el("toggleTicker"))
        el("toggleTicker").checked = ticker;
    const accent =
    localStorage.getItem("ut_accent") || "#00d4ff";
    applyAccentColor(accent);
}

function changeName(){
    const val =
    document.getElementById("newNameInput")
    .value.trim();
    if(!val){ alert("Namen eingeben!"); return; }
    accounts[currentUser.email].name = val;
    localStorage.setItem(
    "ut_accounts", JSON.stringify(accounts));
    currentUser.name = val;
    localStorage.setItem(
    "ut_session", JSON.stringify(currentUser));
    document.getElementById("playerName")
    .textContent = val;
    document.getElementById("newNameInput")
    .value = "";
    alert("Name geändert zu: " + val);
}

function changePassword(){
    const val =
    document.getElementById("newPwInput").value;
    if(!val || val.length < 6){
        alert("Passwort: mind. 6 Zeichen!"); return;
    }
    accounts[currentUser.email].password = val;
    localStorage.setItem(
    "ut_accounts", JSON.stringify(accounts));
    document.getElementById("newPwInput").value = "";
    alert("Passwort gespeichert!");
}

function applyAnimations(on){
    localStorage.setItem(
    "ut_animations", on ? "on" : "off");
    document.body.classList.toggle(
    "no-animations", !on);
}

function applyTickerSetting(on){
    localStorage.setItem("ut_ticker", on ? "on" : "off");
    const bar = document.querySelector(".ticker-bar");
    if(!bar) return;
    if(on){
        bar.style.display = "";
        document.querySelector(".sidebar").style.marginTop = "";
        document.querySelector(".main").style.marginTop = "";
    } else {
        bar.style.display = "none";
        document.querySelector(".sidebar").style.marginTop = "0";
        document.querySelector(".main").style.marginTop = "0";
    }
}

function setAccentColor(color){
    localStorage.setItem("ut_accent", color);
    applyAccentColor(color);
}

function applyAccentColor(color){
    document.documentElement.style
    .setProperty("--accent", color);
}

function deleteAccount(){
    if(!confirm(
    "Account wirklich dauerhaft löschen? Das kann nicht rückgängig gemacht werden!"
    )) return;
    ["coins","gems","club","team",
    "coinLevel","xp","passLevel"]
    .forEach(k =>
    localStorage.removeItem(storageKey(k)));
    delete accounts[currentUser.email];
    localStorage.setItem(
    "ut_accounts", JSON.stringify(accounts));
    localStorage.removeItem("ut_session");
    location.reload();
}

// ======================
// MARKTPLATZ
// ======================

let offerPlayerIndex = null;

function openOfferModal(index){
    offerPlayerIndex = index;
    const p = club[index];
    document.getElementById("offerPlayerName")
    .textContent = p.name + " (" + p.rating + ")";
    document.getElementById("offerPrice")
    .value = p.price || 10000;
    document.getElementById("offerModal")
    .style.display = "flex";
}

function closeOfferModal(e){
    if(e && e.target !==
    document.getElementById("offerModal")) return;
    document.getElementById("offerModal")
    .style.display = "none";
}

function confirmOffer(){
    const price = parseInt(document.getElementById("offerPrice").value);
    if(!price || price < 1){ alert("Ungültiger Preis!"); return; }

    const player = club[offerPlayerIndex];
    const key = db.ref("marketplace").push().key;

    db.ref("marketplace/" + key).set({
        sellerEmail: currentUser.email,
        sellerName:  currentUser.name,
        player, price, id: key
    }).then(() => {
        club.splice(offerPlayerIndex, 1);
        saveData("club", JSON.stringify(club));
        document.getElementById("offerModal").style.display = "none";
        loadClub();
        alert(player.name + " wurde im Marktplatz angeboten!");
    });
}

function buyFromMarket(fbKey){
    db.ref("marketplace/" + fbKey).once("value").then(snap => {
        const listing = snap.val();
        if(!listing){ alert("Angebot nicht mehr verfügbar!"); loadShop("market"); return; }
        if(listing.sellerEmail === currentUser.email){
            alert("Du kannst deinen eigenen Spieler nicht kaufen!"); return;
        }
        if(coins < listing.price){ alert("Nicht genügend Coins!"); return; }

        coins -= listing.price;
        saveData("coins", coins);

        // Verkäufer Coins gutschreiben
        db.ref("accounts/" + encodeEmail(listing.sellerEmail) + "/coins")
          .transaction(c => (c || 0) + listing.price);

        club.push(listing.player);
        saveData("club", JSON.stringify(club));

        db.ref("marketplace/" + fbKey).remove();
        updateCurrency();
        loadShop("market");
        pushNotif("🛒", listing.player.name + " vom Marktplatz gekauft!");
        alert(listing.player.name + " gekauft!");
        questProgress("buy_shop");
        checkAllAchievements();
    });
}

function removeFromMarket(fbKey){
    db.ref("marketplace/" + fbKey).once("value").then(snap => {
        const listing = snap.val();
        if(!listing) return;
        club.push(listing.player);
        saveData("club", JSON.stringify(club));
        db.ref("marketplace/" + fbKey).remove();
        loadShop("market");
        alert(listing.player.name + " zurück in deinem Verein.");
    });
}

// ======================
// CHAT (Firebase Realtime)
// ======================

let currentChatKey = null;
let chatListener   = null;

function fbDmKey(emailA, emailB){
    return "dm_" + [encodeEmail(emailA), encodeEmail(emailB)].sort().join("___");
}

function openChat(){
    document.getElementById("chatModal").style.display = "flex";
    loadChatList();
}

function closeChatModal(e){
    if(e && e.target !== document.getElementById("chatModal")) return;
    document.getElementById("chatModal").style.display = "none";
    if(chatListener){ db.ref(currentChatKey).off("value", chatListener); chatListener = null; }
    currentChatKey = null;
}

function loadChatList(){
    db.ref("accounts").once("value").then(snap => {
        const all = snap.val() || {};
        const others = Object.values(all).filter(a => a.email !== currentUser.email);

        db.ref("groups").once("value").then(gSnap => {
            const allGroups = gSnap.val() || {};
            const myGroups = Object.entries(allGroups)
                .filter(([,g]) => g.members && g.members.includes(currentUser.email))
                .map(([id, g]) => ({...g, id}));

            let html = "";
            others.forEach(acc => {
                const key = "chat/" + fbDmKey(currentUser.email, acc.email);
                const isActive = currentChatKey === key;
                html += `<div class="cli ${isActive?"cli-active":""}"
                    onclick="openDM('${acc.email}','${acc.name}')">
                    <div class="cli-name">👤 ${acc.name}</div>
                    <div class="cli-last">Direktnachricht</div>
                </div>`;
            });

            myGroups.forEach(g => {
                const key = "chat/grp_" + g.id;
                const isActive = currentChatKey === key;
                html += `<div class="cli ${isActive?"cli-active":""}"
                    onclick="openGroupChat('${g.id}','${g.name}')">
                    <div class="cli-name">👥 ${g.name}</div>
                    <div class="cli-last">${(g.members||[]).length} Mitglieder</div>
                </div>`;
            });

            document.getElementById("chatListItems").innerHTML =
                html || '<p class="no-chats">Keine anderen Spieler.</p>';
        });
    });
}

function openDM(email, name){
    if(chatListener && currentChatKey)
        db.ref(currentChatKey).off("value", chatListener);
    currentChatKey = "chat/" + fbDmKey(currentUser.email, email);
    buildChatPanel("👤 " + name);
}

function openGroupChat(id, name){
    if(chatListener && currentChatKey)
        db.ref(currentChatKey).off("value", chatListener);
    currentChatKey = "chat/grp_" + id;
    buildChatPanel("👥 " + name);
}

function buildChatPanel(title){
    document.getElementById("chatPanel").innerHTML = `
    <div class="cp-header">${title}</div>
    <div class="cp-messages" id="chatMessages"></div>
    <div class="cp-input-row">
        <input id="chatInput" class="cp-input" placeholder="Nachricht…"
        onkeydown="if(event.key==='Enter')sendMsg()">
        <button class="cp-send" onclick="sendMsg()">➤</button>
    </div>`;

    // Echtzeit-Listener
    chatListener = db.ref(currentChatKey).on("value", snap => {
        const raw  = snap.val() || {};
        const msgs = Object.values(raw).sort((a,b) => a.ts - b.ts);
        const el   = document.getElementById("chatMessages");
        if(!el) return;
        el.innerHTML = msgs.map(m => `
        <div class="msg-wrap ${m.email === currentUser.email ? "msg-mine" : "msg-theirs"}">
            <div class="msg-from">${m.from}</div>
            <div class="msg-bubble">${m.text}</div>
            <div class="msg-time">${m.time}</div>
        </div>`).join("");
        el.scrollTop = el.scrollHeight;
    });

    loadChatList();
}

function sendMsg(){
    const input = document.getElementById("chatInput");
    if(!input || !input.value.trim() || !currentChatKey) return;
    db.ref(currentChatKey).push({
        from:  currentUser.name,
        email: currentUser.email,
        text:  input.value.trim(),
        time:  new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),
        ts:    Date.now()
    });
    input.value = "";
}

function showNewGroup(){
    db.ref("accounts").once("value").then(snap => {
        const all = snap.val() || {};
        const others = Object.values(all).filter(a => a.email !== currentUser.email);
        document.getElementById("groupMemberList").innerHTML = others.length > 0
            ? others.map(a => `<label class="member-check-label">
                <input type="checkbox" value="${a.email}"> ${a.name}</label>`).join("")
            : '<p style="opacity:.5">Keine anderen Spieler.</p>';
        document.getElementById("groupNameInput").value = "";
        document.getElementById("newGroupModal").style.display = "flex";
    });
}

function closeNewGroupModal(e){
    if(e && e.target !== document.getElementById("newGroupModal")) return;
    document.getElementById("newGroupModal").style.display = "none";
}

function createGroup(){
    const name = document.getElementById("groupNameInput").value.trim();
    if(!name){ alert("Gruppenname eingeben!"); return; }
    const checked = [...document.querySelectorAll("#groupMemberList input:checked")];
    if(checked.length === 0){ alert("Mindestens 1 Mitglied auswählen!"); return; }
    const members = [currentUser.email, ...checked.map(c => c.value)];
    const id = Date.now().toString(36);
    db.ref("groups/" + id).set({ id, name, members });
    closeNewGroupModal();
    openGroupChat(id, name);
}

// ======================
// FEHLER MELDEN
// ======================

function openReport(){
    document.getElementById("reportModal").style.display = "flex";
    document.getElementById("reportText").value = "";
    document.getElementById("reportSuccess").textContent = "";
}

function closeReport(e){
    if(e && e.target !== document.getElementById("reportModal")) return;
    document.getElementById("reportModal").style.display = "none";
}

function submitReport(){
    const type = document.getElementById("reportType").value;
    const text = document.getElementById("reportText").value.trim();
    if(!text){
        document.getElementById("reportSuccess").textContent = "Bitte Fehler beschreiben!";
        document.getElementById("reportSuccess").style.color = "#ff5555";
        return;
    }
    db.ref("reports").push({
        type, text,
        user: currentUser ? currentUser.name : "Anonym",
        time: new Date().toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
    });
    document.getElementById("reportSuccess").textContent = "✅ Bericht gesendet!";
    document.getElementById("reportSuccess").style.color = "#00e676";
    loadSidebarReports();
    setTimeout(() => document.getElementById("reportModal").style.display = "none", 1200);
}

function loadSidebarReports(){
    const container = document.getElementById("sidebarReports");
    if(!container) return;
    db.ref("reports").limitToLast(8).once("value").then(snap => {
        const raw = snap.val() || {};
        const reports = Object.values(raw).reverse();
        if(reports.length === 0){
            container.innerHTML = '<p class="no-reports">Keine Berichte.</p>';
            return;
        }
        container.innerHTML = reports.map(r => `
            <div class="sidebar-report-item">
                <span class="report-type-tag">${r.type}</span>
                <span class="report-item-text">${r.text.slice(0,40)}${r.text.length>40?"…":""}</span>
                <span class="report-item-meta">${r.user} · ${r.time}</span>
            </div>`).join("");
    });
}

// ======================
// WISSEN
// ======================

function openWissen(){
    document
    .getElementById("wissenModal")
    .style.display = "flex";
}

function closeWissen(e){
    if(e && e.target !== document
    .getElementById("wissenModal")) return;
    document
    .getElementById("wissenModal")
    .style.display = "none";
}

// ======================
// WÄHRUNG
// ======================

function updateCurrency(){

    document
    .getElementById(
    "coinsDisplay"
    )
    .innerHTML =
    "🪙 " +
    coins.toLocaleString(
    "de-DE"
    );

    document
    .getElementById(
    "gemsDisplay"
    )
    .innerHTML =
    "💎 " +
    gems.toLocaleString(
    "de-DE"
    );

    saveData("coins", coins);
    saveData("gems", gems);

}

// ======================
// COINS / SEKUNDE
// ======================

setInterval(()=>{

    coins +=
    40 * coinLevel;

    gems += 10;

    updateCurrency();

},1000);

// ======================
// NAVIGATION
// ======================

function openPage(page){

    document
    .querySelectorAll(".page")
    .forEach(p =>
    p.classList.remove(
    "active"
    ));

    document
    .getElementById(page)
    .classList.add(
    "active"
    );

    if(page === "home") updateStats();
    if(page === "leaderboard") loadLeaderboard();
    if(page === "settings") loadSettings();
    if(page === "training") loadTraining();
    if(page === "quests") loadQuests();
    if(page === "achievements") loadAchievements();
    if(page === "wheel") loadWheel();
    if(page === "home") updateRankBanner();

}

// ======================
// STATISTIKEN
// ======================

function updateStats(){

    const best = club.length > 0
    ? club.reduce((a,b) =>
        a.rating > b.rating ? a : b)
    : null;

    const teamOVR = team.length > 0
    ? Math.round(
        team.reduce((s,p) => s + p.rating, 0)
        / team.length)
    : 0;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    };

    set("st-coins",
        coins.toLocaleString("de-DE") + " 🪙");

    set("st-gems",
        gems.toLocaleString("de-DE") + " 💎");

    set("st-club", club.length + " Spieler");

    set("st-ovr", teamOVR || "—");

    set("st-best", best
        ? best.name + " (" + best.rating + ")"
        : "—");

    set("st-bronze",
        club.filter(p => p.rarity === "bronze").length);

    set("st-silver",
        club.filter(p => p.rarity === "silver").length);

    set("st-gold",
        club.filter(p => p.rarity === "gold").length);

    set("st-tots",
        club.filter(p => p.rarity === "tots").length);

    set("st-toty",
        club.filter(p => p.rarity === "toty").length);

    set("st-pass", "Level " + passLevel);

    set("st-boost", "Level " + coinLevel);
}// ======================
// SPIELERPOOL
// ======================

const players = [

// ── BRONZE ──
{name:"Bronze Talent",rating:65,rarity:"bronze",price:5000},
{name:"Junger Spieler",rating:68,rarity:"bronze",price:7000},
{name:"García",rating:60,rarity:"bronze",price:3000},
{name:"Mbaye",rating:60,rarity:"bronze",price:3000},
{name:"Holst",rating:60,rarity:"bronze",price:3000},
{name:"Bernauer",rating:61,rarity:"bronze",price:3200},
{name:"Petric",rating:61,rarity:"bronze",price:3200},
{name:"Scarlett",rating:61,rarity:"bronze",price:3200},
{name:"Niasse",rating:61,rarity:"bronze",price:3200},
{name:"Biereth",rating:62,rarity:"bronze",price:3500},
{name:"Okonkwo",rating:62,rarity:"bronze",price:3500},
{name:"Rutten",rating:62,rarity:"bronze",price:3500},
{name:"Konate R",rating:62,rarity:"bronze",price:3500},
{name:"Fleck",rating:63,rarity:"bronze",price:4000},
{name:"Diakite",rating:63,rarity:"bronze",price:4000},
{name:"Peretz",rating:63,rarity:"bronze",price:4000},
{name:"Mendes",rating:63,rarity:"bronze",price:4000},
{name:"Gomis",rating:63,rarity:"bronze",price:4000},
{name:"Laporte R",rating:63,rarity:"bronze",price:4000},
{name:"Delap",rating:64,rarity:"bronze",price:4500},
{name:"Bajric",rating:64,rarity:"bronze",price:4500},
{name:"Kaminski",rating:64,rarity:"bronze",price:4500},
{name:"Onyeka",rating:64,rarity:"bronze",price:4500},
{name:"Pafundi",rating:64,rarity:"bronze",price:4500},
{name:"Perez",rating:64,rarity:"bronze",price:4500},
{name:"Leko",rating:64,rarity:"bronze",price:4500},
{name:"Maja",rating:65,rarity:"bronze",price:5000},
{name:"Hutchinson",rating:65,rarity:"bronze",price:5000},
{name:"Telles",rating:65,rarity:"bronze",price:5000},
{name:"Daramy",rating:65,rarity:"bronze",price:5000},
{name:"Sildillia",rating:65,rarity:"bronze",price:5000},
{name:"Suslov",rating:65,rarity:"bronze",price:5000},
{name:"Selnaes",rating:65,rarity:"bronze",price:5000},
{name:"Billing",rating:66,rarity:"bronze",price:6000},
{name:"Caprari",rating:66,rarity:"bronze",price:6000},
{name:"Cantwell",rating:66,rarity:"bronze",price:6000},
{name:"Richards",rating:66,rarity:"bronze",price:6000},
{name:"Moriba",rating:66,rarity:"bronze",price:6000},
{name:"Diallo",rating:66,rarity:"bronze",price:6000},
{name:"Stach",rating:67,rarity:"bronze",price:6500},
{name:"Maupay",rating:67,rarity:"bronze",price:6500},
{name:"Vertessen",rating:67,rarity:"bronze",price:6500},
{name:"Diatta",rating:67,rarity:"bronze",price:6500},
{name:"Mangala",rating:67,rarity:"bronze",price:6500},
{name:"Rulli",rating:67,rarity:"bronze",price:6500},
{name:"Skov",rating:67,rarity:"bronze",price:6500},
{name:"Murphy",rating:67,rarity:"bronze",price:6500},
{name:"Borja",rating:68,rarity:"bronze",price:7000},
{name:"Kramaric",rating:68,rarity:"bronze",price:7000},
{name:"Duffy",rating:68,rarity:"bronze",price:7000},
{name:"Willock",rating:68,rarity:"bronze",price:7000},
{name:"Traore B",rating:68,rarity:"bronze",price:7000},
{name:"Sousa",rating:68,rarity:"bronze",price:7000},
{name:"Morrison",rating:68,rarity:"bronze",price:7000},
{name:"Llorente D",rating:68,rarity:"bronze",price:7000},
{name:"Ekwah",rating:69,rarity:"bronze",price:8000},
{name:"Doucouré",rating:69,rarity:"bronze",price:8000},
{name:"Campbell",rating:69,rarity:"bronze",price:8000},
{name:"Gosens",rating:69,rarity:"bronze",price:8000},
{name:"Longstaff",rating:69,rarity:"bronze",price:8000},
{name:"Mykolenko",rating:69,rarity:"bronze",price:8000},
{name:"Burn",rating:69,rarity:"bronze",price:8000},
{name:"Welbeck",rating:70,rarity:"bronze",price:9000},
{name:"Norgaard",rating:70,rarity:"bronze",price:9000},
{name:"Edouard",rating:70,rarity:"bronze",price:9000},
{name:"Musah",rating:70,rarity:"bronze",price:9000},
{name:"Piroe",rating:70,rarity:"bronze",price:9000},
{name:"Dunk",rating:70,rarity:"bronze",price:9000},
{name:"Weah",rating:70,rarity:"bronze",price:9000},
{name:"Mbemba",rating:70,rarity:"bronze",price:9000},
{name:"Sargent",rating:70,rarity:"bronze",price:9000},
{name:"Thorstvedt",rating:70,rarity:"bronze",price:9000},
{name:"Nketiah",rating:71,rarity:"bronze",price:10000},
{name:"Broja",rating:71,rarity:"bronze",price:10000},
{name:"Milik",rating:71,rarity:"bronze",price:10000},
{name:"Szymanski",rating:71,rarity:"bronze",price:10000},
{name:"Kjaer",rating:71,rarity:"bronze",price:10000},
{name:"Adams T",rating:71,rarity:"bronze",price:10000},
{name:"Livaja",rating:71,rarity:"bronze",price:10000},
{name:"Nzola",rating:71,rarity:"bronze",price:10000},
{name:"Vlasic",rating:72,rarity:"bronze",price:11000},
{name:"Awoniyi",rating:72,rarity:"bronze",price:11000},
{name:"Balogun",rating:72,rarity:"bronze",price:11000},
{name:"Beier",rating:72,rarity:"bronze",price:11000},
{name:"Summerville",rating:72,rarity:"bronze",price:11000},
{name:"Kerkez",rating:72,rarity:"bronze",price:11000},
{name:"Kebano",rating:72,rarity:"bronze",price:11000},
{name:"Shomurodov",rating:72,rarity:"bronze",price:11000},
{name:"Iheanacho",rating:73,rarity:"bronze",price:12000},
{name:"Morelos",rating:73,rarity:"bronze",price:12000},
{name:"Tete",rating:73,rarity:"bronze",price:12000},
{name:"El Bilal",rating:73,rarity:"bronze",price:12000},
{name:"Malen",rating:73,rarity:"bronze",price:12000},
{name:"Gallagher",rating:73,rarity:"bronze",price:12000},
{name:"McGinn",rating:73,rarity:"bronze",price:12000},
{name:"Pavlovic",rating:73,rarity:"bronze",price:12000},
{name:"Jota S",rating:73,rarity:"bronze",price:12000},
{name:"Mbeumo",rating:74,rarity:"bronze",price:13000},
{name:"Toney",rating:74,rarity:"bronze",price:13000},
{name:"Disasi",rating:74,rarity:"bronze",price:13000},
{name:"Guehi",rating:74,rarity:"bronze",price:13000},
{name:"Boniface",rating:74,rarity:"bronze",price:13000},
{name:"Tomori",rating:74,rarity:"bronze",price:13000},

// ── SILBER ──
{name:"Palmer",rating:80,rarity:"silver",price:25000},
{name:"Gavi",rating:82,rarity:"silver",price:30000},
{name:"Yamal",rating:83,rarity:"silver",price:35000},
{name:"Ziyech",rating:75,rarity:"silver",price:20000},
{name:"Tarkowski",rating:75,rarity:"silver",price:20000},
{name:"Doherty",rating:75,rarity:"silver",price:20000},
{name:"Daka",rating:75,rarity:"silver",price:20000},
{name:"Benteke",rating:75,rarity:"silver",price:20000},
{name:"Lingard",rating:75,rarity:"silver",price:20000},
{name:"Vardy",rating:75,rarity:"silver",price:20000},
{name:"Lukebakio",rating:76,rarity:"silver",price:22000},
{name:"Kean",rating:76,rarity:"silver",price:22000},
{name:"Soucek",rating:76,rarity:"silver",price:22000},
{name:"Martial",rating:76,rarity:"silver",price:22000},
{name:"Burak",rating:76,rarity:"silver",price:22000},
{name:"Nkunku",rating:76,rarity:"silver",price:22000},
{name:"Andersen J",rating:76,rarity:"silver",price:22000},
{name:"Zaha",rating:77,rarity:"silver",price:24000},
{name:"Giroud",rating:77,rarity:"silver",price:24000},
{name:"Morata",rating:77,rarity:"silver",price:24000},
{name:"Sancho",rating:77,rarity:"silver",price:24000},
{name:"Trippier",rating:77,rarity:"silver",price:24000},
{name:"Pulisic",rating:77,rarity:"silver",price:24000},
{name:"Coman",rating:77,rarity:"silver",price:24000},
{name:"Tielemans",rating:78,rarity:"silver",price:26000},
{name:"Ndidi",rating:78,rarity:"silver",price:26000},
{name:"Raya",rating:78,rarity:"silver",price:26000},
{name:"Locatelli",rating:78,rarity:"silver",price:26000},
{name:"Fabian Ruiz",rating:78,rarity:"silver",price:26000},
{name:"Mount",rating:78,rarity:"silver",price:26000},
{name:"Gusto",rating:78,rarity:"silver",price:26000},
{name:"Zielinski",rating:79,rarity:"silver",price:27000},
{name:"Pellegrini",rating:79,rarity:"silver",price:27000},
{name:"Olise",rating:79,rarity:"silver",price:27000},
{name:"Havertz",rating:79,rarity:"silver",price:27000},
{name:"Brandt",rating:79,rarity:"silver",price:27000},
{name:"Rashford",rating:79,rarity:"silver",price:27000},
{name:"Kessie",rating:79,rarity:"silver",price:27000},
{name:"Jesus",rating:80,rarity:"silver",price:30000},
{name:"Trossard",rating:80,rarity:"silver",price:30000},
{name:"White",rating:80,rarity:"silver",price:30000},
{name:"Isco",rating:80,rarity:"silver",price:30000},
{name:"Gnabry",rating:80,rarity:"silver",price:30000},
{name:"Grealish",rating:80,rarity:"silver",price:30000},
{name:"Brozovic",rating:80,rarity:"silver",price:30000},
{name:"Militao",rating:81,rarity:"silver",price:32000},
{name:"Upamecano",rating:81,rarity:"silver",price:32000},
{name:"Carvajal",rating:81,rarity:"silver",price:32000},
{name:"Laimer",rating:81,rarity:"silver",price:32000},
{name:"Stones",rating:81,rarity:"silver",price:32000},
{name:"Dumfries",rating:81,rarity:"silver",price:32000},
{name:"Kamada",rating:81,rarity:"silver",price:32000},
{name:"Martinelli",rating:82,rarity:"silver",price:34000},
{name:"James R",rating:82,rarity:"silver",price:34000},
{name:"Kimmich",rating:82,rarity:"silver",price:34000},
{name:"Theo H",rating:82,rarity:"silver",price:34000},
{name:"Rudiger",rating:82,rarity:"silver",price:34000},
{name:"Goretzka",rating:82,rarity:"silver",price:34000},
{name:"Coman B",rating:82,rarity:"silver",price:34000},
{name:"Rice",rating:83,rarity:"silver",price:36000},
{name:"Bruno F",rating:83,rarity:"silver",price:36000},
{name:"Saliba",rating:83,rarity:"silver",price:36000},
{name:"Muller",rating:83,rarity:"silver",price:36000},
{name:"Pavard",rating:83,rarity:"silver",price:36000},
{name:"Saka",rating:84,rarity:"silver",price:38000},
{name:"Foden",rating:84,rarity:"silver",price:38000},
{name:"Pedri",rating:84,rarity:"silver",price:38000},
{name:"Odegaard",rating:84,rarity:"silver",price:38000},
{name:"Son",rating:84,rarity:"silver",price:38000},
{name:"De Bruyne",rating:84,rarity:"silver",price:38000},
{name:"Modric",rating:84,rarity:"silver",price:38000},
{name:"Dembele",rating:84,rarity:"silver",price:38000},
{name:"Osimhen",rating:84,rarity:"silver",price:38000},
{name:"Thuram M",rating:83,rarity:"silver",price:36000},
{name:"Maguire",rating:75,rarity:"silver",price:20000},
{name:"Tomiyasu",rating:76,rarity:"silver",price:22000},
{name:"Schar",rating:75,rarity:"silver",price:20000},
{name:"Guimaraes",rating:82,rarity:"silver",price:34000},
{name:"Isak",rating:83,rarity:"silver",price:36000},
{name:"Cornet",rating:75,rarity:"silver",price:20000},
{name:"Sarr",rating:76,rarity:"silver",price:22000},
{name:"Vlahovic",rating:83,rarity:"silver",price:36000},
{name:"Tierney",rating:76,rarity:"silver",price:22000},
{name:"Doku",rating:81,rarity:"silver",price:32000},
{name:"Eze",rating:80,rarity:"silver",price:30000},
{name:"Madueke",rating:78,rarity:"silver",price:26000},
{name:"Neves",rating:79,rarity:"silver",price:27000},
{name:"Freuler",rating:77,rarity:"silver",price:24000},
{name:"Szoboszlai",rating:81,rarity:"silver",price:32000},
{name:"Diaz L",rating:82,rarity:"silver",price:34000},
{name:"Nuñez",rating:82,rarity:"silver",price:34000},
{name:"Mac Allister",rating:82,rarity:"silver",price:34000},
{name:"Gravenberch",rating:80,rarity:"silver",price:30000},
{name:"Van Dijk",rating:84,rarity:"silver",price:38000},
{name:"Robertson",rating:83,rarity:"silver",price:36000},
{name:"Alexander-Arnold",rating:84,rarity:"silver",price:38000},
{name:"Mane",rating:79,rarity:"silver",price:27000},
{name:"Fekir",rating:77,rarity:"silver",price:24000},
{name:"Carrasco",rating:77,rarity:"silver",price:24000},
{name:"Marcos L",rating:78,rarity:"silver",price:26000},
{name:"Kvaratskhelia",rating:84,rarity:"silver",price:38000},

// ── GOLD ──
{name:"Salah",rating:89,rarity:"gold",price:90000},
{name:"Wirtz",rating:91,rarity:"gold",price:120000},
{name:"Musiala",rating:92,rarity:"gold",price:150000},
{name:"Haaland",rating:92,rarity:"gold",price:170000},
{name:"Rodri",rating:88,rarity:"gold",price:85000},
{name:"Vinicius Jr",rating:89,rarity:"gold",price:95000},
{name:"Lautaro",rating:87,rarity:"gold",price:75000},
{name:"Benzema",rating:87,rarity:"gold",price:80000},
{name:"Lewandowski",rating:88,rarity:"gold",price:85000},
{name:"Casemiro",rating:85,rarity:"gold",price:65000},
{name:"Alisson",rating:86,rarity:"gold",price:70000},
{name:"Courtois",rating:87,rarity:"gold",price:78000},
{name:"Neuer",rating:85,rarity:"gold",price:65000},
{name:"Ter Stegen",rating:86,rarity:"gold",price:70000},
{name:"Ederson",rating:86,rarity:"gold",price:70000},
{name:"Marquinhos",rating:87,rarity:"gold",price:78000},
{name:"Dias R",rating:87,rarity:"gold",price:78000},
{name:"Laporte A",rating:85,rarity:"gold",price:65000},
{name:"Kante",rating:86,rarity:"gold",price:70000},
{name:"Valverde",rating:87,rarity:"gold",price:78000},
{name:"Tchouameni",rating:85,rarity:"gold",price:65000},
{name:"Camavinga",rating:85,rarity:"gold",price:65000},
{name:"Fernandes B",rating:86,rarity:"gold",price:70000},
{name:"Griezmann",rating:87,rarity:"gold",price:78000},
{name:"Neymar",rating:86,rarity:"gold",price:72000},
{name:"Suarez",rating:85,rarity:"gold",price:65000},
{name:"Firmino",rating:85,rarity:"gold",price:65000},
{name:"Diaz L Gold",rating:86,rarity:"gold",price:70000},
{name:"Mane Gold",rating:86,rarity:"gold",price:70000},
{name:"Zlatan",rating:85,rarity:"gold",price:65000},
{name:"Cavani",rating:85,rarity:"gold",price:65000},
{name:"Falcao",rating:85,rarity:"gold",price:65000},
{name:"Dybala",rating:86,rarity:"gold",price:70000},
{name:"Immobile",rating:86,rarity:"gold",price:70000},
{name:"Insigne",rating:85,rarity:"gold",price:65000},
{name:"Coutinho",rating:85,rarity:"gold",price:65000},
{name:"Nainggolan",rating:85,rarity:"gold",price:65000},
{name:"Jorginho",rating:85,rarity:"gold",price:65000},
{name:"Alaba",rating:86,rarity:"gold",price:70000},
{name:"Nacho",rating:85,rarity:"gold",price:65000},
{name:"Militao Gold",rating:87,rarity:"gold",price:78000},
{name:"Mendy T",rating:85,rarity:"gold",price:65000},
{name:"Kounde",rating:86,rarity:"gold",price:70000},
{name:"Araujo",rating:86,rarity:"gold",price:70000},
{name:"Christensen",rating:85,rarity:"gold",price:65000},
{name:"Busquets",rating:86,rarity:"gold",price:70000},
{name:"De Jong",rating:87,rarity:"gold",price:78000},
{name:"Alba",rating:85,rarity:"gold",price:65000},
{name:"Ferran T",rating:86,rarity:"gold",price:70000},
{name:"Raphinha",rating:87,rarity:"gold",price:78000},
{name:"Lewandowski G",rating:89,rarity:"gold",price:92000},
{name:"Vinicius G",rating:90,rarity:"gold",price:100000},
{name:"Modric Gold",rating:87,rarity:"gold",price:78000},
{name:"Kroos Gold",rating:87,rarity:"gold",price:78000},
{name:"Son Gold",rating:86,rarity:"gold",price:70000},
{name:"Saka Gold",rating:87,rarity:"gold",price:78000},
{name:"Foden Gold",rating:88,rarity:"gold",price:85000},
{name:"Pedri Gold",rating:87,rarity:"gold",price:78000},
{name:"Osimhen G",rating:87,rarity:"gold",price:78000},
{name:"Thuram G",rating:87,rarity:"gold",price:78000},
{name:"Dias B",rating:88,rarity:"gold",price:85000},
{name:"Saliba G",rating:87,rarity:"gold",price:78000},
{name:"Robertson G",rating:86,rarity:"gold",price:70000},
{name:"Trent G",rating:87,rarity:"gold",price:78000},
{name:"Van Dijk G",rating:88,rarity:"gold",price:85000},
{name:"Kvaratskhelia G",rating:88,rarity:"gold",price:85000},
{name:"Isak G",rating:87,rarity:"gold",price:78000},
{name:"Vlahovic G",rating:87,rarity:"gold",price:78000},
{name:"Nuñez G",rating:86,rarity:"gold",price:70000},
{name:"Szoboszlai G",rating:86,rarity:"gold",price:70000},
{name:"Mac Allister G",rating:87,rarity:"gold",price:78000},
{name:"Rice G",rating:88,rarity:"gold",price:85000},
{name:"Bruno G",rating:88,rarity:"gold",price:85000},
{name:"Diaz G2",rating:87,rarity:"gold",price:78000},
{name:"Goretzka G",rating:86,rarity:"gold",price:70000},
{name:"Kimmich G",rating:88,rarity:"gold",price:85000},
{name:"Theo G",rating:87,rarity:"gold",price:78000},
{name:"Rudiger G",rating:87,rarity:"gold",price:78000},
{name:"Odegaard G",rating:88,rarity:"gold",price:85000},
{name:"De Bruyne G",rating:90,rarity:"gold",price:100000},
{name:"Dembele G",rating:88,rarity:"gold",price:85000},
{name:"Griezmann G",rating:89,rarity:"gold",price:92000},
{name:"Mbappe",rating:93,rarity:"gold",price:250000,img:"bilder/mbappe.png"},
{name:"Ronaldo",rating:89,rarity:"gold",price:95000},
{name:"Messi",rating:93,rarity:"gold",price:250000},
{name:"Neymar G",rating:89,rarity:"gold",price:92000},
{name:"Benzema G",rating:89,rarity:"gold",price:92000},
{name:"Haland G",rating:94,rarity:"gold",price:300000},
{name:"Vini Gold",rating:91,rarity:"gold",price:120000},
{name:"Camavinga G",rating:87,rarity:"gold",price:78000},
{name:"Tchouameni G",rating:87,rarity:"gold",price:78000},
{name:"Valverde G",rating:89,rarity:"gold",price:92000},
{name:"Courtois G",rating:89,rarity:"gold",price:92000},
{name:"Alisson G",rating:88,rarity:"gold",price:85000},
{name:"Neuer G",rating:87,rarity:"gold",price:78000},
{name:"Marquinhos G",rating:89,rarity:"gold",price:92000},
{name:"Lautaro G",rating:89,rarity:"gold",price:92000},
{name:"Guimaraes G",rating:87,rarity:"gold",price:78000},
{name:"Carvajal G",rating:86,rarity:"gold",price:70000},
{name:"Militao G2",rating:88,rarity:"gold",price:85000},

// ── TOTS ──
{name:"Musiala TOTS",rating:96,rarity:"tots",price:500000},
{name:"Bellingham TOTS",rating:97,rarity:"tots",price:650000},
{name:"Salah TOTS",rating:93,rarity:"tots",price:300000},
{name:"Son TOTS",rating:93,rarity:"tots",price:300000},
{name:"Vinicius TOTS",rating:93,rarity:"tots",price:300000},
{name:"Saka TOTS",rating:93,rarity:"tots",price:300000},
{name:"Foden TOTS",rating:93,rarity:"tots",price:300000},
{name:"Griezmann TOTS",rating:93,rarity:"tots",price:300000},
{name:"Lautaro TOTS",rating:93,rarity:"tots",price:300000},
{name:"De Jong TOTS",rating:93,rarity:"tots",price:300000},
{name:"Kimmich TOTS",rating:93,rarity:"tots",price:300000},
{name:"Van Dijk TOTS",rating:93,rarity:"tots",price:300000},
{name:"Alisson TOTS",rating:93,rarity:"tots",price:300000},
{name:"Courtois TOTS",rating:93,rarity:"tots",price:300000},
{name:"Dembele TOTS",rating:93,rarity:"tots",price:300000},
{name:"Pedri TOTS",rating:93,rarity:"tots",price:300000},
{name:"Theo H TOTS",rating:93,rarity:"tots",price:300000},
{name:"Gnabry TOTS",rating:93,rarity:"tots",price:300000},
{name:"Stones TOTS",rating:93,rarity:"tots",price:300000},
{name:"Dumfries TOTS",rating:93,rarity:"tots",price:300000},
{name:"Laimer TOTS",rating:93,rarity:"tots",price:300000},
{name:"Haaland TOTS",rating:94,rarity:"tots",price:350000},
{name:"De Bruyne TOTS",rating:94,rarity:"tots",price:350000},
{name:"Benzema TOTS",rating:94,rarity:"tots",price:350000},
{name:"Lewandowski TOTS",rating:94,rarity:"tots",price:350000},
{name:"Modric TOTS",rating:94,rarity:"tots",price:350000},
{name:"Kroos TOTS",rating:94,rarity:"tots",price:350000},
{name:"Rodri TOTS",rating:94,rarity:"tots",price:350000},
{name:"Rashford TOTS",rating:94,rarity:"tots",price:350000},
{name:"Martinelli TOTS",rating:94,rarity:"tots",price:350000},
{name:"Rice TOTS",rating:94,rarity:"tots",price:350000},
{name:"Odegaard TOTS",rating:94,rarity:"tots",price:350000},
{name:"Kvaratskhelia TOTS",rating:94,rarity:"tots",price:350000},
{name:"Isak TOTS",rating:94,rarity:"tots",price:350000},
{name:"Vlahovic TOTS",rating:94,rarity:"tots",price:350000},
{name:"Mac Allister TOTS",rating:94,rarity:"tots",price:350000},
{name:"Diaz TOTS",rating:94,rarity:"tots",price:350000},
{name:"Nuñez TOTS",rating:94,rarity:"tots",price:350000},
{name:"Szoboszlai TOTS",rating:94,rarity:"tots",price:350000},
{name:"Havertz TOTS",rating:94,rarity:"tots",price:350000},
{name:"Bruno F TOTS",rating:94,rarity:"tots",price:350000},
{name:"Mount TOTS",rating:94,rarity:"tots",price:350000},
{name:"Gravenberch TOTS",rating:94,rarity:"tots",price:350000},
{name:"White TOTS",rating:94,rarity:"tots",price:350000},
{name:"Mbappe TOTS",rating:95,rarity:"tots",price:400000,img:"bilder/mbappe.png"},
{name:"Osimhen TOTS",rating:95,rarity:"tots",price:400000},
{name:"Thuram TOTS",rating:95,rarity:"tots",price:400000},
{name:"Goretzka TOTS",rating:95,rarity:"tots",price:400000},
{name:"Rudiger TOTS",rating:95,rarity:"tots",price:400000},
{name:"Marquinhos TOTS",rating:95,rarity:"tots",price:400000},
{name:"Valverde TOTS",rating:95,rarity:"tots",price:400000},
{name:"Camavinga TOTS",rating:95,rarity:"tots",price:400000},
{name:"Tchouameni TOTS",rating:95,rarity:"tots",price:400000},
{name:"Vini Jr TOTS",rating:95,rarity:"tots",price:400000},
{name:"Guimaraes TOTS",rating:95,rarity:"tots",price:400000},
{name:"Saliba TOTS",rating:95,rarity:"tots",price:400000},
{name:"Trent TOTS",rating:95,rarity:"tots",price:400000},
{name:"Robertson TOTS",rating:95,rarity:"tots",price:400000},
{name:"Dias TOTS",rating:95,rarity:"tots",price:400000},
{name:"Militao TOTS",rating:95,rarity:"tots",price:400000},
{name:"Carvajal TOTS",rating:95,rarity:"tots",price:400000},
{name:"Neymar TOTS",rating:95,rarity:"tots",price:400000},
{name:"Dybala TOTS",rating:95,rarity:"tots",price:400000},
{name:"Ronaldinho TOTS",rating:95,rarity:"tots",price:400000},
{name:"Kaka TOTS",rating:95,rarity:"tots",price:400000},
{name:"Totti TOTS",rating:95,rarity:"tots",price:400000},
{name:"Del Piero TOTS",rating:95,rarity:"tots",price:400000},
{name:"Shevchenko TOTS",rating:95,rarity:"tots",price:400000},
{name:"Olise TOTS",rating:95,rarity:"tots",price:400000},
{name:"Doku TOTS",rating:95,rarity:"tots",price:400000},
{name:"Wirtz TOTS",rating:96,rarity:"tots",price:450000},
{name:"Ronaldo TOTS",rating:96,rarity:"tots",price:450000},
{name:"Messi TOTS",rating:96,rarity:"tots",price:450000},
{name:"Ramos TOTS",rating:96,rarity:"tots",price:450000},
{name:"Neuer TOTS",rating:96,rarity:"tots",price:450000},
{name:"Xavi TOTS",rating:96,rarity:"tots",price:450000},
{name:"Iniesta TOTS",rating:96,rarity:"tots",price:450000},
{name:"Henry TOTS",rating:96,rarity:"tots",price:450000},
{name:"Zidane TOTS",rating:96,rarity:"tots",price:450000},
{name:"Ribery TOTS",rating:96,rarity:"tots",price:450000},
{name:"Robben TOTS",rating:96,rarity:"tots",price:450000},
{name:"Muller TOTS",rating:96,rarity:"tots",price:450000},
{name:"Lahm TOTS",rating:96,rarity:"tots",price:450000},
{name:"Ibrahimovic TOTS",rating:96,rarity:"tots",price:450000},
{name:"Rooney TOTS",rating:96,rarity:"tots",price:450000},
{name:"Gerrard TOTS",rating:96,rarity:"tots",price:450000},
{name:"Lampard TOTS",rating:96,rarity:"tots",price:450000},
{name:"Pogba TOTS",rating:97,rarity:"tots",price:500000},
{name:"Hazard TOTS",rating:97,rarity:"tots",price:500000},
{name:"Suarez TOTS",rating:97,rarity:"tots",price:500000},
{name:"Firmino TOTS",rating:97,rarity:"tots",price:500000},
{name:"Drogba TOTS",rating:97,rarity:"tots",price:500000},

// ── TOTY ──
{name:"Mbappé TOTY",rating:99,rarity:"toty",price:1500000,img:"bilder/mbappe.png"},
{name:"Messi TOTY",rating:97,rarity:"toty",price:800000},
{name:"Ronaldo TOTY",rating:97,rarity:"toty",price:800000},
{name:"Salah TOTY",rating:97,rarity:"toty",price:800000},
{name:"Haaland TOTY",rating:97,rarity:"toty",price:800000},
{name:"De Bruyne TOTY",rating:97,rarity:"toty",price:800000},
{name:"Modric TOTY",rating:97,rarity:"toty",price:800000},
{name:"Vinicius TOTY",rating:97,rarity:"toty",price:800000},
{name:"Rodri TOTY",rating:97,rarity:"toty",price:800000},
{name:"Musiala TOTY",rating:97,rarity:"toty",price:800000},
{name:"Wirtz TOTY",rating:97,rarity:"toty",price:800000},
{name:"Bellingham TOTY",rating:97,rarity:"toty",price:800000},
{name:"Son TOTY",rating:97,rarity:"toty",price:800000},
{name:"Foden TOTY",rating:97,rarity:"toty",price:800000},
{name:"Saka TOTY",rating:97,rarity:"toty",price:800000},
{name:"Pedri TOTY",rating:97,rarity:"toty",price:800000},
{name:"Kimmich TOTY",rating:97,rarity:"toty",price:800000},
{name:"Van Dijk TOTY",rating:97,rarity:"toty",price:800000},
{name:"Dias TOTY",rating:97,rarity:"toty",price:800000},
{name:"Courtois TOTY",rating:97,rarity:"toty",price:800000},
{name:"Alisson TOTY",rating:97,rarity:"toty",price:800000},
{name:"Rice TOTY",rating:97,rarity:"toty",price:800000},
{name:"Odegaard TOTY",rating:97,rarity:"toty",price:800000},
{name:"Kvaratskhelia TOTY",rating:97,rarity:"toty",price:800000},
{name:"Lautaro TOTY",rating:97,rarity:"toty",price:800000},
{name:"Lewandowski TOTY",rating:97,rarity:"toty",price:800000},
{name:"Benzema TOTY",rating:97,rarity:"toty",price:800000},
{name:"Neymar TOTY",rating:97,rarity:"toty",price:800000},
{name:"Dembele TOTY",rating:97,rarity:"toty",price:800000},
{name:"Griezmann TOTY",rating:97,rarity:"toty",price:800000},
{name:"Camavinga TOTY",rating:97,rarity:"toty",price:800000},
{name:"Valverde TOTY",rating:97,rarity:"toty",price:800000},
{name:"Tchouameni TOTY",rating:97,rarity:"toty",price:800000},
{name:"Marquinhos TOTY",rating:97,rarity:"toty",price:800000},
{name:"Theo H TOTY",rating:97,rarity:"toty",price:800000},
{name:"Carvajal TOTY",rating:97,rarity:"toty",price:800000},
{name:"Neuer TOTY",rating:97,rarity:"toty",price:800000},
{name:"Thuram TOTY",rating:97,rarity:"toty",price:800000},
{name:"Osimhen TOTY",rating:97,rarity:"toty",price:800000},
{name:"Guimaraes TOTY",rating:97,rarity:"toty",price:800000},
{name:"Saliba TOTY",rating:97,rarity:"toty",price:800000},
{name:"Zidane TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Ronaldinho TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Kaka TOTY",rating:98,rarity:"toty",price:1200000},
{name:"R9 TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Beckham TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Henry TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Rivaldo TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Figo TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Roberto Carlos TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Cafu TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Seedorf TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Totti TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Del Piero TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Maldini TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Cannavaro TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Buffon TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Shevchenko TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Ibrahimovic TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Xavi TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Iniesta TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Gerrard TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Lampard TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Rooney TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Ramos TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Pique TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Drogba TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Eto'o TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Adriano TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Nedved TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Puyol TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Lahm TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Ballack TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Raul TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Owen TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Cole A TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Scholes TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Giggs TOTY",rating:98,rarity:"toty",price:1200000},
{name:"Pele TOTY",rating:99,rarity:"toty",price:2000000,img:"bilder/pele.png"},
{name:"Maradona TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Cruyff TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Di Stefano TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Platini TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Gullit TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Van Basten TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Stoichkov TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Baggio TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Puskas TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Eusebio TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Best G TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Garrincha TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Beckenbauer TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Yashin TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Zico TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Romario TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Ronaldo 99 TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Messi 99 TOTY",rating:99,rarity:"toty",price:2000000},
{name:"Mbappe 99 TOTY",rating:99,rarity:"toty",price:2000000,img:"bilder/mbappe.png"},
{name:"Jindaui",rating:100,rarity:"toty",price:200000000,img:"bilder/jindaui.png"}

];

// ======================
// SPIELERBILD
// ======================

function playerImg(player){
    if(!player.img) return '';
    return `<img class="card-img" src="${player.img}" alt="${player.name}">`;
}

// ======================
// PACKS
// ======================

const packPrices = {

bronze:1000,
silver:2500,
gold:5000,
tots:10000,
toty:20000

};

function openPack(type){

    const price =
    packPrices[type];

    if(coins < price){

        alert(
        "Nicht genügend Coins!"
        );

        return;
    }

    coins -= price;

    updateCurrency();

    const pool =
    players.filter(
    p => p.rarity === type &&
    !club.some(c => c.name === p.name)
    );

    if(pool.length === 0){

        coins += price;

        updateCurrency();

        alert(
        "Du besitzt bereits alle " +
        type.toUpperCase() +
        " Spieler!"
        );

        return;
    }

    const player =
    pool[
    Math.floor(
    Math.random() *
    pool.length
    )
    ];

    club.push(player);

    saveData("club", JSON.stringify(club));

    const po = parseInt(loadData("packsOpened")||0)+1;
    saveData("packsOpened", po);
    questProgress("open_pack");
    checkAllAchievements();

    addXP(50);

    // TOTY Effekt

    if(type === "toty"){

        document.body.style.transition =
        ".3s";

        document.body.style.boxShadow =
        "inset 0 0 200px #00d4ff";

        setTimeout(()=>{

            document.body.style.boxShadow =
            "none";

        },1500);
    }

    document
    .getElementById(
    "packResult"
    )
    .innerHTML = `

    <div class="player-card ${player.rarity} ${player.img ? 'has-img' : ''}">

        <div class="player-rating">
            ${player.rating}
        </div>

        ${playerImg(player)}

        <div class="player-name">
            ${player.name}
        </div>

    </div>

    `;
}

// ======================
// VEREIN
// ======================

function getSellPrice(rating){

    return rating * 1000;

}

function loadClub(){

const container =
document.getElementById(
"clubContainer"
);

container.innerHTML = "";

club.forEach((player,index)=>{

container.innerHTML += `

<div class="club-card ${player.rarity} ${player.img ? 'has-img' : ''}">

    <div class="player-rating">
        ${player.rating}
    </div>

    ${playerImg(player)}

    <div class="player-name">
        ${player.name}
    </div>

    <p>
    💰 ${getSellPrice(player.rating)}
    </p>

    <button
    class="sell-btn"
    onclick="sellPlayer(${index})">
    Verkaufen
    </button>

    <button
    class="offer-btn"
    onclick="openOfferModal(${index})">
    🏪 Anbieten
    </button>

    <button
    class="buy-btn"
    onclick="addToTeam(${index})">
    Team
    </button>

</div>

`;

});

}

// ======================
// VERKAUFEN
// ======================

function sellPlayer(index){

const player =
club[index];

coins +=
getSellPrice(
player.rating
);

club.splice(index,1);

saveData("club", JSON.stringify(club));
questProgress("sell_player");
updateCurrency();

loadClub();

}

// ======================
// TEAM
// ======================

function addToTeam(index){

const player = club[index];

if(team.length >= 11){

alert(
"Maximal 11 Spieler!"
);

return;
}

if(team.some(p => p.name === player.name)){

alert(
player.name + " ist bereits im Team!"
);

return;
}

team.push(player);

saveData("team", JSON.stringify(team));

loadTeam();

}

function loadTeam(){

const container =
document.getElementById(
"teamContainer"
);

container.innerHTML = "";

team.forEach((player,index)=>{

container.innerHTML += `

<div class="club-card ${player.rarity} ${player.img ? 'has-img' : ''}">

    <div class="player-rating">
        ${player.rating}
    </div>

    ${playerImg(player)}

    <div class="player-name">
        ${player.name}
    </div>

    <button
    class="sell-btn"
    onclick="removeFromTeam(${index})">

    Entfernen

    </button>

</div>

`;

});

calculateOVR();

}

function removeFromTeam(index){

team.splice(index,1);

saveData("team", JSON.stringify(team));

loadTeam();

}

// ======================
// TEAM OVR
// ======================

function calculateOVR(){

if(team.length === 0){

document.getElementById(
"teamOVR"
).innerHTML =
"⭐ Team OVR: 0";

return;
}

let total = 0;

team.forEach(player=>{

total += player.rating;

});

const ovr =
Math.round(
total / team.length
);

document.getElementById(
"teamOVR"
).innerHTML =
"⭐ Team OVR: " + ovr;

}

// ======================
// SHOP
// ======================

function loadShop(tab){

const container =
document.getElementById("shopContainer");

if(!container) return;

const activeTab = tab || "fix";

const isVip = loadData("vip") === "1";
const today = new Date().toISOString().slice(0,10);
const lastClaim = loadData("vip_lastclaim") || "";
const canClaim = isVip && lastClaim !== today;

container.innerHTML = `

<div class="vip-banner ${isVip ? "vip-active" : ""}">
    <div class="vip-banner-left">
        <div class="vip-crown">👑</div>
        <div>
            <div class="vip-banner-title">VIP Mitgliedschaft</div>
            <div class="vip-banner-desc">
                ${isVip
                ? "✅ Du bist VIP — 3 TOTY Packs täglich!"
                : "3 TOTY Packs jeden Tag · Kosten: 3.000.000 💎"}
            </div>
        </div>
    </div>
    <div class="vip-banner-right">
        ${isVip
        ? (canClaim
            ? `<button class="vip-claim-btn" onclick="claimDailyPacks()">
               🎁 Tägliche Packs abholen!</button>`
            : `<span class="vip-claimed">✔ Heute abgeholt</span>`)
        : `<button class="vip-buy-btn" onclick="buyVIP()">
           Kaufen · 3.000.000 💎</button>`}
    </div>
</div>

<div class="shop-tabs" style="margin-top:20px">
    <button class="shop-tab ${activeTab==="fix"?"shop-tab-active":""}"
    onclick="loadShop('fix')">🏬 Spieler Shop</button>
    <button class="shop-tab ${activeTab==="market"?"shop-tab-active":""}"
    onclick="loadShop('market')">🏪 Marktplatz</button>
</div>
<div id="shopItems" style="display:flex;flex-wrap:wrap;gap:20px;margin-top:20px"></div>
`;

const itemsEl =
document.getElementById("shopItems");

if(activeTab === "fix"){

    players.forEach(player=>{
        itemsEl.innerHTML += `
        <div class="club-card ${player.rarity} ${player.img?"has-img":""}">
            <div class="player-rating">${player.rating}</div>
            ${playerImg(player)}
            <div class="player-name">${player.name}</div>
            <p>💰 ${player.price.toLocaleString("de-DE")}</p>
            <button class="buy-btn"
            onclick="buyPlayer('${player.name}')">Kaufen</button>
        </div>`;
    });

} else {

    loadMarketplace(itemsEl);
}
}

function loadMarketplace(container){
    container.innerHTML = '<p style="opacity:.5;margin-top:20px">⏳ Lade Marktplatz…</p>';
    db.ref("marketplace").once("value").then(snap => {
        const raw = snap.val() || {};
        const listings = Object.entries(raw).map(([key, val]) => ({...val, fbKey: key}));
        if(listings.length === 0){
            container.innerHTML = '<p style="opacity:.5;margin-top:20px;font-size:16px">Noch keine Angebote im Marktplatz.</p>';
            return;
        }
        container.innerHTML = "";
        listings.forEach(listing => {
            const p = listing.player;
            const isMine = listing.sellerEmail === currentUser.email;
            container.innerHTML += `
            <div class="club-card ${p.rarity} ${p.img?"has-img":""}">
                <div class="player-rating">${p.rating}</div>
                ${playerImg(p)}
                <div class="player-name">${p.name}</div>
                <p style="font-size:12px;opacity:.6">von ${listing.sellerName}</p>
                <p>💰 ${listing.price.toLocaleString("de-DE")}</p>
                ${isMine
                ? `<button class="sell-btn" onclick="removeFromMarket('${listing.fbKey}')">❌ Zurückziehen</button>`
                : `<button class="buy-btn" onclick="buyFromMarket('${listing.fbKey}')">Kaufen</button>`}
            </div>`;
        });
    });
}

function buyPlayer(name){

const player =
players.find(
p => p.name === name
);

if(!player) return;

if(coins < player.price){

alert(
"Nicht genügend Coins!"
);

return;
}

coins -= player.price;

club.push(player);

saveData("club", JSON.stringify(club));

updateCurrency();

alert(
player.name +
" gekauft!"
);

}

// ======================
// UPGRADES
// ======================

function buyCoinUpgrade(){

const cost =
100000 *
coinLevel;

if(coins < cost){

alert(
"Nicht genügend Coins!"
);

return;
}

coins -= cost;

coinLevel++;

saveData("coinLevel", coinLevel);

updateCurrency();

alert(
"Coin Level " +
coinLevel
);

}

// ======================
// SAISONPASS
// ======================

function updatePass(){

const passLevelEl =
document.getElementById("passLevel");

const passXPEl =
document.getElementById("passXP");

const passXPFill =
document.getElementById("passXPFill");

const rewards =
document.getElementById("passRewards");

if(passLevelEl)
passLevelEl.innerHTML = "Level " + passLevel;

if(passXPEl)
passXPEl.innerHTML =
"XP: " + xp + " / 1000";

if(passXPFill)
passXPFill.style.width =
(xp / 1000 * 100) + "%";

if(!rewards) return;

rewards.innerHTML = "";

for(let i = 1; i <= 10; i++){

const unlocked = i <= passLevel;

rewards.innerHTML += `
<div class="pass-reward ${unlocked ? 'unlocked' : 'locked'}">
    Level ${i} &nbsp; ${unlocked ? '✅' : '🔒'} &nbsp;
    ${(i * 10000).toLocaleString("de-DE")} Coins
</div>
`;

}

}

// ======================
// SPIEL SIMULATION
// ======================

function simulateMatch(){

if(team.length === 0){

alert("Stelle zuerst ein Team auf!");

return;

}

const teamOVR =
Math.round(
team.reduce((s,p) => s + p.rating, 0) /
team.length
);

const oppOVR =
Math.floor(Math.random() * 36) + 60;

const diff = teamOVR - oppOVR;

const winChance =
Math.min(0.85,
Math.max(0.15, 0.5 + diff * 0.025)
);

const rand = Math.random();

let result, myGoals, oppGoals,
coinsWon, xpWon;

if(rand < winChance){

myGoals =
Math.floor(Math.random() * 4) + 1;

oppGoals =
Math.floor(Math.random() * myGoals);

result = "Sieg";
coinsWon = 5000;
xpWon = 100;
const wins = parseInt(loadData("wins")||0)+1;
saveData("wins", wins);
questProgress("win_match");
checkAllAchievements();

} else if(rand < winChance + 0.15){

myGoals =
Math.floor(Math.random() * 4);

oppGoals = myGoals;

result = "Unentschieden";
coinsWon = 2000;
xpWon = 50;

} else {

oppGoals =
Math.floor(Math.random() * 4) + 1;

myGoals =
Math.floor(Math.random() * oppGoals);

result = "Niederlage";
coinsWon = 500;
xpWon = 20;

}

coins += coinsWon;
updateCurrency();
addXP(xpWon);

const cls =
result === "Sieg" ? "win" :
result === "Niederlage" ? "loss" : "draw";

const emoji =
result === "Sieg" ? "🏆" :
result === "Niederlage" ? "😞" : "🤝";

document.getElementById("matchResult")
.innerHTML = `
<div class="match-result ${cls}">
    <h2>${emoji} ${result}!</h2>
    <div class="score">${myGoals} : ${oppGoals}</div>
    <p>Dein OVR: <strong>${teamOVR}</strong>
    &nbsp;vs&nbsp; Gegner: <strong>${oppOVR}</strong></p>
    <p style="margin-top:12px;font-size:20px">
        +${coinsWon.toLocaleString("de-DE")} 🪙
        &nbsp;&nbsp;+${xpWon} XP
    </p>
</div>
`;

}

// ======================
// RESET
// ======================

function resetGame(){

if(!confirm(
"Wirklich alles zurücksetzen? Dein Account bleibt erhalten."
)){
return;
}

["coins","gems","club","team",
"coinLevel","xp","passLevel"]
.forEach(k =>
localStorage.removeItem(storageKey(k))
);

location.reload();

}

// ======================
// ERWEITERTE NAVIGATION
// ======================

const oldOpenPage = openPage;

openPage = function(page){

oldOpenPage(page);

if(page === "club")
loadClub();

if(page === "team")
loadTeam();

if(page === "shop")
loadShop();

if(page === "leaderboard")
loadLeaderboard();

if(page === "pass")
updatePass();

};function addXP(amount){

xp += amount;

while(xp >= 1000){

xp -= 1000;

passLevel++;

pushNotif("🎟️", "Saisonpass Level " + passLevel + " erreicht! +10.000 Coins");

coins += 10000;

}

saveData("xp", xp);
saveData("passLevel", passLevel);

updatePass();

}