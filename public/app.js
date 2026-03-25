var socket = io(window.location.origin, { path: "/ws" });

var chart = LightweightCharts.createChart(document.getElementById("chart"), {
  layout: {
    background: { color: "#0b0f14" },
    textColor: "#d1d4dc",
  },
  grid: {
    vertLines: { color: "#1f293744" },
    horzLines: { color: "#1f293744" },
  },
  crosshair: {
    mode: LightweightCharts.CrosshairMode.Normal,
    vertLine: { color: "#374151", labelBackgroundColor: "#111827" },
    horzLine: { color: "#374151", labelBackgroundColor: "#111827" },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: true,
    borderColor: "#1f2937",
  },
  rightPriceScale: {
    borderColor: "#1f2937",
  },
});

var candleSeries = chart.addCandlestickSeries({
  upColor: "#00ff99",
  downColor: "#ff4d4d",
  borderUpColor: "#00ff99",
  borderDownColor: "#ff4d4d",
  wickUpColor: "#00ff9988",
  wickDownColor: "#ff4d4d88",
});

var volumeSeries = chart.addHistogramSeries({
  priceFormat: { type: "volume" },
  priceScaleId: "",
  color: "#26a69a",
});
volumeSeries.priceScale().applyOptions({
  scaleMargins: { top: 0.85, bottom: 0 },
});

window.addEventListener("resize", function () {
  var el = document.getElementById("chart");
  chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
});
setTimeout(function () {
  var el = document.getElementById("chart");
  chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
}, 100);

var lastPrice = 1.0;
var prevPrice = 1.0;

socket.on("connect", function () {
  document.getElementById("statusDot").classList.add("live");
  document.getElementById("statusText").textContent = "LIVE";
});

socket.on("disconnect", function () {
  document.getElementById("statusDot").classList.remove("live");
  document.getElementById("statusText").textContent = "OFFLINE";
});

socket.on("price", function (p) {
  prevPrice = lastPrice;
  lastPrice = p;
  var priceEl = document.getElementById("topPrice");
  priceEl.textContent = p.toFixed(4);
  priceEl.classList.toggle("down", p < prevPrice);
});

socket.on("candle", function (c) {
  candleSeries.update(c);

  volumeSeries.update({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? "#00ff9933" : "#ff4d4d33",
  });

  var type = c.close >= prevPrice ? "buy" : "sell";
  addTrade(type, c.close, c.time);
  prevPrice = c.close;
});

socket.on("engineState", function (s) {
  document.getElementById("topVolume").textContent = "$" + s.totalVolume.toFixed(2);
  document.getElementById("topCycle").textContent = s.cycle;
  document.getElementById("topFill").textContent = s.fillPct.toFixed(1) + "%";

  document.getElementById("mDemand").textContent = s.demand;
  document.getElementById("mSupply").textContent = s.supply;
  document.getElementById("mQueue").textContent = s.queueSize;

  var fillPct = Math.min(100, s.fillPct);
  var fillBar = document.getElementById("fillBar");
  fillBar.style.width = fillPct + "%";
  if (fillPct >= 90) fillBar.style.background = "#ff4d4d";
  else if (fillPct >= 50) fillBar.style.background = "#f59e0b";
  else fillBar.style.background = "#00ff99";

  var floorPct = Math.round(s.floorPercent * 100);
  var housePct = Math.round(s.housePercent * 100);
  var sf = document.getElementById("splitFloor");
  var sh = document.getElementById("splitHouse");
  sf.style.width = floorPct + "%";
  sf.textContent = "FLOOR " + floorPct + "%";
  sh.style.width = housePct + "%";
  sh.textContent = "HOUSE " + housePct + "%";

  var safeEl = document.getElementById("mSafe");
  if (s.safeStop.stopped) {
    safeEl.textContent = "HALTED";
    safeEl.className = "metric-value red";
  } else {
    safeEl.textContent = "OK";
    safeEl.className = "metric-value green";
  }

  document.getElementById("tickerTape").textContent =
    "AITITRADE | CYCLE #" + s.cycle +
    " | P=" + s.price.toFixed(4) +
    " | VOL=$" + s.totalVolume.toFixed(2) +
    " | D/S=" + s.demand + "/" + s.supply +
    " | FILL=" + s.fillPct.toFixed(1) + "%" +
    " | FLOOR=" + floorPct + "% HOUSE=" + housePct + "%" +
    " | Q=" + s.queueSize +
    " | " + new Date().toLocaleTimeString();
});

socket.on("global_index", function (data) {
  var el = document.getElementById("globalIndex");
  if (el) el.textContent = data.value.toFixed(4);
});

socket.on("orderbook", function (book) {
  renderBook(book.bids, "bids", "bid");
  renderBook(book.asks, "asks", "ask");
  var spread = book.asks.length && book.bids.length
    ? (book.asks[0].price - book.bids[0].price).toFixed(4)
    : "---";
  document.getElementById("spreadRow").textContent = "SPREAD: " + spread;
});

