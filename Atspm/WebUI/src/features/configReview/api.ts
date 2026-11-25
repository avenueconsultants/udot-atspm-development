import {
  captureConfigReviewBaseline,
  createConfigReviews,
  getConfigReviewReport,
  getConfigReviewRoute,
  listConfigReviews,
  promoteConfigReview,
  updateConfigReviewItem,
  uploadConfigReviewJson,
} from './generated/client'
import type { Annotation, ControllerSnapshot, ReviewReport } from './types'

export const getReviews = () => listConfigReviews()
export const createReviews = createConfigReviews
export const getRouteReview = getConfigReviewRoute
export const loadBaseline = captureConfigReviewBaseline
export const promoteReview = promoteConfigReview
export const uploadSnapshot = (id: string, file: File) =>
  uploadConfigReviewJson(id, { file })
export const annotateItem = (
  id: string,
  item: string,
  disposition: string,
  annotation: Annotation | null
) =>
  updateConfigReviewItem(id, item, {
    disposition,
    annotation: annotation ?? undefined,
  })

export async function getReview(id: string): Promise<ReviewReport> {
  const report = await getConfigReviewReport(id)
  const snapshot = report.snapshot.snapshot
  const normalized: ControllerSnapshot | null = snapshot
    ? {
        ...snapshot,
        phases: snapshot.phases ?? [],
        phasesNotInUse: snapshot.phasesNotInUse ?? [],
        overlaps: snapshot.overlaps ?? [],
        patterns: snapshot.patterns ?? [],
        splitTables: snapshot.splitTables ?? [],
        sequences: snapshot.sequences ?? [],
        detectors: snapshot.detectors ?? [],
        conflicts: snapshot.conflicts ?? [],
        notes: snapshot.notes ?? [],
      }
    : null
  return { ...report, snapshot: { ...report.snapshot, snapshot: normalized } }
}
