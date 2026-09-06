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

export type LedgerTransaction = {
  id: number; calendar_id: number; account_id: number; owner_user_id: number;
  owner_name: string; account_name: string; category_id: number; category_name: string;
  transaction_date: string; transaction_time: string | null;
  direction: "INFLOW" | "OUTFLOW"; transaction_kind: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string; description: string; counterparty: string; memo: string;
  is_reversal?: number; original_transaction_id?: number | null;
  entry_source?: "MANUAL" | "EXCEL";
  classification_source?: "MANUAL" | "RULE";
  transfer_link_id?: number | null; link_type?: "SELF" | "MEMBER" | null;
  linked_transaction_id?: number | null;
};
export type LedgerTransactionPayload = {
  calendarId: number; accountId: number; transactionDate: string; transactionTime: string | null;
  direction: LedgerTransaction["direction"]; transactionKind: LedgerTransaction["transaction_kind"];
  amount: string; categoryId: number; description: string; counterparty: string; memo: string;
  isReversal?: boolean; originalTransactionId?: number | null;
  entrySource?: "MANUAL" | "EXCEL";
  allowDuplicate?: boolean;
  classificationSource?: "MANUAL" | "RULE";
};
export async function getLedgerTransactions(calendarId: number, startDate: string, endDate: string, ownerUserId?: number) {
  const query = new URLSearchParams({ calendarId: String(calendarId), startDate, endDate });
  if (ownerUserId) query.set("ownerUserId", String(ownerUserId));
  return apiFetch<{ ok: boolean; transactions: LedgerTransaction[]; canManage: boolean }>(`/api/ledger/transactions?${query}`);
}
export async function saveLedgerTransaction(payload: LedgerTransactionPayload, id?: number) {
  return apiFetch<{ ok: boolean; transactionId?: number }>(id ? `/api/ledger/transactions/${id}` : "/api/ledger/transactions", {
    method: id ? "PUT" : "POST", body: JSON.stringify(payload),
  });
}
export type LedgerDuplicateStatus = "NONE" | "EXACT" | "SUSPECTED";
export async function checkLedgerTransactionDuplicates(calendarId: number, rows: LedgerTransactionPayload[]) {
  return apiFetch<{ ok: boolean; statuses: LedgerDuplicateStatus[] }>("/api/ledger/transactions/duplicates", {
    method: "POST", body: JSON.stringify({ calendarId, rows }),
  });
}
export async function deleteLedgerTransaction(id: number) {
  return apiFetch<{ ok: boolean }>(`/api/ledger/transactions/${id}`, { method: "DELETE" });
}

export type LedgerTransferCandidate = {
  id: number; transactionDate: string; direction: "INFLOW" | "OUTFLOW"; amount: string;
  description: string; ownerId: number; ownerName: string; accountId: number; accountName: string;
  linkType: "SELF" | "MEMBER";
};
export async function getLedgerTransferCandidates(transactionId: number) {
  return apiFetch<{ ok: boolean; transactionId: number; candidates: LedgerTransferCandidate[] }>(
    `/api/ledger/transfer-candidates?transactionId=${transactionId}`,
  );
}
export async function createLedgerTransferLink(transactionId: number, candidateId: number) {
  return apiFetch<{ ok: boolean; linkId: number; linkType: "SELF" | "MEMBER" }>("/api/ledger/transfer-links", {
    method: "POST", body: JSON.stringify({ transactionId, candidateId }),
  });
}
export async function deleteLedgerTransferLink(linkId: number) {
  return apiFetch<{ ok: boolean }>(`/api/ledger/transfer-links/${linkId}`, { method: "DELETE" });
}

