import { Location } from '@/api/config'

// ConfigApi's shared keyed GET (ConfigControllerBase.Get(TKey, ...)) hands its
// result to OData as an IQueryable, so [EnableQuery] serializes even this
// single-entity endpoint as a collection: the response is a
// { value: [ location ] } envelope, which axios.ts's central OData unwrap turns
// into a one-item array. Narrow that to the single location callers want. A bare
// entity is still accepted, so the app also works against a config API that
// serializes one.
export function unwrapLocationFromKey(
  result: Location | Location[] | undefined
): Location | undefined {
  return Array.isArray(result) ? result[0] : result
}
