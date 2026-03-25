const socket = io({ path: "/ws" });

socket.on("monitor", (data) => {

  document.getElementById("stats").innerHTML = `
    <b>Markets:</b> ${data.totalMarkets}<br>
    <b>Active:</b> ${data.activeMarkets}<br>
    <b>Total Volume:</b> $${data.totalVolume}<br>
    <b>Avg Price:</b> ${data.avgPrice.toFixed(4)}<br>
    <b>Queue Depth:</b> ${data.queueDepth}<br>
    <b>Cycle Progress:</b> ${(data.cycleProgress * 100).toFixed(1)}%<br>
    <b>Kinetic Pulse:</b> ${data.kineticPulse}<br>
    <b>Health:</b> <span class="${data.engineHealth === 'HEALTHY' ? 'good' : 'alert'}">${data.engineHealth}</span>
  `;

  document.getElementById("cash").innerHTML = `
    <b>Deposits:</b> $${data.cash.deposits}<br>
    <b>Entries:</b> ${data.cash.entries}<br>
    <b>Total In:</b> $${data.cash.totalIn}<br>
    <b>Difference:</b> 
    <span class="${data.cash.diff === 0 ? 'good' : 'alert'}">
      ${data.cash.diff}
    </span>
  `;

  let alertHTML = "<b>Alerts:</b><br>";
  if (data.alerts.length === 0) {
    alertHTML += "<span class='good'>No issues</span>";
  } else {
    data.alerts.forEach(a => {
      alertHTML += `<div class="alert">[${a.level}] ${a.message}</div>`;
    });
  }
  document.getElementById("alerts").innerHTML = alertHTML;

  document.getElementById("lastUpdate").textContent = "Last update: " + new Date(data.time).toLocaleTimeString();
});

socket.on("queue_update", (data) => {
  const el = document.getElementById("queue");
  let html = `<b>Settlement Queue</b> (${data.total} traders)<br>`;

  if (!data.queue || data.queue.length === 0) {
    html += "<span class='good'>Queue empty</span>";
  } else {
    html += '<div class="queue-list">';
    data.queue.forEach(q => {
      html += `<div class="queue-entry">#${q.position} | <span class="queue-user">${q.userId.slice(0, 8)}...</span> | $${q.amount} | <span class="queue-status">${q.status}</span></div>`;
    });
    if (data.total > data.queue.length) {
      html += `<div class="queue-more">+ ${data.total - data.queue.length} more...</div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;
});

socket.on("settlement", (data) => {
  if (data.payouts && data.payouts.length > 0) {
    data.payouts.forEach(p => {
      console.log(`PAID: ${p.userId} -> $${p.payout} (pos #${p.position})`);
    });
  }

  let payoutHTML = "";
  if (data.payouts && data.payouts.length > 0) {
    payoutHTML = "<br><b>Payouts:</b><br>";
    data.payouts.slice(0, 10).forEach(p => {
      payoutHTML += `<div style="font-size:11px;font-family:monospace;padding:1px 0;">#${p.position} ${p.userId.slice(0, 8)}... → <span class="good">$${p.payout}</span></div>`;
    });
    if (data.payouts.length > 10) {
      payoutHTML += `<div style="color:#6b7685;font-size:11px;">+ ${data.payouts.length - 10} more payouts...</div>`;
    }
  }

  document.getElementById("alerts").innerHTML += `
    <div class="alert" style="color:#f0b90b;border:1px solid #f0b90b;padding:8px;margin-top:6px;border-radius:4px;">
      SETTLEMENT — Cycle ${data.cycle} | ${data.marketId} | Price: ${data.settlementPrice.toFixed(4)} | Floor: $${data.floorPool.toFixed(2)} | House: $${data.housePool.toFixed(2)} | Traders: ${data.queueSize}
      ${payoutHTML}
    </div>
  `;
});

socket.on("market_reset", (data) => {
  document.getElementById("alerts").innerHTML += `
    <div class="alert good" style="border:1px solid #00ff99;padding:8px;margin-top:6px;border-radius:4px;">
      MARKET RESET — New cycle ${data.cycle} started
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
  document.getElementById("stats").innerHTML = "<span class='alert'>Disconnected — reconnecting...</span>";
});
