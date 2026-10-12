// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - AdjustmentField.tsx
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
import { MAX_ADJUSTMENT_SECONDS } from '@/features/incidentReconstruction/latencyAdjustment'
import CloseIcon from '@mui/icons-material/Close'
import { Box, Button, TextField, Tooltip } from '@mui/material'
import { useEffect, useState } from 'react'

/** Shifts every time shown below it. The report is not fetched again. */
export default function AdjustmentField({
  adjustmentSeconds,
  onChange,
}: {
  adjustmentSeconds: number
  onChange(seconds: number): void
}) {
  const [text, setText] = useState(String(adjustmentSeconds))

  useEffect(() => {
    setText((current) =>
      Number(current) === adjustmentSeconds
        ? current
        : String(adjustmentSeconds)
    )
  }, [adjustmentSeconds])

  const handleText = (next: string) => {
    setText(next)
    const seconds = Number(next)
    if (next.trim() !== '' && Number.isFinite(seconds)) onChange(seconds)
  }

  return (
    // The reset sits outside the field and is always there, so it never
    // appears under the pointer while stepping up from zero.
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField
        label="Latency adjustment (s)"
        size="small"
        type="number"
        value={text}
        onChange={(event) => handleText(event.target.value)}
        onBlur={() => setText(String(adjustmentSeconds))}
        inputProps={{
          step: 0.1,
          min: -MAX_ADJUSTMENT_SECONDS,
          max: MAX_ADJUSTMENT_SECONDS,
        }}
        sx={{ width: 200 }}
      />
      <Tooltip title="Reset to 0">
        {/* A disabled button fires no events, so the tooltip needs a wrapper. */}
        <span>
          {/* Square, as tall as the field. */}
          <Button
            variant="contained"
            disableElevation
            aria-label="Reset latency adjustment"
            disabled={adjustmentSeconds === 0}
            onClick={() => onChange(0)}
            sx={{ minWidth: 0, width: 40, height: 40, p: 0 }}
          >
            <CloseIcon fontSize="small" />
          </Button>
        </span>
      </Tooltip>
    </Box>
  )
}
