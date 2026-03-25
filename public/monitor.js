const socket = io({ path: "/ws" });
let eventFeedItems = [];

function addEvent(type, message, color) {
  const time = new Date().toLocaleTimeString();
  eventFeedItems.unshift({ type, message, color, time });
  if (eventFeedItems.length > 50) eventFeedItems.pop();
  renderEventFeed();
}

function renderEventFeed() {
  const el = document.getElementById("eventFeed");
  if (eventFeedItems.length === 0) {
    el.innerHTML = '<div style="color:#4a5568;text-align:center">Waiting for events...</div>';
    return;
  }
  el.innerHTML = eventFeedItems.map(e =>
    `<div style="font-size:11px;font-family:monospace;padding:3px 0;border-bottom:1px solid #111d2a;display:flex;gap:8px;">
      <span style="color:#4a5568;flex-shrink:0">${e.time}</span>
      <span style="color:${e.color};font-weight:700;flex-shrink:0;width:70px">${e.type}</span>
      <span style="color:#c8cdd5">${e.message}</span>
    </div>`
  ).join("");
}

socket.on("monitor", (data) => {
  const pulse = document.getElementById("pulseIndicator");
  if (data.engineHealth === "CRITICAL" || data.engineHealth === "HALTED") {
    pulse.className = "pulse-dot crit";
  } else if (data.engineHealth === "WARNING") {
    pulse.className = "pulse-dot warn";
  } else {
    pulse.className = "pulse-dot";
  }

  document.getElementById("healthBadge").className = "health-badge health-" + data.engineHealth;
  document.getElementById("healthBadge").textContent = data.engineHealth;

  const marketBadge = data.marketOpen
    ? '<span class="market-badge market-open">OPEN</span>'
    : '<span class="market-badge market-closed">CLOSED</span>';

  const fillColor = data.cycleProgress > 0.95 ? "#ff4757" : data.cycleProgress > 0.8 ? "#f5a623" : "#00e887";
  const fillPct = (data.cycleProgress * 100).toFixed(1);

  document.getElementById("enginePanel").innerHTML = `
    <div class="big-row">
      <div class="big-cell">
        <div class="big-number good">$${data.avgPrice.toFixed(4)}</div>
        <div class="big-label">Current Price</div>
      </div>
      <div class="big-cell">
        <div class="big-number gold">$${(data.mbbp || 0).toFixed(4)}</div>
        <div class="big-label">MBBP (Buyback)</div>
      </div>
      <div class="big-cell">
        <div class="big-number blue">$${(data.discountOffer || 0).toFixed(4)}</div>
        <div class="big-label">Discount Offer</div>
      </div>
    </div>
    <div class="stat-row"><span class="stat-label">Market</span><span class="stat-value">${marketBadge}</span></div>
    <div class="stat-row"><span class="stat-label">Cycle</span><span class="stat-value gold">#${data.cycle || 1}</span></div>
    <div class="stat-row"><span class="stat-label">Volume</span><span class="stat-value">$${data.totalVolume.toFixed(2)} / $${data.targetVolume || 1000}</span></div>
    <div class="stat-row"><span class="stat-label">Fill</span><span class="stat-value" style="color:${fillColor}">${fillPct}%</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.min(parseFloat(fillPct), 100)}%;background:${fillColor}"></div></div>
    <div class="stat-row"><span class="stat-label">Queue Depth</span><span class="stat-value">${data.queueDepth} traders</span></div>
    <div class="stat-row"><span class="stat-label">Floor Pool</span><span class="stat-value good">$${(data.floorPool || 0).toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">House Pool</span><span class="stat-value warn">$${(data.housePool || 0).toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Floor / House Split</span><span class="stat-value">${((data.floorSplit || 0.5) * 100).toFixed(0)}% / ${((data.houseSplit || 0.5) * 100).toFixed(0)}%</span></div>
    <div class="stat-row"><span class="stat-label">Kinetic Pulse</span><span class="stat-value">${data.kineticPulse || "—"}</span></div>
    <div class="stat-row"><span class="stat-label">Kinetic Bias</span><span class="stat-value">${data.kineticBias || "—"}</span></div>
  `;

  const diff = data.cash.diff;
  const diffClass = diff > 0 ? "diff-pos" : diff < 0 ? "diff-neg" : "diff-zero";
  const diffIcon = diff > 0 ? "&#9650;" : diff < 0 ? "&#9660;" : "&#9644;";

  document.getElementById("cashPanel").innerHTML = `
    <div class="big-row">
      <div class="big-cell">
        <div class="big-number good">$${data.cash.deposits.toFixed(2)}</div>
        <div class="big-label">Total Deposits (Cash App)</div>
      </div>
      <div class="big-cell">
        <div class="big-number" style="color:#c8cdd5">$${data.cash.entries.toFixed(2)}</div>
        <div class="big-label">System Entries</div>
      </div>
      <div class="big-cell">
        <div class="big-number ${diffClass}">${diffIcon} $${Math.abs(diff).toFixed(2)}</div>
        <div class="big-label">Reconciliation ${diff >= 0 ? "(OK)" : "(DEFICIT)"}</div>
      </div>
    </div>
    <div class="stat-row"><span class="stat-label">Total In</span><span class="stat-value">$${data.cash.totalIn.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Last Deposit</span><span class="stat-value muted">${data.cash.lastDeposit ? new Date(data.cash.lastDeposit).toLocaleTimeString() : "—"}</span></div>
    <div class="stat-row"><span class="stat-label">Last Entry</span><span class="stat-value muted">${data.cash.lastEntry ? new Date(data.cash.lastEntry).toLocaleTimeString() : "—"}</span></div>
  `;

  const remaining = (data.targetVolume || 1000) - data.totalVolume;
  const isReady = data.totalVolume >= 950;
  const isClose = data.totalVolume >= 800;

  if (isReady) {
    document.getElementById("settleBadge").textContent = "READY";
    document.getElementById("settleBadge").style.background = "#f0b90b30";
    document.getElementById("settleBadge").style.color = "#f0b90b";
  } else if (isClose) {
    document.getElementById("settleBadge").textContent = "APPROACHING";
    document.getElementById("settleBadge").style.background = "#f5a62320";
    document.getElementById("settleBadge").style.color = "#f5a623";
  } else {
    document.getElementById("settleBadge").textContent = "FILLING";
    document.getElementById("settleBadge").style.background = "#4a556820";
    document.getElementById("settleBadge").style.color = "#6b7a8a";
  }

  let settleHTML = `
    <div class="stat-row"><span class="stat-label">Volume Progress</span><span class="stat-value">$${data.totalVolume.toFixed(2)} / $${data.targetVolume || 1000}</span></div>
    <div class="stat-row"><span class="stat-label">Remaining</span><span class="stat-value ${remaining < 100 ? 'warn' : ''}">${remaining > 0 ? "$" + remaining.toFixed(2) : "FULL"}</span></div>
    <div class="stat-row"><span class="stat-label">Queue for Payout</span><span class="stat-value">${data.queueDepth} traders</span></div>
    <div class="stat-row"><span class="stat-label">Close Price</span><span class="stat-value">${data.closePrice > 0 ? "$" + data.closePrice.toFixed(4) : "—"}</span></div>
  `;

  if (isReady) {
    settleHTML += `
      <div class="settle-ready">
        <div class="label">&#128276; READY TO SETTLE</div>
        <div style="color:#c8cdd5;font-size:12px;margin-top:4px">$${remaining.toFixed(2)} remaining to $1,000 threshold</div>
      </div>
    `;
  }

  if (data.settlementHistory && data.settlementHistory.length > 0) {
    settleHTML += '<div style="margin-top:10px;font-size:11px;color:#5a6a7a;font-weight:700;text-transform:uppercase;letter-spacing:1px">Recent Settlements</div>';
    data.settlementHistory.forEach(s => {
      settleHTML += `
        <div class="settlement-card">
          Cycle #${s.cycle} | Close: $${s.closePrice.toFixed(4)} | MBBP: $${s.mbbp.toFixed(4)} | Floor: $${s.floorPool.toFixed(2)} | House: $${s.housePool.toFixed(2)} | ${s.traders} traders | ${new Date(s.time).toLocaleTimeString()}
        </div>
      `;
    });
  }

  document.getElementById("settlePanel").innerHTML = settleHTML;

  if (data.walletSummary) {
    const ws = data.walletSummary;
    document.getElementById("walletCountBadge").textContent = ws.walletCount;
    document.getElementById("walletPanel").innerHTML = `
      <div class="big-row">
        <div class="big-cell">
          <div class="big-number good">$${ws.totalBalance.toFixed(2)}</div>
          <div class="big-label">Total Balance</div>
        </div>
        <div class="big-cell">
          <div class="big-number" style="color:#c8cdd5">${ws.walletCount}</div>
          <div class="big-label">Active Wallets</div>
        </div>
      </div>
      <div class="stat-row"><span class="stat-label">Total Deposited</span><span class="stat-value good">$${ws.totalDeposited.toFixed(2)}</span></div>
      <div class="stat-row"><span class="stat-label">Total Earned</span><span class="stat-value gold">$${ws.totalEarned.toFixed(2)}</span></div>
      <div class="stat-row"><span class="stat-label">Total Withdrawn</span><span class="stat-value crit">$${ws.totalWithdrawn.toFixed(2)}</span></div>
      <div class="stat-row"><span class="stat-label">Net Flow (In - Out)</span><span class="stat-value ${ws.netFlow >= 0 ? 'good' : 'crit'}">$${ws.netFlow.toFixed(2)}</span></div>
    `;
  }

  let alertHTML = "";
  const alerts = data.alerts || [];
  document.getElementById("alertCount").textContent = alerts.length;
  if (alerts.length > 0) {
    document.getElementById("alertCount").style.background = alerts.some(a => a.level === "CRITICAL") ? "#ff475730" : "#f5a62320";
    document.getElementById("alertCount").style.color = alerts.some(a => a.level === "CRITICAL") ? "#ff4757" : "#f5a623";
  } else {
    document.getElementById("alertCount").style.background = "#00e88720";
    document.getElementById("alertCount").style.color = "#00e887";
  }

  if (alerts.length === 0) {
    alertHTML = '<div class="no-alerts">&#10003; ALL CLEAR — No active alerts</div>';
  } else {
    alerts.forEach(a => {
      alertHTML += `
        <div class="alert-item alert-${a.level}">
          <span class="alert-tag tag-${a.level}">${a.level}</span>
          <span>${a.message}</span>
        </div>
      `;
    });
  }
  document.getElementById("alertPanel").innerHTML = alertHTML;

  const errors = data.errorLog || [];
  document.getElementById("errorCount").textContent = errors.length;
  if (errors.length === 0) {
    document.getElementById("errorPanel").innerHTML = '<div class="no-alerts">&#10003; NO ERRORS LOGGED</div>';
    document.getElementById("errorCount").style.background = "#00e88720";
    document.getElementById("errorCount").style.color = "#00e887";
  } else {
    document.getElementById("errorCount").style.background = "#ff475730";
    document.getElementById("errorCount").style.color = "#ff4757";
    document.getElementById("errorPanel").innerHTML = errors.map(e =>
      `<div class="error-entry">
        <span style="color:#4a5568">${new Date(e.time).toLocaleTimeString()}</span>
        <span style="color:#ff8a94;font-weight:700;margin:0 6px">${e.type}</span>
        ${e.message}
      </div>`
    ).reverse().join("");
  }

  document.getElementById("lastUpdate").textContent =
    "Last update: " + new Date(data.time).toLocaleTimeString() + " | Cycle #" + (data.cycle || 1);
});

