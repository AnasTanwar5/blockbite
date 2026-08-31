import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const instance = import.meta.env.VITE_INSTANCE || "";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function useSocket(providedToken) {
  const token = providedToken || (typeof window !== "undefined" ? localStorage.getItem("blockbite_token") : null);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef({});
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const existingSocket = socketRef.current;
    if (existingSocket && existingSocket.connected) {
      setConnected(true);
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
    });

    socket.on("auth_error", () => {
      setConnected(false);
    });

    socket.on("connected", (data) => {
      console.log("Socket authenticated:", data);
    });

    return () => {
      const currentToken = tokenRef.current;
      if (currentToken !== token) {
        socket.disconnect();
      }
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  const registerListener = useCallback((event, callback) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, callback);
    listenersRef.current[event] = callback;
  }, []);

  const unregisterListener = useCallback((event) => {
    if (!socketRef.current) return;
    const callback = listenersRef.current[event];
    if (callback) {
      socketRef.current.off(event, callback);
    }
    delete listenersRef.current[event];
  }, []);

  return {
    socket: socketRef.current,
    connected,
    registerListener,
    unregisterListener,
  };
}
