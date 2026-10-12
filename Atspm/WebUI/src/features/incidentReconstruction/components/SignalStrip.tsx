// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - SignalStrip.tsx
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
  INDICATION_COLORS,
  UNKNOWN_COLOR,
} from '@/features/incidentReconstruction/chartOption'
import { SignalSegment } from '@/features/incidentReconstruction/signalState'
import { Box } from '@mui/material'

/** The signal across the whole window as a thin coloured bar. */
export default function SignalStrip({
  segments,
  start,
  end,
  faded = false,
}: {
  segments: SignalSegment[]
  start: number
  end: number
  faded?: boolean
}) {
  const span = Math.max(1, end - start)
  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        height: 4,
        borderRadius: 0.5,
        overflow: 'hidden',
        opacity: faded ? 0.5 : 1,
      }}
    >
      {segments.map((segment) => (
        <Box
          key={segment.start}
          sx={{
            flexShrink: 0,
            width: `${((segment.end - segment.start) / span) * 100}%`,
            bgcolor: segment.indication
              ? INDICATION_COLORS[segment.indication]
              : UNKNOWN_COLOR,
          }}
        />
      ))}
    </Box>
  )
}
