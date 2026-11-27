import { Box, Typography } from '@mui/material'
import { ringOrder, splitTableFor } from '../splits'
import type { ControllerSnapshot, Phase, ReviewItem } from '../types'

export function barriersFor(phases: Phase[]) {
  const byNumber = new Map(phases.map((phase) => [phase.phase, phase]))
  const remaining = new Set(byNumber.keys())
  const groups: Phase[][] = []
  for (const first of phases) {
    if (!remaining.delete(first.phase)) continue
    const group = [first]
    for (const current of group) {
      for (const candidate of phases) {
        const concurrent =
          current.concurrent?.includes(candidate.phase) ||
          candidate.concurrent?.includes(current.phase)
        const sameReportedBarrier =
          current.concurrent == null &&
          candidate.concurrent == null &&
          current.barrier &&
          current.barrier === candidate.barrier
        if (
          (concurrent || sameReportedBarrier) &&
          remaining.delete(candidate.phase)
        ) {
          group.push(candidate)
        }
      }
    }
    groups.push(phases.filter((phase) => group.includes(phase)))
  }
  return groups
}

export function phaseProvenance(phase: Phase, items: ReviewItem[]) {
  const changes = items.filter(
    (item) =>
      item.field.startsWith(`phases.${phase.phase}.`) ||
      item.field === `approaches.${phase.phase}`
  )
  return [
    phase.source,
    ...changes.map(
      (item) =>
        `${item.field} · ATSPM ${item.baselineValue} · Controller ${item.controllerValue} · ${item.sources}`
    ),
  ]
    .filter(Boolean)
    .join('\n')
}