socket.on("queue_update", (data) => {
  document.getElementById("queueBadge").textContent = data.total;
  const el = document.getElementById("queuePanel");

  if (!data.queue || data.queue.length === 0) {
    el.innerHTML = '<div class="no-alerts">Queue empty — no pending settlements</div>';
    return;
  }

  let html = `<div style="color:#5a6a7a;font-size:11px;margin-bottom:6px">${data.total} traders in settlement queue</div>`;
  data.queue.forEach(q => {
    const statusColor = q.status === "discount_exit" ? "#4da6ff" : q.status === "settled" ? "#00e887" : "#f0b90b";
    html += `
      <div class="queue-entry">
        <span><span style="color:#4a5568">#${q.position}</span> <span style="color:#f0b90b">${q.userId}</span></span>
        <span>$${q.amount} @ $${(q.entryPrice || 0).toFixed(4)}</span>
        <span style="color:${statusColor};font-size:10px;font-weight:700;text-transform:uppercase">${q.status}</span>
      </div>
    `;
  });
  if (data.total > data.queue.length) {
    html += `<div style="color:#4a5568;font-size:11px;padding-top:4px;text-align:center">+ ${data.total - data.queue.length} more in queue...</div>`;
  }
  el.innerHTML = html;
});

socket.on("settlement", (data) => {
  addEvent("SETTLE", `Cycle #${data.cycle} CLOSED — $${(data.closePrice || 0).toFixed(4)} → MBBP $${(data.mbbp || 0).toFixed(4)} | Floor: $${data.floorPool.toFixed(2)} | ${data.queueSize} traders`, "#f0b90b");

  if (data.payouts && data.payouts.length > 0) {
    data.payouts.slice(0, 5).forEach(p => {
      const typeLabel = p.type === "discount" ? "DISC" : "MBBP";
      addEvent("PAYOUT", `${p.userId.slice(0, 8)}... → $${p.payout} (${typeLabel})`, p.type === "discount" ? "#4da6ff" : "#00e887");
    });
  }
});

