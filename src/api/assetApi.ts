import { apiFetch } from "./client";

export type AssetInstitution = { id: number; calendar_id: number; institution_name: string; is_active: number; display_order: number };
export type AssetAccountType = { id: number; calendar_id: number; type_name: string; asset_kind: "ASSET" | "LIABILITY"; requires_institution: number; allows_available: number; is_active: number; display_order: number };
export type AssetMember = { user_id: number; name: string; role: "owner" | "editor" | "viewer" };
export type AssetAccount = {
  id: number; calendar_id: number; owner_user_id: number; owner_name: string; institution_id: number | null;
  institution_name: string | null; account_type_id: number; type_name: string; asset_kind: "ASSET" | "LIABILITY";
  requires_institution: number; allows_available: number; account_name: string; is_available: number | null;
  is_active: number; display_order: number; memo: string;
};

export type ReferencePayload = { calendarId: number; name: string; isActive?: boolean; displayOrder: number };
export type AccountTypePayload = ReferencePayload & { assetKind: "ASSET" | "LIABILITY"; requiresInstitution: boolean; allowsAvailable: boolean };
export type AssetAccountPayload = { calendarId: number; ownerUserId: number; institutionId: number | null; accountTypeId: number; accountName: string; isActive: boolean; displayOrder: number; memo: string };

export async function getAssetInstitutions(calendarId: number) {
  return apiFetch<{ ok: boolean; institutions: AssetInstitution[]; canManage: boolean }>(`/api/assets/institutions?calendarId=${calendarId}`);
}
export async function saveAssetInstitution(payload: ReferencePayload, id?: number) {
  return apiFetch<{ ok: boolean }>(id ? `/api/assets/institutions/${id}` : "/api/assets/institutions", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
}
export async function deleteAssetInstitution(id: number) { return apiFetch<{ ok: boolean }>(`/api/assets/institutions/${id}`, { method: "DELETE" }); }
export async function reorderAssetInstitutions(calendarId: number, ids: number[]) { return apiFetch<{ ok: boolean }>("/api/assets/institutions/reorder", { method: "POST", body: JSON.stringify({ calendarId, ids }) }); }
export async function getAssetAccountTypes(calendarId: number) {
  return apiFetch<{ ok: boolean; accountTypes: AssetAccountType[]; canManage: boolean }>(`/api/assets/account-types?calendarId=${calendarId}`);
}
export async function saveAssetAccountType(payload: AccountTypePayload, id?: number) {
  return apiFetch<{ ok: boolean }>(id ? `/api/assets/account-types/${id}` : "/api/assets/account-types", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
}
export async function deleteAssetAccountType(id: number) { return apiFetch<{ ok: boolean }>(`/api/assets/account-types/${id}`, { method: "DELETE" }); }
export async function reorderAssetAccountTypes(calendarId: number, ids: number[]) { return apiFetch<{ ok: boolean }>("/api/assets/account-types/reorder", { method: "POST", body: JSON.stringify({ calendarId, ids }) }); }
export async function getAssetAccounts(calendarId: number) {
  return apiFetch<{ ok: boolean; accounts: AssetAccount[]; members: AssetMember[]; currentUserId: number; role: AssetMember["role"] }>(`/api/assets/accounts?calendarId=${calendarId}`);
}
export async function saveAssetAccount(payload: AssetAccountPayload, id?: number) {
  return apiFetch<{ ok: boolean; accountId?: number }>(id ? `/api/assets/accounts/${id}` : "/api/assets/accounts", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
}
export async function deleteAssetAccount(id: number) {
  return apiFetch<{ ok: boolean; deletionMode: "deleted" | "deactivated" }>(`/api/assets/accounts/${id}`, { method: "DELETE" });
}
export async function reorderAssetAccounts(calendarId: number, ids: number[]) {
  return apiFetch<{ ok: boolean }>("/api/assets/accounts/reorder", { method: "POST", body: JSON.stringify({ calendarId, ids }) });
}

export type MonthlyAssetAccount = {
  id: number; institutionName: string | null; typeName: string; assetKind: "ASSET" | "LIABILITY";
  isAvailable: number | null; accountName: string; memo: string; balance: string | null; previousBalance: string | null;
  updatedAt: string | null;
};
export async function getMonthlyAssetInput(calendarId: number, ownerUserId: number, yearMonth: string) {
  return apiFetch<{ ok: boolean; accounts: MonthlyAssetAccount[]; lastSavedAt: string | null; canEdit: boolean; owner: { userId: number; name: string } }>(
    `/api/assets/monthly-input?calendarId=${calendarId}&ownerUserId=${ownerUserId}&yearMonth=${encodeURIComponent(yearMonth)}`,
  );
}
export async function saveMonthlyAssetBalances(calendarId: number, ownerUserId: number, yearMonth: string, balances: Array<{ accountId: number; balance: string | null }>) {
  return apiFetch<{ ok: boolean; savedAt: string | null }>("/api/assets/monthly-balances/save", {
    method: "POST", body: JSON.stringify({ calendarId, ownerUserId, yearMonth, balances }),
  });
}

export type AssetTotals = { assets: string; liabilities: string; netAssets: string; available: string };
export type AssetSummaryMember = AssetTotals & { userId: number; name: string; missing: number };
export type AssetSummaryAccount = {
  id: number; ownerUserId: number; ownerName: string; institutionName: string | null; accountName: string;
  typeName: string; assetKind: "ASSET" | "LIABILITY"; isAvailable: number | null; isActive: number;
  balance: string | null; previousBalance: string | null;
};
export type AssetHistoryPoint = AssetTotals & { month: string; entered: number };

export async function getAssetSummary(calendarId: number, yearMonth: string) {
  return apiFetch<{ ok: boolean; yearMonth: string; totals: AssetTotals; previousTotals: AssetTotals; change: AssetTotals;
    missingCount: number; members: AssetSummaryMember[]; accounts: AssetSummaryAccount[] }>(
    `/api/assets/summary?calendarId=${calendarId}&yearMonth=${encodeURIComponent(yearMonth)}`,
  );
}

export async function getAssetHistory(calendarId: number, yearMonth: string, months = 12) {
  return apiFetch<{ ok: boolean; history: AssetHistoryPoint[] }>(
    `/api/assets/history?calendarId=${calendarId}&yearMonth=${encodeURIComponent(yearMonth)}&months=${months}`,
  );
}
