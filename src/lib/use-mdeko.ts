import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "./use-session";

import {
  acceptWave,
  chooseCash,
  confirmCash,
  cancelWave,
  advanceOrder,
  createWave,
  getMyWave,
  listMyOrders,
  listMySettlements,
  listOpenWaves,
  startMomoPayment,
  verifyMomoPayment,
  demoApproveMomoPayment,
  type Order,
  type Wave,
} from "./mdeko.functions";

const LIVE_MS = 4000;

/** The buyer's most recent wave, refreshed so both phones stay in sync. */
export function useMyWave(enabled: boolean) {
  const { userId } = useSession();
  const fn = useServerFn(getMyWave);
  return useQuery<Wave | null>({
    queryKey: ["mdeko", "my-wave", userId],
    queryFn: () => fn(),
    enabled: enabled && Boolean(userId),
    refetchInterval: enabled ? LIVE_MS : false,
  });
}

/** Waves any trader can still accept. */
export function useOpenWaves(enabled: boolean) {
  const { userId } = useSession();
  const fn = useServerFn(listOpenWaves);
  return useQuery<Wave[]>({
    queryKey: ["mdeko", "open-waves", userId],
    queryFn: () => fn(),
    enabled: enabled && Boolean(userId),
    refetchInterval: enabled ? LIVE_MS : false,
  });
}

/** Orders where I am the buyer or the trader. */
export function useMyOrders(enabled: boolean) {
  const { userId } = useSession();
  const fn = useServerFn(listMyOrders);
  return useQuery<Order[]>({
    queryKey: ["mdeko", "my-orders", userId],
    queryFn: () => fn(),
    enabled: enabled && Boolean(userId),
    refetchInterval: enabled ? LIVE_MS : false,
  });
}

export function useMySettlements(enabled: boolean) {
  const { userId } = useSession();
  const fn = useServerFn(listMySettlements);
  return useQuery({
    queryKey: ["mdeko", "settlements", userId],
    queryFn: () => fn(),
    enabled: enabled && Boolean(userId),
  });
}

function useRefreshLive() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["mdeko"] });
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace"] });
  };
}

export function useMdekoActions() {
  const refresh = useRefreshLive();
  const create = useServerFn(createWave);
  const accept = useServerFn(acceptWave);
  const advance = useServerFn(advanceOrder);
  const pay = useServerFn(startMomoPayment);
  const verify = useServerFn(verifyMomoPayment);
  const demoApprove = useServerFn(demoApproveMomoPayment);
  const cash = useServerFn(chooseCash);
  const confirmedCash = useServerFn(confirmCash);
  const cancel = useServerFn(cancelWave);

  const createWaveMutation = useMutation({
    mutationFn: (data: {
      items: { id: string; qty: number }[];
      wish: string;
      note: string;
      lat: number | null;
      lng: number | null;
    }) => create({ data }),
    onSuccess: refresh,
  });

  const acceptWaveMutation = useMutation({
    mutationFn: (waveId: string) => accept({ data: { waveId } }),
    onSuccess: refresh,
  });

  const advanceOrderMutation = useMutation({
    mutationFn: (data: {
      orderId: string;
      status: "preparing" | "ready" | "delivering" | "delivered" | "completed";
    }) => advance({ data }),
    onSuccess: refresh,
  });

  const startPaymentMutation = useMutation({
    mutationFn: (data: { orderId: string; msisdn: string }) => pay({ data }),
    onSuccess: refresh,
  });

  const demoApproveMutation = useMutation({
    mutationFn: (data: { orderId: string; msisdn?: string }) => demoApprove({ data }),
    onSuccess: refresh,
  });

  return {
    createWave: createWaveMutation,
    acceptWave: acceptWaveMutation,
    advanceOrder: advanceOrderMutation,
    startPayment: startPaymentMutation,
    demoApprovePayment: demoApproveMutation,
    verifyPayment: async (orderId: string) => {
      const payment = await verify({ data: { orderId } });
      if (payment?.status === "successful" || payment?.status === "failed") refresh();
      return payment;
    },
    chooseCash: useMutation({
      mutationFn: (orderId: string) => cash({ data: { orderId } }),
      onSuccess: refresh,
    }),
    confirmCash: useMutation({
      mutationFn: (orderId: string) => confirmedCash({ data: { orderId } }),
      onSuccess: refresh,
    }),
    cancelWave: useMutation({
      mutationFn: (waveId: string) => cancel({ data: { waveId } }),
      onSuccess: refresh,
    }),
    refresh,
  };
}
