// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - ChartPanel.tsx
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
import { StyledPaper } from '@/components/StyledPaper'
import {
  Zoom,
  zoomedWindow,
} from '@/features/incidentReconstruction/chartLayout'
import { EventRow } from '@/features/incidentReconstruction/eventRows'
import { showingText } from '@/features/incidentReconstruction/reportText'
import { TimelineBand } from '@/features/incidentReconstruction/types'
import { SignalNames } from '@/features/incidentReconstruction/urlCodecs'
import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { ReactNode, Ref, useState } from 'react'
import AdjustmentField from './AdjustmentField'
import ClockWarning from './ClockWarning'
import IncidentChart, { IncidentChartHandle } from './IncidentChart'
import LabeledEventsTable from './LabeledEventsTable'
import SignalNamesTable from './SignalNamesTable'

interface ChartPanelProps {
  title: string
  subtitle: string
  /** The signals on the chart, in order. */
  bands: TimelineBand[]
  names: SignalNames
  labeled: EventRow[]
  candidates: EventRow[]
  /** The window as the page shows it, in adjusted time. */
  start: number
  end: number
  adjustmentSeconds: number
  zoom: Zoom
  picking: boolean
  warnings: string[]
  /** Changes on every Generate, which puts dragged callouts back. */
  generation: number
  chartRef: Ref<IncidentChartHandle>
  onZoomChange(zoom: Zoom): void
  onFit(): void
  onFullSpan(): void
  onAdjustmentChange(seconds: number): void
  onPickingChange(picking: boolean): void
  onPick(key: string): void
  onLabelChange(key: string, label: string): void
  onRemove(key: string): void
  onFillEmpty(): void
  onSignalNameChange(key: string, name: string): void
  onRemoveSignal(key: string): void
  onSuggestNames(): void
  onSaveImage(): void
  showingIntersection: boolean
  onShowingIntersectionChange(showing: boolean): void
  /** The intersection drawing, shown above the chart. */
  intersection: ReactNode
  /** The intersection drawing's time, adjusted, or null when it's hidden. */
  cursor: number | null
  onCursorChange(time: number): void
}

/** In the side panel's order. */
type TableTab = 'signals' | 'events'

export default function ChartPanel({
  title,
  subtitle,
  bands,
  names,
  labeled,
  candidates,
  start,
  end,
  adjustmentSeconds,
  zoom,
  picking,
  warnings,
  generation,
  chartRef,
  onZoomChange,
  onFit,
  onFullSpan,
  onAdjustmentChange,
  onPickingChange,
  onPick,
  onLabelChange,
  onRemove,
  onFillEmpty,
  onSignalNameChange,
  onRemoveSignal,
  onSuggestNames,
  onSaveImage,
  showingIntersection,
  onShowingIntersectionChange,
  intersection,
  cursor,
  onCursorChange,
}: ChartPanelProps) {
  const visible = zoomedWindow(start, end, zoom)
  const fullSpan = zoom.from <= 0 && zoom.to >= 100
  const [tableTab, setTableTab] = useState<TableTab>('signals')
  const hasEmptyLabel = labeled.some((row) => row.label.trim() === '')

  return (
    // The controls, the intersection, the chart and the tables each get a card.
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <StyledPaper sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            disabled={labeled.length === 0}
            onClick={onFit}
          >
            Fit to labeled events
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={fullSpan}
            onClick={onFullSpan}
          >
            Full span
          </Button>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {showingText(visible.start, visible.end)}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 3,
            mt: 2,
          }}
        >
          <AdjustmentField
            adjustmentSeconds={adjustmentSeconds}
            onChange={onAdjustmentChange}
          />
          <FormControlLabel
            control={
              <Switch
                checked={picking}
                onChange={(event) => onPickingChange(event.target.checked)}
              />
            }
            label="Pick on chart"
          />
          <FormControlLabel
            control={
              <Switch
                checked={showingIntersection}
                onChange={(event) =>
                  onShowingIntersectionChange(event.target.checked)
                }
              />
            }
            label="Intersection"
          />
        </Box>
      </StyledPaper>

      {showingIntersection && (
        <StyledPaper sx={{ p: 3 }}>{intersection}</StyledPaper>
      )}

      <StyledPaper sx={{ p: 3 }}>
        <ClockWarning messages={warnings} />

        {picking && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ mb: 1.5 }}
          >
            Click an event mark on a phase to label it, or a numbered event to
            take it off.
          </Typography>
        )}
        {bands.length === 0 ? (
          <Typography
            color="text.secondary"
            sx={{ py: 6, textAlign: 'center' }}
          >
            Check a phase in Phases to draw it.
          </Typography>
        ) : (
          <IncidentChart
            key={generation}
            ref={chartRef}
            title={title}
            subtitle={subtitle}
            bands={bands}
            names={names}
            labeled={labeled}
            candidates={candidates}
            start={start}
            end={end}
            adjustmentSeconds={adjustmentSeconds}
            zoom={zoom}
            onZoomChange={onZoomChange}
            onPick={onPick}
            onSaveImage={onSaveImage}
            cursor={cursor}
            onCursorChange={onCursorChange}
          />
        )}
      </StyledPaper>

      <StyledPaper sx={{ px: 3, pt: 1, pb: 2 }}>
        {/* The tab's action sits at the right end of the tab row. */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={tableTab}
            onChange={(_, next: TableTab) => setTableTab(next)}
          >
            <Tab value="signals" label={`Phases (${bands.length})`} />
            <Tab value="events" label={`Events (${labeled.length})`} />
          </Tabs>
          {tableTab === 'events' ? (
            <Button
              size="small"
              disabled={!hasEmptyLabel}
              onClick={onFillEmpty}
            >
              Fill empty labels
            </Button>
          ) : (
            <Button
              size="small"
              disabled={bands.length === 0}
              onClick={onSuggestNames}
            >
              Use suggested names
            </Button>
          )}
        </Box>
        {tableTab === 'events' ? (
          <LabeledEventsTable
            rows={labeled}
            adjusted={adjustmentSeconds !== 0}
            onLabelChange={onLabelChange}
            onRemove={onRemove}
          />
        ) : (
          <SignalNamesTable
            bands={bands}
            names={names}
            onNameChange={onSignalNameChange}
            onRemove={onRemoveSignal}
          />
        )}
      </StyledPaper>
    </Box>
  )
}
