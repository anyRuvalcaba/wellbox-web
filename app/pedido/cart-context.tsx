"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, CustomerInfo } from "@/lib/types";

const STORAGE_KEY = "wellbox_cart_v1";

interface CartState {
  menuId: string | null;
  items: Record<string, CartItem>; // keyed by dayDate
  customer: CustomerInfo;
}

const emptyCustomer: CustomerInfo = {
  name: "",
  phone: "",
  notes: "",
};

interface CartContextValue {
  menuId: string | null;
  items: CartItem[];
  customer: CustomerInfo;
  total: number;
  setMenuId: (menuId: string) => void;
  setDayItem: (dayDate: string, item: CartItem) => void;
  setItemQuantity: (dayDate: string, quantity: number) => void;
  removeDayItem: (dayDate: string) => void;
  setCustomer: (customer: CustomerInfo) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readInitialState(): CartState {
  if (typeof window === "undefined") {
    return { menuId: null, items: {}, customer: emptyCustomer };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { menuId: null, items: {}, customer: emptyCustomer };
    const parsed = JSON.parse(raw) as CartState;
    return {
      menuId: parsed.menuId ?? null,
      items: parsed.items ?? {},
      customer: { ...emptyCustomer, ...parsed.customer },
    };
  } catch {
    return { menuId: null, items: {}, customer: emptyCustomer };
  }
}

const initialState: CartState = { menuId: null, items: {}, customer: emptyCustomer };

export function CartProvider({ children }: { children: ReactNode }) {
  // Always start from the SSR-safe default so the first client render matches
  // the server render; sessionStorage is only readable after mount.
  const [state, setState] = useState<CartState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage, not derivable during render
    setState(readInitialState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setMenuId = useCallback((menuId: string) => {
    setState((prev) => (prev.menuId === menuId ? prev : { ...prev, menuId, items: {} }));
  }, []);

  const setDayItem = useCallback((dayDate: string, item: CartItem) => {
    setState((prev) => ({ ...prev, items: { ...prev.items, [dayDate]: item } }));
  }, []);

  const setItemQuantity = useCallback((dayDate: string, quantity: number) => {
    setState((prev) => {
      const existing = prev.items[dayDate];
      if (!existing) return prev;
      const clamped = Math.max(1, quantity);
      return { ...prev, items: { ...prev.items, [dayDate]: { ...existing, quantity: clamped } } };
    });
  }, []);

  const removeDayItem = useCallback((dayDate: string) => {
    setState((prev) => {
      const next = { ...prev.items };
      delete next[dayDate];
      return { ...prev, items: next };
    });
  }, []);

  const setCustomer = useCallback((customer: CustomerInfo) => {
    setState((prev) => ({ ...prev, customer }));
  }, []);

  const clearCart = useCallback(() => {
    setState({ menuId: null, items: {}, customer: emptyCustomer });
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const items = useMemo(
    () => Object.values(state.items).sort((a, b) => a.dayDate.localeCompare(b.dayDate)),
    [state.items]
  );

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const lineUnit = item.unitPrice + item.selectedOptions.reduce((s, o) => s + o.extraCost, 0);
        return sum + lineUnit * item.quantity;
      }, 0),
    [items]
  );

  const value: CartContextValue = {
    menuId: state.menuId,
    items,
    customer: state.customer,
    total,
    setMenuId,
    setDayItem,
    setItemQuantity,
    removeDayItem,
    setCustomer,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
