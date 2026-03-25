const socket = io({ path: "/ws" });

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function formatDiff(val) {
  if (val > 0) return '<span class="diff-positive">+' + val.toFixed(2) + '</span>';
  if (val < 0) return '<span class="diff-negative">' + val.toFixed(2) + '</span>';
  return '<span class="diff-zero">0.00</span>';
}

function getProgressColor(pct) {
  if (pct >= 0.9) return "#ff4d4d";
  if (pct >= 0.7) return "#ffaa00";
  if (pct >= 0.4) return "#f0b90b";
  return "#00ff99";
}

function renderStats(data) {
  const el = document.getElementById("stats");
  const healthClass = "health-" + data.engineHealth;
  const pctWidth = Math.min(data.cycleProgress * 100, 100).toFixed(1);
  const progressColor = getProgressColor(data.cycleProgress);

  el.innerHTML =
    '<h3>Engine Status</h3>' +
    '<div class="stat-row"><span class="stat-label">Health</span><span class="stat-value"><span class="health-badge ' + healthClass + '">' + data.engineHealth + '</span></span></div>' +
    '<div class="stat-row"><span class="stat-label">Price</span><span class="stat-value">' + data.avgPrice.toFixed(4) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Volume</span><span class="stat-value">' + data.totalVolume.toFixed(2) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Queue Depth</span><span class="stat-value">' + data.queueDepth + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Active Markets</span><span class="stat-value">' + data.activeMarkets + ' / ' + data.totalMarkets + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Kinetic Pulse</span><span class="stat-value">' + data.kineticPulse + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Cycle Progress</span><span class="stat-value">' + pctWidth + '%</span></div>' +
    '<div class="progress-bar"><div class="progress-fill" style="width:' + pctWidth + '%;background:' + progressColor + '"></div></div>';
}

function renderCash(cash) {
  var el = document.getElementById("cash");
  el.innerHTML =
    '<h3>Cash Flow</h3>' +
    '<div class="stat-row"><span class="stat-label">Deposits</span><span class="stat-value good">$' + cash.deposits.toFixed(2) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Entries</span><span class="stat-value">$' + cash.entries.toFixed(2) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Total In</span><span class="stat-value">$' + cash.totalIn.toFixed(2) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Diff (Dep - Ent)</span><span class="stat-value">' + formatDiff(cash.diff) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Last Deposit</span><span class="stat-value">' + formatTime(cash.lastDeposit) + '</span></div>' +
    '<div class="stat-row"><span class="stat-label">Last Entry</span><span class="stat-value">' + formatTime(cash.lastEntry) + '</span></div>';
}

function renderAlerts(alerts) {
  var el = document.getElementById("alerts");
  if (!alerts || alerts.length === 0) {
    el.innerHTML = '<h3>Alerts</h3><div class="no-alerts">&#10003; All systems nominal</div>';
    return;
  }

  var html = '<h3>Alerts (' + alerts.length + ')</h3>';
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    var cls = "alert";
    if (a.level === "WARNING") cls += " warning";
    if (a.level === "INFO") cls += " info";
    html += '<div class="' + cls + '">[' + a.level + '] ' + a.message + '</div>';
  }
  el.innerHTML = html;
}

socket.on("monitor", function(data) {
  renderStats(data);
  if (data.cash) renderCash(data.cash);
  renderAlerts(data.alerts);
  document.getElementById("lastUpdate").textContent = "Last update: " + formatTime(data.time);
});

socket.on("connect", function() {
  console.log("[MONITOR] Connected to engine");
});

socket.on("disconnect", function() {
  document.getElementById("stats").innerHTML = '<h3>Engine Status</h3><div style="color:#ff4d4d">Disconnected — reconnecting...</div>';
});
