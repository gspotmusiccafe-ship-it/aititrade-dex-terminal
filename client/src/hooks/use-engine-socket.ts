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
  totalVolume: number;
  targetVolume: number;
  demand: number;
  supply: number;
  floorPercent: number;
  housePercent: number;
  cycle: number;
  queueSize: number;
  fillPct: number;
  safeStop: { stopped: boolean; price: number };
}

export function useEngineSocket() {
  const [price, setPrice] = useState(1.0);
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

    socket.on("engineState", (s: EngineState) => setEngineState(s));

    socket.on("halt", () => setHalted(true));

    return () => {
      socket.disconnect();
    };
  }, []);

  return { price, candle, candles, engineState, halted, connected };
}