export default function RingBarrierDiagram({
  snapshot,
  pattern,
  items,
}: {
  snapshot: ControllerSnapshot
  pattern?: ControllerSnapshot['patterns'][number]
  items: ReviewItem[]
}) {
  const excluded = new Set(snapshot.phasesNotInUse.map(({ phase }) => phase))
  const phases = snapshot.phases.filter(
    (phase) => phase.inUse !== false && !excluded.has(phase.phase)
  )
  const drawn = phases.filter((phase) => phase.ring != null && phase.ring > 0)
  const rings = [...new Set(drawn.map((phase) => phase.ring!))].sort(
    (a, b) => a - b
  )
  const splits = splitTableFor(snapshot, pattern)
  const { order: orderByRing, basis } = ringOrder(snapshot, pattern)
  const groups = barriersFor(drawn)
  if (basis === 'sequence') {
    const rank = (group: Phase[]) =>
      Math.min(
        ...group.map((phase) =>
          orderByRing.get(phase.ring!)!.indexOf(phase.phase)
        )
      )
    groups.sort((a, b) => rank(a) - rank(b))
  }
  if (!drawn.length)
    return (
      <Typography color="text.secondary">
        Ring-barrier structure is unavailable for this snapshot.
      </Typography>
    )

  const ringWidth = 85
  const gap = 12
  const rowHeight = 100
  const layouts = groups.map((group) => {
    const groupRings = rings.map((ring) =>
      group
        .filter((phase) => phase.ring === ring)
        .sort(
          (a, b) =>
            orderByRing.get(ring)!.indexOf(a.phase) -
            orderByRing.get(ring)!.indexOf(b.phase)
        )
    )
    const widths = groupRings.map((phasesForRing, index) =>
      phasesForRing.map((phase) => {
        const split =
          basis === 'sequence'
            ? splits?.ringSplits[String(rings[index])]?.[
                orderByRing.get(rings[index])!.indexOf(phase.phase)
              ]
            : undefined
        return split !== undefined ? Math.max(58, split * 4) : 125
      })
    )
    return {
      group,
      groupRings,
      widths,
      width:
        Math.max(
          ...widths.map((row) =>
            row.reduce((sum, width) => sum + width + gap, 0)
          )
        ) + gap,
    }
  })
  const width =
    ringWidth + layouts.reduce((sum, barrier) => sum + barrier.width, 0)
  const height = 46 + rings.length * rowHeight
  return (
    <Box>
      <Box
        sx={{
          overflowX: 'auto',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: 1,
        }}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: Math.min(width, 740), display: 'block' }}
          role="img"
          aria-label="Controller ring-barrier diagram"
        >
          {rings.map((ring, index) => (
            <text
              key={ring}
              x={16}
              y={86 + index * rowHeight}
              fill="currentColor"
            >
              Ring {ring}
            </text>
          ))}
          {layouts.map(
            (
              { group, groupRings, widths, width: barrierWidth },
              groupIndex
            ) => {
              const x =
                ringWidth +
                layouts
                  .slice(0, groupIndex)
                  .reduce((sum, layout) => sum + layout.width, 0)
              const label =
                group.find((phase) => phase.barrier)?.barrier ?? groupIndex + 1
              return (
                <g key={group.map((phase) => phase.phase).join('-')}>
                  <rect
                    x={x + 2}
                    y={6}
                    width={barrierWidth - 5}
                    height={height - 12}
                    rx={9}
                    fill="#f4f7fa"
                  />
                  <text x={x + 12} y={28} fontSize={14} fill="#324967">
                    Barrier {label}
                  </text>
                  {groupRings.flatMap((row, ringIndex) =>
                    row.map((phase, column) => {
                      const y = 45 + ringIndex * rowHeight
                      const boxX =
                        x +
                        gap +
                        widths[ringIndex]
                          .slice(0, column)
                          .reduce((sum, cell) => sum + cell + gap, 0)
                      const changed = items.some(
                        (item) =>
                          item.field.startsWith(`phases.${phase.phase}.`) ||
                          item.field === `approaches.${phase.phase}`
                      )
                      const overlaps = snapshot.overlaps.filter(
                        (entry) =>
                          entry.type > 1 &&
                          entry.includedPhases.includes(phase.phase)
                      )
                      const detectorCount = snapshot.detectors.filter(
                        (detector) => detector.callPhase === phase.phase
                      ).length
                      return (
                        <g key={phase.phase}>
                          <title>
                            {phaseProvenance(phase, items) ||
                              `Controller phase ${phase.phase}`}
                          </title>
                          <rect
                            x={boxX}
                            y={y}
                            width={widths[ringIndex][column]}
                            height={73}
                            rx={6}
                            fill={changed ? '#e4f0ff' : '#fff'}
                            stroke={changed ? '#2765aa' : '#b9c8d7'}
                          />
                          <text
                            x={boxX + 8}
                            y={y + 23}
                            fontSize={15}
                            fontWeight={600}
                            fill="#183655"
                          >
                            Phase {phase.phase}
                          </text>
                          {detectorCount > 0 && (
                            <text
                              x={boxX + 8}
                              y={y + 43}
                              fontSize={11}
                              fill="#3d5268"
                            >
                              {detectorCount} detectors
                            </text>
                          )}
                          {overlaps.length > 0 && (
                            <text
                              x={boxX + 8}
                              y={y + 61}
                              fontSize={11}
                              fill="#3d5268"
                            >
                              Overlap{' '}
                              {overlaps
                                .map((entry) => entry.overlap)
                                .join(', ')}
                            </text>
                          )}
                        </g>
                      )
                    })
                  )}
                </g>
              )
            }
          )}
        </svg>
      </Box>
      {basis === 'assumed' && (
        <Typography variant="caption" color="text.secondary">
          Sequence definition unavailable. Phases follow ascending order within
          each ring, and the boxes are not drawn to the programmed splits.
        </Typography>
      )}
      {phases.length > drawn.length && (
        <Typography variant="body2" color="text.secondary">
          Ring data unavailable for phases{' '}
          {phases
            .filter((phase) => !drawn.includes(phase))
            .map((phase) => phase.phase)
            .join(', ')}
          .
        </Typography>
      )}
    </Box>
  )
}
