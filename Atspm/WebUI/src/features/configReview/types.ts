import type {
  ConfigReviewBaselineView,
  ConfigReviewBaselineViewApproachesItem,
  ConfigReviewEvidence,
  ConfigReviewFinding,
  ConfigReviewPhase,
  ConfigReviewReport,
  ConfigReviewSnapshot,
  ConfigReviewSnapshotReceipt,
} from './generated/client'

export type Phase = ConfigReviewPhase
export type Baseline = ConfigReviewBaselineView
export type BaselineApproach = ConfigReviewBaselineViewApproachesItem
export type ReviewItem = ConfigReviewFinding
export type Annotation = ConfigReviewEvidence
type RecordCollections =
  | 'phases'
  | 'phasesNotInUse'
  | 'overlaps'
  | 'patterns'
  | 'splitTables'
  | 'sequences'
  | 'detectors'
  | 'conflicts'
  | 'notes'
export type ControllerSnapshot = ConfigReviewSnapshot &
  Required<Pick<ConfigReviewSnapshot, RecordCollections>>
export type ReviewReport = Omit<ConfigReviewReport, 'snapshot' | 'baseline'> & {
  baseline: ConfigReviewBaselineView | null
  snapshot: Omit<ConfigReviewSnapshotReceipt, 'snapshot'> & {
    snapshot: ControllerSnapshot | null
  }
}
