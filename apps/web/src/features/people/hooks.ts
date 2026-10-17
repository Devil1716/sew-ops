"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type UserRole = "admin" | "manager" | "operator";

export interface LiveUser {
  id: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  role: UserRole;
  isActive: boolean;
  factoryIds: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LiveAssignment {
  id: string;
  factoryId: string;
  userId: string;
  operatorName: string;
  employeeCode: string | null;
  machineId: string;
  machineName: string;
  machineCode: string;
  shiftId: string;
  shiftName: string;
  startDate: string;
  endDate: string | null;
}

export type NewUser =
  | { role: "operator"; name: string; factoryIds: string[]; employeeCode: string; pin: string }
  | { role: "manager" | "admin"; name: string; factoryIds: string[]; email: string; password: string };

export function useUsersList() {
  return useQuery({
    queryKey: ["users", "list"],
    queryFn: () => api.get<LiveUser[]>("/users?includeInactive=true"),
  });
}

export function useAssignmentsList() {
  return useQuery({
    queryKey: ["assignments", "list"],
    queryFn: () => api.get<LiveAssignment[]>("/operator-assignments"),
  });
}

function useRefreshPeople() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["users"] });
    void qc.invalidateQueries({ queryKey: ["assignments"] });
  };
}

export function useCreateUser() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: NewUser) => api.post<LiveUser>("/users", body),
    onSuccess: refresh,
  });
}

export function useUpdateUser() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (input: { id: string; patch: { name?: string; isActive?: boolean; factoryIds?: string[] } }) =>
      api.patch<LiveUser>(`/users/${input.id}`, input.patch),
    onSuccess: refresh,
  });
}

export function useResetCredentials() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (input: { id: string; secret: { pin: string } | { password: string } }) =>
      api.post<{ ok: boolean }>(`/users/${input.id}/credentials`, input.secret),
    onSuccess: refresh,
  });
}

export function useCreateAssignment() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: { userId: string; machineId: string; shiftId: string; startDate: string; endDate?: string }) =>
      api.post<LiveAssignment>("/operator-assignments", body),
    onSuccess: refresh,
  });
}

export function useEndAssignment() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (input: { id: string; endDate: string }) =>
      api.patch<LiveAssignment>(`/operator-assignments/${input.id}`, { endDate: input.endDate }),
    onSuccess: refresh,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>("/account/password", body),
  });
}