socket.on("market_reset", (data) => {
  addEvent("RESET", `New cycle #${data.cycle} — Market OPEN at $0.01`, "#00e887");
});

socket.on("discount_exit", (data) => {
  addEvent("DISCOUNT", `${data.userId.slice(0, 8)}... took $${data.payout.toFixed(2)} @ $${data.discountPrice.toFixed(4)} (MBBP was $${data.mbbp.toFixed(4)})`, "#4da6ff");
});

function loadWallet() {
  const user = document.getElementById("walletUser").value.trim();
  if (!user) return;
  const el = document.getElementById("walletData");
  el.innerHTML = '<div style="color:#4a5568">Loading...</div>';

  fetch(`/wallet?user=${encodeURIComponent(user)}`)
    .then(r => r.json())
    .then(w => {
      if (w.error) {
        el.innerHTML = `<div style="color:#ff4757">${w.error}</div>`;
        return;
      }
      let historyHTML = "";
      if (w.recentHistory && w.recentHistory.length > 0) {
        historyHTML = '<div style="margin-top:8px;font-size:11px;color:#5a6a7a;font-weight:700;text-transform:uppercase;letter-spacing:1px">Recent Activity</div>';
        w.recentHistory.slice(-8).reverse().forEach(h => {
          const color = h.type === "PAYOUT" || h.type === "DEPOSIT" ? "#00e887" : "#ff4757";
          historyHTML += `<div style="font-size:11px;font-family:monospace;padding:3px 0;border-bottom:1px solid #111d2a">
            <span style="color:${color};font-weight:700">${h.type}</span> $${h.amount} — <span style="color:#4a5568">${new Date(h.time).toLocaleTimeString()}</span>
          </div>`;
        });
      }
      el.innerHTML = `
        <div class="stat-row"><span class="stat-label">Balance</span><span class="stat-value good">$${w.balance.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Deposited</span><span class="stat-value">$${w.deposited.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Earned</span><span class="stat-value gold">$${w.earned.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Withdrawn</span><span class="stat-value crit">$${w.withdrawn.toFixed(2)}</span></div>
        <div class="stat-row"><span class="stat-label">Transactions</span><span class="stat-value">${w.transactions}</span></div>
        ${historyHTML}
      `;
    })
    .catch(() => {
      el.innerHTML = '<div style="color:#ff4757">Failed to load wallet</div>';
    });
}

socket.on("connect", () => {
  document.getElementById("connStatus").textContent = "LIVE";
  document.getElementById("connStatus").className = "connection-status conn-live";
  addEvent("SYSTEM", "Monitor connected", "#00e887");
});

socket.on("disconnect", () => {
  document.getElementById("connStatus").textContent = "DISCONNECTED";
  document.getElementById("connStatus").className = "connection-status conn-dead";
  document.getElementById("pulseIndicator").className = "pulse-dot dead";
  addEvent("SYSTEM", "Connection lost — reconnecting...", "#ff4757");
});
