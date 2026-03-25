const socket = io(window.location.origin, { path: "/ws" });

const chart = LightweightCharts.createChart(document.getElementById("chart"), {
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

const candleSeries = chart.addCandlestickSeries({
  upColor: "#00ff99",
  downColor: "#ff4d4d",
  borderUpColor: "#00ff99",
  borderDownColor: "#ff4d4d",
  wickUpColor: "#00ff9988",
  wickDownColor: "#ff4d4d88",
});

const volumeSeries = chart.addHistogramSeries({
  priceFormat: { type: "volume" },
  priceScaleId: "",
  color: "#26a69a",
});
volumeSeries.priceScale().applyOptions({
  scaleMargins: { top: 0.85, bottom: 0 },
});

window.addEventListener("resize", () => {
  const el = document.getElementById("chart");
  chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
});
setTimeout(() => {
  const el = document.getElementById("chart");
  chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
}, 100);

let lastPrice = 1.0;
let prevPrice = 1.0;

socket.on("connect", () => {
  document.getElementById("statusDot").classList.add("live");
  document.getElementById("statusText").textContent = "LIVE";
});

socket.on("disconnect", () => {
  document.getElementById("statusDot").classList.remove("live");
  document.getElementById("statusText").textContent = "OFFLINE";
});

socket.on("price", (p) => {
  prevPrice = lastPrice;
  lastPrice = p;
  const priceEl = document.getElementById("topPrice");
  priceEl.textContent = p.toFixed(4);
  priceEl.classList.toggle("down", p < prevPrice);
});

socket.on("candle", (c) => {
  candleSeries.update(c);

  volumeSeries.update({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? "#00ff9933" : "#ff4d4d33",
  });

  const type = c.close >= prevPrice ? "buy" : "sell";
  addTrade(type, c.close, c.time);
  prevPrice = c.close;
});

socket.on("engineState", (s) => {
  document.getElementById("topVolume").textContent = "$" + s.totalVolume.toFixed(2);
  document.getElementById("topCycle").textContent = s.cycle;
  document.getElementById("topFill").textContent = s.fillPct.toFixed(1) + "%";

  document.getElementById("mDemand").textContent = s.demand;
  document.getElementById("mSupply").textContent = s.supply;
  document.getElementById("mQueue").textContent = s.queueSize;

  const fillPct = Math.min(100, s.fillPct);
  const fillBar = document.getElementById("fillBar");
  fillBar.style.width = fillPct + "%";
  if (fillPct >= 90) fillBar.style.background = "#ff4d4d";
  else if (fillPct >= 50) fillBar.style.background = "#f59e0b";
  else fillBar.style.background = "#00ff99";

  const floorPct = Math.round(s.floorPercent * 100);
  const housePct = Math.round(s.housePercent * 100);
  const sf = document.getElementById("splitFloor");
  const sh = document.getElementById("splitHouse");
  sf.style.width = floorPct + "%";
  sf.textContent = "FLOOR " + floorPct + "%";
  sh.style.width = housePct + "%";
  sh.textContent = "HOUSE " + housePct + "%";

  const safeEl = document.getElementById("mSafe");
  if (s.safeStop.stopped) {
    safeEl.textContent = "HALTED";
    safeEl.className = "metric-value red";
  } else {
    safeEl.textContent = "OK";
    safeEl.className = "metric-value green";
  }

  const book = generateOrderBook(s.price);
  renderBook(book.bids, "bids", "bid");
  renderBook(book.asks, "asks", "ask");
  const spread = book.asks.length && book.bids.length
    ? (book.asks[0].price - book.bids[0].price).toFixed(4)
    : "—";
  document.getElementById("spreadRow").textContent = "SPREAD: " + spread;

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

socket.on("halt", () => {
  document.getElementById("haltOverlay").classList.add("active");
});

function generateOrderBook(price) {
  const bids = [];
  const asks = [];
  for (let i = 0; i < 10; i++) {
    bids.push({
      price: +(price - (i + 1) * 0.0050).toFixed(4),
      size: +(Math.random() * 5 + 0.1).toFixed(2),
    });
    asks.push({
      price: +(price + (i + 1) * 0.0050).toFixed(4),
      size: +(Math.random() * 5 + 0.1).toFixed(2),
    });
  }
  return { bids, asks };
}

function renderBook(levels, containerId, side) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const maxSize = Math.max(...levels.map((l) => l.size), 1);

  levels.forEach((level) => {
    const div = document.createElement("div");
    div.className = "book-row " + side;
    const bgWidth = ((level.size / maxSize) * 100).toFixed(0);
    div.innerHTML =
      '<div class="book-bg" style="width:' + bgWidth + '%"></div>' +
      '<span class="book-price">' + level.price.toFixed(4) + "</span>" +
      '<span class="book-size">' + level.size.toFixed(2) + "</span>";
    container.appendChild(div);
  });
}

function addTrade(type, price, time) {
  const div = document.createElement("div");
  div.className = "trade-row " + type;
  const ts = new Date(time * 1000);
  const timeStr = ts.toLocaleTimeString();
  div.innerHTML =
    '<span class="trade-price">' + type.toUpperCase() + " @ $" + price.toFixed(4) + "</span>" +
    '<span class="trade-time">' + timeStr + "</span>";

  const trades = document.getElementById("trades");
  trades.prepend(div);
  if (trades.children.length > 30) {
    trades.removeChild(trades.lastChild);
  }
}

function doBuy() {
  fetch("/buy?user=live-trader-" + Date.now())
    .then((r) => r.json())
    .then((d) => console.log("BUY:", d))
    .catch((e) => console.error("BUY ERROR:", e));
}

function doImpulse() {
  fetch("/impulse?amount=10")
    .then((r) => r.json())
    .then((d) => console.log("IMPULSE:", d))
    .catch((e) => console.error("IMPULSE ERROR:", e));
}