socket.on("impulse", function (data) {
  triggerImpulseEffect(data.amount, data.price);

  document.getElementById("bids").style.background = "rgba(0,255,150,0.05)";
  document.getElementById("asks").style.background = "rgba(255,0,0,0.05)";
  setTimeout(function () {
    document.getElementById("bids").style.background = "transparent";
    document.getElementById("asks").style.background = "transparent";
  }, 200);
});

socket.on("liquidation", function (data) {
  var chartEl = document.getElementById("chart");
  chartEl.style.background = "rgba(255,0,0,0.15)";
  setTimeout(function () {
    chartEl.style.background = "transparent";
  }, 400);

  var liqDiv = document.createElement("div");
  liqDiv.className = "trade-row sell";
  liqDiv.innerHTML =
    '<span class="trade-price" style="color:#ff4d4d;font-weight:900;">LIQUIDATION @ $' +
    data.price.toFixed(4) + '</span>' +
    '<span class="trade-time">INT: ' + data.intensity.toFixed(1) + '</span>';
  var trades = document.getElementById("trades");
  trades.prepend(liqDiv);
  if (trades.children.length > 30) {
    trades.removeChild(trades.lastChild);
  }
});

socket.on("replay_event", function (event) {
  console.log("REPLAY:", event.type, event.payload);
  var div = document.createElement("div");
  div.className = "trade-row buy";
  div.innerHTML =
    '<span class="trade-price" style="color:#a78bfa;font-weight:700;">REPLAY: ' +
    event.type + '</span>' +
    '<span class="trade-time">' + new Date(event.time).toLocaleTimeString() + '</span>';
  var trades = document.getElementById("trades");
  trades.prepend(div);
  if (trades.children.length > 30) {
    trades.removeChild(trades.lastChild);
  }
});

socket.on("halt", function () {
  document.getElementById("haltOverlay").classList.add("active");
});

function triggerImpulseEffect(amount, price) {
  var chartEl = document.getElementById("chart");

  var pulse = document.createElement("div");
  pulse.style.position = "absolute";
  pulse.style.left = "50%";
  pulse.style.top = "40%";
  pulse.style.transform = "translate(-50%, -50%)";
  pulse.style.width = "20px";
  pulse.style.height = "20px";
  pulse.style.borderRadius = "50%";
  pulse.style.background = "rgba(0,255,150,0.6)";
  pulse.style.boxShadow = "0 0 30px rgba(0,255,150,0.8)";
  pulse.style.zIndex = "999";
  pulse.style.pointerEvents = "none";

  chartEl.style.position = "relative";
  chartEl.appendChild(pulse);

  var scale = 1;
  var opacity = 1;

  var anim = setInterval(function () {
    scale += 0.2;
    opacity -= 0.05;
    pulse.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
    pulse.style.opacity = opacity;

    if (opacity <= 0) {
      clearInterval(anim);
      pulse.remove();
    }
  }, 30);
}

function renderBook(levels, containerId, side) {
  var container = document.getElementById(containerId);
  container.innerHTML = "";
  var maxSize = Math.max.apply(null, levels.map(function (l) { return l.size; }).concat([1]));

  levels.forEach(function (level) {
    var div = document.createElement("div");
    div.className = "book-row " + side;
    var bgWidth = ((level.size / maxSize) * 100).toFixed(0);
    div.innerHTML =
      '<div class="book-bg" style="width:' + bgWidth + '%"></div>' +
      '<span class="book-price">' + level.price.toFixed(4) + "</span>" +
      '<span class="book-size">' + level.size.toFixed(2) + "</span>";
    container.appendChild(div);
  });
}

function addTrade(type, price, time) {
  var div = document.createElement("div");
  div.className = "trade-row " + type;
  var ts = new Date(time * 1000);
  var timeStr = ts.toLocaleTimeString();
  div.innerHTML =
    '<span class="trade-price">' + type.toUpperCase() + " @ $" + price.toFixed(4) + "</span>" +
    '<span class="trade-time">' + timeStr + "</span>";

  var trades = document.getElementById("trades");
  trades.prepend(div);
  if (trades.children.length > 30) {
    trades.removeChild(trades.lastChild);
  }
}

function doBuy() {
  fetch("/buy?user=live-trader-" + Date.now() + "&amount=1")
    .then(function (r) { return r.json(); })
    .then(function (d) { console.log("BUY:", d); })
    .catch(function (e) { console.error("BUY ERROR:", e); });
}

function doImpulse() {
  fetch("/impulse?amount=10")
    .then(function (r) { return r.json(); })
    .then(function (d) { console.log("IMPULSE:", d); })
    .catch(function (e) { console.error("IMPULSE ERROR:", e); });
}
