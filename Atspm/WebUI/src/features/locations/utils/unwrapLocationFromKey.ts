import { Location } from '@/api/config'

// ConfigApi's shared keyed GET action (ConfigControllerBase.Get(TKey, ...))
// returns Ok(SingleResult.Create(result).Queryable) - a known OData anti-
// pattern that makes the [EnableQuery] formatter serialize even this
// single-entity endpoint as a { value: [...] } collection envelope.
// axios.ts's central OData unwrap turns that into a bare array, so
// getLocationFromKey/useGetLocationFromKey callers need this extra step to
// get back to a single Location.
export function unwrapLocationFromKey(
  result: Location | Location[] | undefined
): Location | undefined {
  return Array.isArray(result) ? result[0] : result
}
