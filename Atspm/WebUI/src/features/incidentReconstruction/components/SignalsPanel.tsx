// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - SignalsPanel.tsx
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
import { signalSegments } from '@/features/incidentReconstruction/signalState'
import {
  LOCATION_BAND_KEY,
  TimelineBand,
} from '@/features/incidentReconstruction/types'
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from '@hello-pangea/dnd'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { Box, Checkbox, Typography } from '@mui/material'
import SectionHeader from './SectionHeader'
import SignalStrip from './SignalStrip'

interface SignalsPanelProps {
  /** Every band in the report. */
  bands: TimelineBand[]
  /** The bands on the chart, in chart order. */
  chartKeys: string[]
  /** The window, controller clock, for the strips. */
  start: number
  end: number
  onChartKeysChange(keys: string[]): void
}

/** Shared by both lists: the checkbox and handle sit centred on the whole row. */
const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  pl: 2,
  py: 0.75,
  '&:hover': { bgcolor: 'action.hover' },
}

/** The signal's name and note over its strip. */
function SignalSummary({
  band,
  start,
  end,
  faded,
}: {
  band: TimelineBand
  start: number
  end: number
  faded?: boolean
}) {
  const bandNote = band.key === LOCATION_BAND_KEY ? 'No signal' : null
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ flex: 1 }} noWrap>
          {band.label}
        </Typography>
        {bandNote && (
          <Typography variant="caption" color="text.secondary">
            {bandNote}
          </Typography>
        )}
      </Box>
      {band.key !== LOCATION_BAND_KEY && (
        <Box sx={{ mt: 0.75 }}>
          <SignalStrip
            segments={signalSegments(band.changes, start, end)}
            start={start}
            end={end}
            faded={faded}
          />
        </Box>
      )}
    </Box>
  )
}

export default function SignalsPanel({
  bands,
  chartKeys,
  start,
  end,
  onChartKeysChange,
}: SignalsPanelProps) {
  const byKey = new Map(bands.map((band) => [band.key, band]))
  const onChart = chartKeys
    .map((key) => byKey.get(key))
    .filter((band): band is TimelineBand => band !== undefined)
  const offChart = bands.filter((band) => !chartKeys.includes(band.key))

  const handleDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return
    const keys = onChart.map((band) => band.key)
    const [key] = keys.splice(source.index, 1)
    keys.splice(destination.index, 0, key)
    onChartKeysChange(keys)
  }

  return (
    <Box>
      <SectionHeader title="Selected" count={onChart.length} />
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="signals-on-chart">
          {(dropProvided) => (
            <Box ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
              {onChart.map((band, index) => (
                <Draggable key={band.key} draggableId={band.key} index={index}>
                  {(provided, snapshot) => (
                    // The whole row drags; the checkbox, being an input, still toggles.
                    <Box
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      aria-label={`${band.label}, drag to reorder`}
                      sx={{
                        ...rowSx,
                        pr: 1.5,
                        bgcolor: 'background.paper',
                        boxShadow: snapshot.isDragging ? 4 : 0,
                        cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                      }}
                    >
                      <Checkbox
                        checked
                        onChange={() =>
                          onChartKeysChange(
                            chartKeys.filter((key) => key !== band.key)
                          )
                        }
                        inputProps={{
                          'aria-label': `Take ${band.label} off the chart`,
                        }}
                      />
                      <SignalSummary band={band} start={start} end={end} />
                      <DragIndicatorIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary', ml: 0.5 }}
                      />
                    </Box>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>

      <Box sx={{ mt: 2 }}>
        <SectionHeader title="Unselected" count={offChart.length} />
      </Box>
      {offChart.map((band) => (
        <Box
          key={band.key}
          component="label"
          sx={{ ...rowSx, pr: 2.5, cursor: 'pointer' }}
        >
          <Checkbox
            checked={false}
            onChange={() => onChartKeysChange([...chartKeys, band.key])}
            inputProps={{ 'aria-label': `Put ${band.label} on the chart` }}
          />
          <SignalSummary band={band} start={start} end={end} faded />
        </Box>
      ))}
    </Box>
  )
}
