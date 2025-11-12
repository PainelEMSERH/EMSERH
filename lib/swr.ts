// lib/swr.ts
import { SWRConfiguration } from 'swr';

export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateIfStale: true,
  revalidateOnReconnect: true,
  keepPreviousData: true,
  dedupingInterval: 1000 * 5,
  errorRetryCount: 2,
};
