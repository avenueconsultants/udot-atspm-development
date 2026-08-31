import { Location } from '@/api/config'

// ConfigApi's shared keyed GET action (ConfigControllerBase.Get(TKey, ...))
// used to return Ok(SingleResult.Create(result).Queryable), which made the
// [EnableQuery] formatter serialize even this single-entity endpoint as a
// { value: [...] } collection envelope that axios.ts's central OData unwrap
// then turned into a bare array. The API now returns the SingleResult
// itself and serializes one entity, matching its spec. This shim stays only
// until every deployed config API carries that fix; drop it (and its
// callers' use of it) once they do.
export function unwrapLocationFromKey(
  result: Location | Location[] | undefined
): Location | undefined {
  return Array.isArray(result) ? result[0] : result
}
