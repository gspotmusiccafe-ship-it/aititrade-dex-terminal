import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface EngineCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EngineState {
  price: number;
  mbbp: number;
  discountOffer: number;
  marketOpen: boolean;
  closePrice: number;
  totalVolume: number;
  targetVolume: number;
  demand: number;
  supply: number;
  floorPercent: number;
  housePercent: number;
  floorPool: number;
  housePool: number;
  cycle: number;
  queueSize: number;
  fillPct: number;
  safeStop: { stopped: boolean; price: number };
}

export function useEngineSocket() {
  const [price, setPrice] = useState(0.01);
  const [mbbp, setMbbp] = useState(1.01);
  const [discountOffer, setDiscountOffer] = useState(0);
  const [marketOpen, setMarketOpen] = useState(true);
  const [candle, setCandle] = useState<EngineCandle | null>(null);
  const [candles, setCandles] = useState<EngineCandle[]>([]);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [halted, setHalted] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, { path: "/ws" });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("price", (p: number) => setPrice(p));

    socket.on("candle", (c: EngineCandle) => {
      setCandle(c);
      setCandles(prev => {
        const next = [...prev, c];
        if (next.length > 300) next.shift();
        return next;
      });
    });

    socket.on("engineState", (s: EngineState) => {
      setEngineState(s);
      setMbbp(s.mbbp);
      setDiscountOffer(s.discountOffer);
      setMarketOpen(s.marketOpen);
    });

    socket.on("mbbp", (data: { mbbp: number; discountOffer: number; marketOpen: boolean }) => {
      setMbbp(data.mbbp);
      setDiscountOffer(data.discountOffer);
      setMarketOpen(data.marketOpen);
    });

    socket.on("halt", () => setHalted(true));

    socket.on("market_reset", () => {
      setMarketOpen(true);
      setPrice(0.01);
      setMbbp(1.01);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { price, mbbp, discountOffer, marketOpen, candle, candles, engineState, halted, connected };
}
