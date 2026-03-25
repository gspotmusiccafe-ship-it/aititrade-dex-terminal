const socket = io({ path: "/ws" });

socket.on("monitor", (data) => {
  const marketStatus = data.marketOpen ? '<span class="good">OPEN</span>' : '<span class="critical-text">CLOSED</span>';

  document.getElementById("stats").innerHTML = `
    <h3>Engine Status</h3>
    <div class="stat-row"><span class="stat-label">Market</span><span class="stat-value">${marketStatus}</span></div>
    <div class="stat-row"><span class="stat-label">Price</span><span class="stat-value good">$${data.avgPrice.toFixed(4)}</span></div>
    <div class="stat-row"><span class="stat-label">MBBP (Buyback)</span><span class="stat-value" style="color:#f0b90b">$${(data.mbbp || 0).toFixed(4)}</span></div>
    <div class="stat-row"><span class="stat-label">Discount Offer</span><span class="stat-value" style="color:#4d94ff">$${(data.discountOffer || 0).toFixed(4)}</span></div>
    <div class="stat-row"><span class="stat-label">Volume</span><span class="stat-value">$${data.totalVolume} / $${1000}</span></div>
    <div class="stat-row"><span class="stat-label">Fill</span><span class="stat-value">${(data.cycleProgress * 100).toFixed(1)}%</span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(data.cycleProgress * 100, 100)}%;background:${data.cycleProgress > 0.9 ? '#ff4d4d' : data.cycleProgress > 0.7 ? '#ffaa00' : '#00ff99'}"></div></div>
    <div class="stat-row"><span class="stat-label">Queue</span><span class="stat-value">${data.queueDepth} traders</span></div>
    <div class="stat-row"><span class="stat-label">Floor Pool</span><span class="stat-value good">$${(data.floorPool || 0).toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">House Pool</span><span class="stat-value warning-text">$${(data.housePool || 0).toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Kinetic Pulse</span><span class="stat-value">${data.kineticPulse}</span></div>
    <div class="stat-row"><span class="stat-label">Health</span><span class="stat-value"><span class="health-badge health-${data.engineHealth}">${data.engineHealth}</span></span></div>
  `;

  document.getElementById("cash").innerHTML = `
    <h3>Cash Flow</h3>
    <div class="stat-row"><span class="stat-label">Deposits</span><span class="stat-value good">$${data.cash.deposits.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Entries</span><span class="stat-value">$${data.cash.entries.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Total In</span><span class="stat-value">$${data.cash.totalIn.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Difference</span><span class="stat-value ${data.cash.diff > 0 ? 'diff-positive' : data.cash.diff < 0 ? 'diff-negative' : 'diff-zero'}">$${data.cash.diff.toFixed(2)}</span></div>
  `;

  let alertHTML = "<h3>Alerts</h3>";
  if (data.alerts.length === 0) {
    alertHTML += '<div class="no-alerts">No issues</div>';
  } else {
    data.alerts.forEach(a => {
      const cls = a.level === "CRITICAL" ? "alert" : a.level === "WARNING" ? "alert warning" : "alert info";
      alertHTML += `<div class="${cls}">[${a.level}] ${a.message}</div>`;
    });
  }
  document.getElementById("alerts").innerHTML = alertHTML;

  document.getElementById("lastUpdate").textContent = "Last update: " + new Date(data.time).toLocaleTimeString();
});

