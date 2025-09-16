"use strict";

(function () {
  const provider = window.solana && window.solana.isPhantom ? window.solana : null;

  const els = {
    connectWalletButton: document.getElementById("connectWalletButton"),
    walletStatus: document.getElementById("walletStatus"),
    connectChatButton: document.getElementById("connectChatButton"),
    simulateChatToggle: document.getElementById("simulateChatToggle"),
    chatMessages: document.getElementById("chatMessages"),
    chatInput: document.getElementById("chatInput"),
    sendChatButton: document.getElementById("sendChatButton"),
    joinBetInput: document.getElementById("joinBetInput"),
    joinRaceButton: document.getElementById("joinRaceButton"),
    potTotal: document.getElementById("potTotal"),
    playersCount: document.getElementById("playersCount"),
    startRaceButton: document.getElementById("startRaceButton"),
    raceStatus: document.getElementById("raceStatus"),
    leaderboardList: document.getElementById("leaderboardList"),
    canvas: document.getElementById("raceCanvas"),
  };

  const state = {
    walletPublicKey: null,
    chatConnected: false,
    simulateChat: true,
    participants: [],
    nameToIndex: new Map(),
    potSol: 0,
    raceState: "waiting", // waiting | countdown | racing | finished
    countdownEndsAt: 0,
    finishedOrder: [],
    animationFrameId: 0,
    lastFrameTime: 0,
    chatSimTimer: null,
  };

  const ctx = els.canvas.getContext("2d");
  const CANVAS = { width: els.canvas.width, height: els.canvas.height };
  const MARGINS = { left: 60, right: 60, top: 40, bottom: 40 };

  function getRandomPastelColor() {
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.random() * 20;
    const l = 55 + Math.random() * 12;
    return `hsl(${h} ${s}% ${l}%)`;
  }

  function shortenAddress(addr) {
    if (!addr) return "Not connected";
    return addr.slice(0, 4) + "…" + addr.slice(-4);
  }

  function formatSol(n) {
    return (Math.round(n * 1000) / 1000).toFixed(3);
  }

  function updateWalletUI() {
    if (state.walletPublicKey) {
      els.connectWalletButton.textContent = "Connected";
      els.walletStatus.textContent = shortenAddress(state.walletPublicKey);
      els.connectWalletButton.classList.add("primary");
    } else {
      els.connectWalletButton.textContent = "Connect Wallet";
      els.walletStatus.textContent = "Not connected";
      els.connectWalletButton.classList.add("primary");
    }
  }

  async function connectWallet() {
    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    try {
      const res = await provider.connect({ onlyIfTrusted: false });
      const pk = res.publicKey ? res.publicKey.toString() : provider.publicKey?.toString();
      state.walletPublicKey = pk || null;
    } catch (e) {
      // ignore user rejection
    } finally {
      updateWalletUI();
    }
  }

  function pushChatMessage(name, text) {
    const row = document.createElement("div");
    row.className = "chat-message";
    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = name + ":";
    const textEl = document.createElement("span");
    textEl.className = "text";
    textEl.textContent = " " + text;
    row.appendChild(nameEl);
    row.appendChild(textEl);
    els.chatMessages.appendChild(row);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function parseChatCommand(name, text) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("!")) return false;
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    if (cmd === "!join" && parts[1]) {
      const amt = parseFloat(parts[1]);
      if (!isNaN(amt) && amt > 0) {
        addParticipant(name, amt);
        return true;
      }
    }
    return false;
  }

  function addParticipant(name, betSol) {
    if (state.raceState !== "waiting") return false;
    const amt = Math.max(0, betSol || 0);
    if (!name || amt <= 0) return false;

    if (state.nameToIndex.has(name)) {
      const idx = state.nameToIndex.get(name);
      state.participants[idx].betSol += amt;
    } else {
      const p = {
        id: "p_" + (state.participants.length + 1),
        name,
        betSol: amt,
        color: getRandomPastelColor(),
        progress: 0,
        baseSpeed: 0.0025 + Math.random() * 0.0035,
        noisePhase: Math.random() * Math.PI * 2,
        finished: false,
        finishTime: 0,
      };
      state.nameToIndex.set(name, state.participants.length);
      state.participants.push(p);
    }

    state.potSol += amt;
    els.potTotal.textContent = `${formatSol(state.potSol)} SOL`;
    els.playersCount.textContent = String(state.participants.length);
    return true;
  }

  function clearLeaderboard() {
    els.leaderboardList.innerHTML = "";
  }

  function updateLeaderboard(order) {
    els.leaderboardList.innerHTML = "";
    order.slice(0, 10).forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${p.name} — ${formatSol(p.betSol)} SOL`;
      els.leaderboardList.appendChild(li);
    });
  }

  function setRaceStatus(text) {
    els.raceStatus.textContent = text;
  }

  function startCountdown() {
    state.raceState = "countdown";
    state.countdownEndsAt = performance.now() + 3000;
    setRaceStatus("Starting in 3…");
  }

  function startRace() {
    if (state.raceState === "racing") return;
    if (state.participants.length < 2) {
      const bots = ["Luna", "Orion", "Nova", "Atlas", "Pixel", "Rift", "Echo", "Zara", "Flux", "Kairo"]; 
      for (let i = 0; i < 6; i++) {
        const name = bots[i % bots.length] + "_bot" + Math.floor(Math.random() * 100);
        const amt = 0.005 + Math.random() * 0.02;
        addParticipant(name, amt);
      }
    }
    clearLeaderboard();
    state.finishedOrder = [];
    state.participants.forEach(p => { p.progress = 0; p.finished = false; p.finishTime = 0; p.baseSpeed = 0.0025 + Math.random() * 0.0035; p.noisePhase = Math.random() * Math.PI * 2; });
    startCountdown();
  }

  function finishRace() {
    state.raceState = "finished";
    const order = state.finishedOrder.slice();
    if (order.length > 0) {
      setRaceStatus(`Finished! Winner: ${order[0].name}`);
    } else {
      setRaceStatus("Finished!");
    }
    updateLeaderboard(order);
  }

  function renderBackground() {
    const w = CANVAS.width, h = CANVAS.height;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#0e1522");
    grd.addColorStop(1, "#0b1018");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    const lanes = Math.max(8, state.participants.length);
    const trackTop = MARGINS.top;
    const trackBottom = h - MARGINS.bottom;
    const trackHeight = trackBottom - trackTop;
    const laneH = trackHeight / lanes;
    for (let i = 0; i <= lanes; i++) {
      const y = trackTop + i * laneH;
      ctx.beginPath();
      ctx.moveTo(MARGINS.left, y);
      ctx.lineTo(w - MARGINS.right, y);
      ctx.stroke();
    }
    // start/finish
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(124,92,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(MARGINS.left, trackTop);
    ctx.lineTo(MARGINS.left, trackBottom);
    ctx.stroke();
    ctx.strokeStyle = "rgba(30,200,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(w - MARGINS.right, trackTop);
    ctx.lineTo(w - MARGINS.right, trackBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function renderMarbles(now) {
    const w = CANVAS.width, h = CANVAS.height;
    const lanes = Math.max(8, state.participants.length);
    const trackTop = MARGINS.top;
    const trackBottom = h - MARGINS.bottom;
    const trackHeight = trackBottom - trackTop;
    const laneH = trackHeight / lanes;
    const startX = MARGINS.left + 10;
    const finishX = w - MARGINS.right - 10;

    for (let i = 0; i < state.participants.length; i++) {
      const p = state.participants[i];
      const laneCenterY = trackTop + laneH * (i + 0.5);
      const sizeBonus = Math.min(p.betSol * 40, 10);
      const r = 10 + sizeBonus;
      const x = startX + p.progress * (finishX - startX);

      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8;
      ctx.arc(x, laneCenterY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "12px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "center";
      ctx.fillText(p.name, x, laneCenterY - r - 6);
      ctx.restore();
    }
  }

  function stepRacing(dt, now) {
    const w = CANVAS.width;
    const startX = MARGINS.left + 10;
    const finishX = w - MARGINS.right - 10;
    let remaining = 0;

    for (let i = 0; i < state.participants.length; i++) {
      const p = state.participants[i];
      if (p.finished) continue;
      remaining++;
      const noise = Math.sin(p.noisePhase + now * 0.004 + i) * 0.0008;
      p.progress += p.baseSpeed + noise;
      if (p.progress < 0) p.progress = 0;
      if (p.progress >= 1) {
        p.progress = 1;
        p.finished = true;
        p.finishTime = now;
        state.finishedOrder.push(p);
      }
    }

    if (remaining === 0) {
      finishRace();
    }
  }

  function renderOverlay(now) {
    if (state.raceState === "countdown") {
      const msLeft = Math.max(0, state.countdownEndsAt - now);
      const sec = Math.ceil(msLeft / 1000);
      setRaceStatus(`Starting in ${sec}…`);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(sec), CANVAS.width / 2, CANVAS.height / 2);
      ctx.restore();
      if (msLeft <= 0) {
        state.raceState = "racing";
        setRaceStatus("Racing…");
      }
    }
    if (state.raceState === "finished" && state.finishedOrder.length > 0) {
      const winner = state.finishedOrder[0];
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      ctx.fillStyle = "#21d07a";
      ctx.font = "bold 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Winner: ${winner.name} — Pot ${formatSol(state.potSol)} SOL`, CANVAS.width / 2, 42);
      ctx.restore();
    }
  }

  function frame(now) {
    const dt = state.lastFrameTime ? now - state.lastFrameTime : 16;
    state.lastFrameTime = now;

    renderBackground();
    if (state.raceState === "racing") stepRacing(dt, now);
    renderMarbles(now);
    renderOverlay(now);

    state.animationFrameId = requestAnimationFrame(frame);
  }

  function randomGuestName() {
    const animals = ["Otter", "Panda", "Husky", "Falcon", "Gecko", "Koala", "Tiger", "Orca", "Lynx", "Raven"];
    const n = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return animals[Math.floor(Math.random() * animals.length)] + n;
  }

  function startChatSimulation() {
    stopChatSimulation();
    if (!state.simulateChat) return;
    const names = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "pumpmaxi", "degen42", "solslinger", "ray"];
    state.chatSimTimer = setInterval(() => {
      const name = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
      const willJoin = Math.random() < 0.55 && state.raceState === "waiting";
      if (willJoin) {
        const amt = (0.005 + Math.random() * 0.035);
        const msg = `!join ${formatSol(amt)}`;
        pushChatMessage(name, msg);
        parseChatCommand(name, msg);
      } else {
        const chatter = ["gm", "ngmi?", "wen race", "pump it", "let's go", "ez win", "to the moon", "send it"];
        pushChatMessage(name, chatter[Math.floor(Math.random() * chatter.length)]);
      }
    }, 1200);
  }

  function stopChatSimulation() {
    if (state.chatSimTimer) {
      clearInterval(state.chatSimTimer);
      state.chatSimTimer = null;
    }
  }

  // Events
  els.connectWalletButton.addEventListener("click", connectWallet);
  if (provider) {
    provider.on("connect", () => {
      state.walletPublicKey = provider.publicKey?.toString() || null;
      updateWalletUI();
    });
    provider.on("disconnect", () => {
      state.walletPublicKey = null;
      updateWalletUI();
    });
  }

  els.connectChatButton.addEventListener("click", () => {
    state.chatConnected = !state.chatConnected;
    pushChatMessage("System", state.chatConnected ? "Chat connected (mock)." : "Chat disconnected.");
  });

  els.simulateChatToggle.addEventListener("change", (e) => {
    state.simulateChat = !!e.target.checked;
    if (state.simulateChat) startChatSimulation(); else stopChatSimulation();
  });

  els.sendChatButton.addEventListener("click", () => {
    const text = String(els.chatInput.value || "").trim();
    if (!text) return;
    const name = state.walletPublicKey ? shortenAddress(state.walletPublicKey) : randomGuestName();
    pushChatMessage(name, text);
    parseChatCommand(name, text);
    els.chatInput.value = "";
  });

  els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      els.sendChatButton.click();
    }
  });

  els.joinRaceButton.addEventListener("click", () => {
    const amt = parseFloat(String(els.joinBetInput.value || "0"));
    if (isNaN(amt) || amt <= 0) return;
    const name = state.walletPublicKey ? shortenAddress(state.walletPublicKey) : randomGuestName();
    if (addParticipant(name, amt)) {
      pushChatMessage("System", `${name} joined with ${formatSol(amt)} SOL`);
    }
  });

  els.startRaceButton.addEventListener("click", () => {
    if (state.raceState === "waiting" || state.raceState === "finished") {
      startRace();
    }
  });

  // Init
  updateWalletUI();
  startChatSimulation();
  state.animationFrameId = requestAnimationFrame(frame);

  // Expose for debugging
  window.__marbles = { state };
})();


