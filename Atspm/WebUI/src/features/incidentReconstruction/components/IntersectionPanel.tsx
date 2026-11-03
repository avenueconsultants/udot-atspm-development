// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - IntersectionPanel.tsx
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
import {
  BADGE_COLOR,
  INDICATION_COLORS,
  UNKNOWN_COLOR,
} from '@/features/incidentReconstruction/chartOption'
import {
  buildIntersectionLayout,
  detectorTimelines,
} from '@/features/incidentReconstruction/intersectionLayout'
import { toAdjusted } from '@/features/incidentReconstruction/latencyAdjustment'
import { displayName } from '@/features/incidentReconstruction/signalNames'
import { IncidentReport } from '@/features/incidentReconstruction/types'
import { SignalNames } from '@/features/incidentReconstruction/urlCodecs'
import { formatClock } from '@/features/incidentReconstruction/wallClock'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import IntersectionView from './IntersectionView'

/** The controller logs tenths of a second, so playback moves a tenth at a time. */
const TICK_MS = 100
const SPEEDS = [1, 2, 5, 10]

const LEGEND = [
  { label: 'Green', color: INDICATION_COLORS.Green },
  { label: 'Yellow', color: INDICATION_COLORS.Yellow },
  { label: 'Red', color: INDICATION_COLORS.Red },
  { label: 'Red clearance', color: INDICATION_COLORS.RedClearance },
  { label: 'Flashing yellow arrow', color: INDICATION_COLORS.Yellow },
  { label: 'Walk', color: INDICATION_COLORS.Walk },
  { label: "Flashing Don't Walk", color: INDICATION_COLORS.FlashingDontWalk },
  { label: "Don't Walk", color: INDICATION_COLORS.DontWalk },
  { label: 'Detector on', color: BADGE_COLOR },
  { label: 'Unknown', color: UNKNOWN_COLOR },
]

interface IntersectionPanelProps {
  report: IncidentReport
  names: SignalNames
  /** The window, controller clock. */
  start: number
  end: number
  /** Controller clock. */
  time: number
  adjustmentSeconds: number
  onTimeChange(time: number): void
}

export default function IntersectionPanel({
  report,
  names,
  start,
  end,
  time,
  adjustmentSeconds,
  onTimeChange,
}: IntersectionPanelProps) {
  const layout = useMemo(
    () => buildIntersectionLayout(report.approaches),
    [report.approaches]
  )
  const detectors = useMemo(
    () => detectorTimelines(report.events, start, report.approaches),
    [report.events, start, report.approaches]
  )
  const bandsByKey = useMemo(
    () => new Map(report.bands.map((band) => [band.key, band])),
    [report.bands]
  )
  // Every signal change the drawing shows, for the step buttons.
  const changeTimes = useMemo(() => {
    const keys = new Set(
      report.approaches.flatMap((approach) => [
        approach.protectedBandKey,
        approach.permissiveBandKey,
        approach.pedestrianBandKey,
      ])
    )
    const times = report.bands
      .filter((band) => keys.has(band.key))
      .flatMap((band) => band.changes.map((change) => change.time))
      .filter((changeTime) => changeTime > start && changeTime <= end)
    return [...new Set(times)].sort((a, b) => a - b)
  }, [report.approaches, report.bands, start, end])

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const timeRef = useRef(time)
  timeRef.current = time
  const onTimeChangeRef = useRef(onTimeChange)
  onTimeChangeRef.current = onTimeChange

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const next = Math.min(end, timeRef.current + TICK_MS * speed)
      onTimeChangeRef.current(next)
      if (next >= end) setPlaying(false)
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [playing, speed, end])

  const unplacedNames = layout.unplacedCrosswalks.flatMap((key) => {
    const band = bandsByKey.get(key)
    return band ? [displayName(band, names)] : []
  })

  const previousChange = [...changeTimes].reverse().find((t) => t < time)
  const nextChange = changeTimes.find((t) => t > time)

  const handlePlay = () => {
    if (!playing && time >= end) onTimeChange(start)
    setPlaying(!playing)
  }

  if (layout.legs.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
        This location has no approaches with a direction, so there is nothing to
        draw.
      </Typography>
    )
  }

  return (
    // The drawing on the left, its controls on the right, stacked when narrow.
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 3,
      }}
    >
      <Box sx={{ flex: '0 1 420px', minWidth: 280 }}>
        <IntersectionView
          layout={layout}
          bandsByKey={bandsByKey}
          names={names}
          detectors={detectors}
          time={time}
        />
      </Box>

      <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
        <Typography
          variant="h6"
          component="p"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatClock(toAdjusted(time, adjustmentSeconds))}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <Tooltip title="Previous signal change">
            <span>
              <IconButton
                aria-label="Previous signal change"
                disabled={previousChange === undefined}
                onClick={() =>
                  previousChange !== undefined && onTimeChange(previousChange)
                }
              >
                <SkipPreviousIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={playing ? 'Pause' : 'Play'}>
            <IconButton
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={handlePlay}
            >
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Next signal change">
            <span>
              <IconButton
                aria-label="Next signal change"
                disabled={nextChange === undefined}
                onClick={() =>
                  nextChange !== undefined && onTimeChange(nextChange)
                }
              >
                <SkipNextIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Select
            size="small"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            aria-label="Playback speed"
            sx={{ ml: 1, '& .MuiSelect-select': { py: 0.5 } }}
          >
            {SPEEDS.map((value) => (
              <MenuItem key={value} value={value}>
                {value}×
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Slider
          size="small"
          min={start}
          max={end}
          step={TICK_MS}
          value={Math.min(end, Math.max(start, time))}
          onChange={(_, value) => onTimeChange(value as number)}
          aria-label="Time"
          sx={{ mt: 1 }}
        />
        <Typography variant="caption" color="text.secondary" component="p">
          Click the chart to jump to a time.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: 1.5,
            rowGap: 0.5,
            mt: 3,
          }}
        >
          {LEGEND.map((item) => (
            <Box
              key={item.label}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  bgcolor: item.color,
                }}
              />
              <Typography variant="caption">{item.label}</Typography>
            </Box>
          ))}
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 1.5 }}
        >
          Drawn from the location&apos;s approaches and detectors; only detector
          distances are to scale. Lanes without a detector aren&apos;t shown,
          and which crosswalk each pedestrian signal serves is a guess.
          {layout.undrawn.length > 0 &&
            ` ${layout.undrawn.length} approach${
              layout.undrawn.length === 1 ? ' has' : 'es have'
            } no direction and aren't drawn.`}
          {unplacedNames.length > 0 &&
            ` ${unplacedNames.join(', ')} ${
              unplacedNames.length === 1 ? 'has' : 'have'
            } no crosswalk beside ${
              unplacedNames.length === 1 ? 'its approach' : 'their approaches'
            }, so ${unplacedNames.length === 1 ? "it isn't" : "they aren't"} drawn.`}
        </Typography>
      </Box>
    </Box>
  )
}
