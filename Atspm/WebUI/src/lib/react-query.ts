// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - react-query.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { AxiosError } from 'axios'
import {
  DefaultOptions,
  QueryClient,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query'
import { PromiseValue } from 'type-fest'

// A 401/403 is an expected, recoverable condition rather than a defect: it
// just means the visitor isn't signed in, or lacks a claim, for something a
// component asked for. Throwing on those took down whole pages, because a
// thrown query error only degrades gracefully if an ErrorBoundary sits above
// every component that fetches - and the shared chrome (Topbar/Sidebar,
// rendered by Layout) sits outside the one _app.tsx puts around the page.
// Consumers get this for free rather than each having to remember a local
// `throwOnError: false`, which is how the crash kept reappearing at new call
// sites. Every other failure still throws, so genuine errors stay loud.
export const throwOnQueryError = (error: unknown): boolean => {
  const status = (error as AxiosError | null)?.response?.status
  return status !== 401 && status !== 403
}

const queryConfig: DefaultOptions = {
  queries: {
    throwOnError: throwOnQueryError,
    refetchOnWindowFocus: false,
    retry: false,
  },
}

// Shared app-wide instance - _app.tsx passes this same object to
// QueryClientProvider rather than creating its own via useState.
// useUpdateChartDefaults (src/features/charts/api/updateChartDefaults.ts) -
// the last surviving hand-written mutation hook with this shape - imports
// this singleton directly (not useQueryClient()) to drive cache
// invalidation, so if a future App component goes back to instantiating its
// own QueryClient, that hook's optimistic updates and invalidateQueries
// calls will silently stop reaching the on-screen cache again. A per-render
// instance would normally be preferred (it's the standard SSR-safe pattern)
// but this app never runs a query during SSR - _app.tsx keeps <Component />
// unmounted until client-side axios init finishes - so a single shared
// instance is safe here.
export const queryClient = new QueryClient({ defaultOptions: queryConfig })

// This full-table lookup backs location pickers and several admin screens.
// Match the generated query-key prefix so parameterized calls inherit the
// same cache policy without wrapping or modifying generated hooks.
queryClient.setQueryDefaults(['/Location/GetLocationsForSearch'], {
  staleTime: 5 * 60 * 1000,
  gcTime: Infinity,
})

export type ExtractFnReturnType<FnType extends (...args: any) => any> =
  PromiseValue<ReturnType<FnType>>

export type QueryConfig<QueryFnType extends (...args: any) => any> = Omit<
  UseQueryOptions<ExtractFnReturnType<QueryFnType>>,
  'queryKey' | 'queryFn'
>

export type MutationConfig<MutationFnType extends (...args: any) => any> =
  UseMutationOptions<
    ExtractFnReturnType<MutationFnType>,
    AxiosError,
    Parameters<MutationFnType>[0]
  >
