"use client"
import { useSyncExternalStore } from "react"
import { getAuth, subscribeAuth, type AuthState } from "@/lib/auth"

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuth, () => null)
}