export type LedgerOverviewCategory = {
  rootId: number; rootName: string; middleId: number; middleName: string;
  income: string; expense: string;
};
export type LedgerOverviewLeafCategory = LedgerOverviewCategory & { leafId: number; leafName: string };
export type LedgerOverviewRecent = {
  id: number; transactionDate: string; transactionKind: LedgerTransaction["transaction_kind"];
  amount: string; description: string; counterparty: string; ownerName: string;
  rootName: string; middleName: string; leafName: string; categoryPath: string;
  isReversal?: boolean; originalTransactionId?: number | null;
};
export type LedgerOverviewData = {
  ok: boolean; startMonth: string; endMonth: string; currentUserId: number;
  members: Array<{ user_id: number; name: string }>;
  totals: { income: string; expense: string; balance: string; transferInflow: string; transferOutflow: string; netCashFlow: string };
  categories: LedgerOverviewCategory[]; leafCategories: LedgerOverviewLeafCategory[];
  history: Array<{ month: string; income: string; expense: string; balance: string }>;
  recent: LedgerOverviewRecent[];
};
export async function getLedgerOverview(calendarId: number, startMonth: string, endMonth: string, ownerUserId?: number | "all") {
  const query = new URLSearchParams({ calendarId: String(calendarId), startMonth, endMonth });
  if (ownerUserId) query.set("ownerUserId", String(ownerUserId));
  return apiFetch<LedgerOverviewData>(`/api/ledger/overview?${query}`);
}

export type LedgerImportMapping = {
  date?: string; time?: string; description?: string; counterparty?: string; memo?: string;
  amount?: string; income?: string; expense?: string; direction?: string;
};
export type LedgerImportRules = {
  amountMode: "SIGNED" | "SEPARATE" | "DIRECTION";
  dateFormat: "AUTO" | "YMD" | "YMDHMS" | "EXCEL_SERIAL";
  inflowValues?: string[]; outflowValues?: string[];
  excludeColumn?: string; excludeValues?: string[];
};
export type LedgerImportProfile = {
  id: number; calendar_id: number; profile_name: string; institution_name: string;
  sheet_name: string | null; header_row: number; header_signature: string;
  mapping: LedgerImportMapping; rules: LedgerImportRules; is_active: number;
  created_at: string; updated_at: string;
};
export type LedgerImportProfilePayload = {
  calendarId: number; profileName: string; institutionName: string; sheetName: string;
  headerRow: number; headerSignature: string; mapping: LedgerImportMapping;
  rules: LedgerImportRules; isActive: boolean;
};
export async function getLedgerImportProfiles(calendarId: number) {
  return apiFetch<{ ok: boolean; profiles: LedgerImportProfile[]; canManage: boolean }>(
    `/api/ledger/import-profiles?calendarId=${calendarId}`,
  );
}
export async function saveLedgerImportProfile(payload: LedgerImportProfilePayload, profileId?: number) {
  return apiFetch<{ ok: boolean; profileId?: number }>(
    profileId ? `/api/ledger/import-profiles/${profileId}` : "/api/ledger/import-profiles",
    { method: profileId ? "PUT" : "POST", body: JSON.stringify(payload) },
  );
}

export type LedgerImportTransactionRow = {
  transactionDate: string; transactionTime: string | null;
  transactionKind: "INCOME" | "EXPENSE" | "TRANSFER";
  direction: "INFLOW" | "OUTFLOW"; amount: string; categoryId: number;
  description: string; counterparty: string; memo: string; isReversal: boolean;
};
export async function importLedgerTransactions(payload: {
  calendarId: number; profileId: number; accountId: number;
  excludedCount: number; rows: LedgerImportTransactionRow[];
}) {
  return apiFetch<{ ok: boolean; importedCount: number }>("/api/ledger/import-transactions", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export type LedgerClassificationRule = {
  id: number; calendar_id: number;
  match_value: string; category_id: number;
  is_active: number; created_at: string; updated_at: string;
};
export async function getLedgerClassificationRules(calendarId: number) {
  return apiFetch<{ ok: boolean; rules: LedgerClassificationRule[]; canManage: boolean }>(
    `/api/ledger/classification-rules?calendarId=${calendarId}`,
  );
}
export async function syncLedgerCategoryClassificationRules(
  calendarId: number,
  categoryId: number,
  matchValues: string[],
) {
  return apiFetch<{ ok: boolean }>(`/api/ledger/classification-rules/category/${categoryId}`, {
    method: "PUT", body: JSON.stringify({ calendarId, matchValues }),
  });
}
export type LedgerClassificationInput = {
  description: string; memo: string;
};
export async function classifyLedgerTransactions(calendarId: number, rows: LedgerClassificationInput[]) {
  return apiFetch<{ ok: boolean; results: Array<{
    ruleId: number | null; categoryId: number | null; status: "MATCHED" | "NONE" | "CONFLICT";
  }> }>(
    "/api/ledger/classify", { method: "POST", body: JSON.stringify({ calendarId, rows }) },
  );
}
