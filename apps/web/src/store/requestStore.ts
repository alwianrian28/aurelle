import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address, Category, Currency, CustomRequest, I18nText, RequestKind } from '../types/domain';

/**
 * Pengajuan PO/Custom (mock) — F-09.
 * Backend nyata membuat CustomRequest + assignee Sales/CS (FR-09-07).
 * Setiap submit membuat pengajuan baru; penggabungan dilakukan manual oleh staf (alur alternatif F-09).
 */

export interface RequestDraft {
  kind: RequestKind;
  category: Category;
  productRef?: { productId: string; slug: string; name: I18nText };
  designReference: string;
  material: string;
  size: string;
  engraving: string;
  budgetAmount: string;
  budgetCurrency: Currency;
  quantity: number;
  addressId: string;
  notes: string;
}

interface CreateInput {
  userId: string;
  draft: RequestDraft;
  address: Address;
}

interface RequestState {
  requests: CustomRequest[];
  /**
   * Draf form yang disimpan sebelum diarahkan ke login (AC-09-01:
   * "diarahkan ke login lalu kembali ke form terisi").
   */
  pendingDraft: RequestDraft | null;
  saveDraft: (draft: RequestDraft) => void;
  clearDraft: () => void;
  createRequest: (input: CreateInput) => CustomRequest;
}

function nextNumber(count: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `REQ-${ymd}-${String(count + 1).padStart(4, '0')}`;
}

export const useRequestStore = create<RequestState>()(
  persist(
    (set, get) => ({
      requests: [],
      pendingDraft: null,
      saveDraft: (draft) => set({ pendingDraft: draft }),
      clearDraft: () => set({ pendingDraft: null }),
      createRequest: ({ userId, draft, address }) => {
        const now = new Date().toISOString();
        const amount = Number(draft.budgetAmount);
        const request: CustomRequest = {
          id: `req-${Date.now()}`,
          number: nextNumber(get().requests.length),
          userId,
          kind: draft.kind,
          category: draft.category,
          productRef: draft.productRef,
          designReference: draft.designReference.trim(),
          material: draft.material.trim(),
          size: draft.size.trim(),
          engraving: draft.engraving.trim(),
          // FR-09-05: anggaran opsional, tidak ada minimum.
          budget: draft.budgetAmount.trim() && amount > 0 ? { amount, currency: draft.budgetCurrency } : undefined,
          quantity: Math.max(1, Math.floor(draft.quantity) || 1),
          addressSnapshot: { ...address },
          notes: draft.notes.trim(),
          status: 'submitted',
          createdAt: now,
          history: [{ status: 'submitted', at: now }],
        };
        set((s) => ({ requests: [request, ...s.requests], pendingDraft: null }));
        return request;
      },
    }),
    { name: 'aurelle_requests' },
  ),
);
