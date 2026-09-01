"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminData } from "@/lib/admin-api";
export const adminDataKey = ["admin", "data"] as const;
export function useAdminData() {
  return useQuery({ queryKey: adminDataKey, queryFn: fetchAdminData });
}
