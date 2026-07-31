import { apiFetch } from "./client";

export type LedgerCategory = {
  id: number;
  calendar_id: number;
  parent_id: number | null;
  category_name: string;
  depth: 1 | 2 | 3;
  is_active: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type LedgerCategoryPayload = {
  calendarId: number;
  parentId: number | null;
  name: string;
  isActive: boolean;
  displayOrder: number;
};

export async function getLedgerCategories(calendarId: number) {
  return apiFetch<{
    ok: boolean;
    categories: LedgerCategory[];
    canManage: boolean;
  }>(`/api/ledger/categories?calendarId=${calendarId}`);
}

export async function saveLedgerCategory(
  payload: LedgerCategoryPayload,
  categoryId?: number,
) {
  return apiFetch<{ ok: boolean; categoryId?: number }>(
    categoryId ? `/api/ledger/categories/${categoryId}` : "/api/ledger/categories",
    {
      method: categoryId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function reorderLedgerCategories(
  calendarId: number,
  parentId: number | null,
  ids: number[],
) {
  return apiFetch<{ ok: boolean }>("/api/ledger/categories/reorder", {
    method: "POST",
    body: JSON.stringify({ calendarId, parentId, ids }),
  });
}

export async function deleteLedgerCategory(categoryId: number) {
  return apiFetch<{ ok: boolean }>(`/api/ledger/categories/${categoryId}`, {
    method: "DELETE",
  });
}

export async function deleteLedgerCategories(ids: number[]) {
  return apiFetch<{ ok: boolean }>("/api/ledger/categories/delete-batch", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}
