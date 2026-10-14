import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokens } from "./api";
import type { MyOrganization, User } from "./types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    enabled: !!tokens.access,
    retry: false,
  });
}

export function useMyOrganizations(enabled: boolean) {
  return useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => api<MyOrganization[]>("/organizations/my"),
    enabled,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    tokens.clear();
    qc.clear();
    window.location.href = "/";
  };
}