socket.on("queue_update", (data) => {
  const el = document.getElementById("queue");
  let html = `<h3>Settlement Queue</h3><div style="color:#8899aa;font-size:12px;margin-bottom:6px">${data.total} traders in queue</div>`;

  if (!data.queue || data.queue.length === 0) {
    html += '<div class="no-alerts">Queue empty</div>';
  } else {
    html += '<div class="queue-list">';
    data.queue.forEach(q => {
      const statusColor = q.status === "discount_exit" ? "color:#4d94ff" : q.status === "settled" ? "color:#00ff99" : "color:#f0b90b";
      html += `<div class="queue-entry">#${q.position} | <span class="queue-user">${q.userId.slice(0, 8)}...</span> | $${q.amount} @ $${(q.entryPrice || 0).toFixed(4)} | <span style="${statusColor};text-transform:uppercase;font-size:10px">${q.status}</span></div>`;
    });
    if (data.total > data.queue.length) {
      html += `<div class="queue-more">+ ${data.total - data.queue.length} more...</div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;
});

socket.on("settlement", (data) => {
  let payoutHTML = "";
  if (data.payouts && data.payouts.length > 0) {
    payoutHTML = "<br><b>Payouts:</b><br>";
    data.payouts.slice(0, 10).forEach(p => {
      const typeLabel = p.type === "discount" ? "DISC" : "MBBP";
      const typeColor = p.type === "discount" ? "#4d94ff" : "#00ff99";
      payoutHTML += `<div style="font-size:11px;font-family:monospace;padding:1px 0;">#${p.position} ${p.userId.slice(0, 8)}... → <span style="color:${typeColor}">$${p.payout} (${typeLabel})</span></div>`;
    });
    if (data.payouts.length > 10) {
      payoutHTML += `<div style="color:#6b7685;font-size:11px;">+ ${data.payouts.length - 10} more payouts...</div>`;
    }
  }

  document.getElementById("alerts").innerHTML += `
    <div class="alert" style="color:#f0b90b;border:1px solid #f0b90b;padding:8px;margin-top:6px;border-radius:4px;">
      MARKET CLOSED — Cycle ${data.cycle} | Close: $${(data.closePrice || 0).toFixed(4)} | MBBP: $${(data.mbbp || 0).toFixed(4)} | Floor: $${data.floorPool.toFixed(2)} | House: $${data.housePool.toFixed(2)} | Traders: ${data.queueSize}
      ${payoutHTML}
    </div>
  `;
});

socket.on("market_reset", (data) => {
  document.getElementById("alerts").innerHTML += `
    <div class="alert good" style="border:1px solid #00ff99;padding:8px;margin-top:6px;border-radius:4px;">
      MARKET OPEN — New cycle ${data.cycle} | Price: $0.01 | Accepting entries
    </div>
  `;
});

socket.on("discount_exit", (data) => {
  document.getElementById("alerts").innerHTML += `
    <div class="alert info" style="border:1px solid #4d94ff;padding:6px;margin-top:4px;border-radius:4px;font-size:12px;">
      DISCOUNT EXIT — ${data.userId.slice(0, 8)}... took $${data.payout.toFixed(2)} @ $${data.discountPrice.toFixed(4)} (MBBP was $${data.mbbp.toFixed(4)})
    </div>
  `;
});

function loadWallet() {
  const user = document.getElementById("walletUser").value.trim();
  if (!user) return;
  const el = document.getElementById("walletData");
  el.innerHTML = "Loading...";

  fetch(`/wallet?user=${encodeURIComponent(user)}`)
    .then(r => r.json())
    .then(w => {
      if (w.error) {
        el.innerHTML = `<span class="alert">${w.error}</span>`;
        return;
      }
      let historyHTML = "";
      if (w.recentHistory && w.recentHistory.length > 0) {
        historyHTML = "<br><b>Recent:</b><br>";
        w.recentHistory.slice(-5).forEach(h => {
          const color = h.type === "PAYOUT" || h.type === "DEPOSIT" ? "good" : "alert";
          historyHTML += `<div style="font-size:11px;font-family:monospace;padding:1px 0;"><span class="${color}">${h.type}</span> $${h.amount} — ${new Date(h.time).toLocaleTimeString()}</div>`;
        });
      }
      el.innerHTML = `
        <b>Balance:</b> <span class="good">$${w.balance.toFixed(2)}</span><br>
        <b>Deposited:</b> $${w.deposited.toFixed(2)}<br>
        <b>Earned:</b> $${w.earned.toFixed(2)}<br>
        <b>Withdrawn:</b> $${w.withdrawn.toFixed(2)}<br>
        <b>Transactions:</b> ${w.transactions}
        ${historyHTML}
      `;
    })
    .catch(() => {
      el.innerHTML = "<span class='alert'>Failed to load wallet</span>";
    });
}

socket.on("connect", () => {
  console.log("[MONITOR] Connected");
});

socket.on("disconnect", () => {
  document.getElementById("stats").innerHTML = '<h3>Engine Status</h3><span class="critical-text">Disconnected — reconnecting...</span>';
});
