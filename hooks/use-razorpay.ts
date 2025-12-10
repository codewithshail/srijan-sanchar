"use client";

import { useState, useCallback, useEffect } from "react";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: () => void) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface UseRazorpayReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  openPayment: (options: Omit<RazorpayOptions, "key">) => void;
}

export function useRazorpay(): UseRazorpayReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already loaded
    if (window.Razorpay) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => setIsLoaded(true));
      return;
    }

    // Load the script
    setIsLoading(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => {
      setIsLoaded(true);
      setIsLoading(false);
    };

    script.onerror = () => {
      setError("Failed to load Razorpay SDK");
      setIsLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      // Don't remove the script on cleanup as it might be used by other components
    };
  }, []);

  const openPayment = useCallback(
    (options: Omit<RazorpayOptions, "key">) => {
      if (!isLoaded) {
        setError("Razorpay SDK not loaded");
        return;
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        setError("Razorpay key not configured");
        return;
      }

      try {
        const razorpay = new window.Razorpay({
          key: keyId,
          ...options,
        });
        razorpay.open();
      } catch (err) {
        setError("Failed to open Razorpay checkout");
        console.error("Razorpay error:", err);
      }
    },
    [isLoaded]
  );

  return {
    isLoaded,
    isLoading,
    error,
    openPayment,
  };
}
