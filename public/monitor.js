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
});

socket.on("connect", () => {
  console.log("[MONITOR] Connected");
});

socket.on("disconnect", () => {
  document.getElementById("stats").innerHTML = "<span class='alert'>Disconnected — reconnecting...</span>";
});
