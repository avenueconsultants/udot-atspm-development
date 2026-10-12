import { useGetIncidentReconstructionReportData } from '@/api/reports'
import { ResponsivePageLayout } from '@/components/ResponsivePage'
import { StyledPaper } from '@/components/StyledPaper'
import Header from '@/components/header'
import {
  FULL_ZOOM,
  Zoom,
  fitZoom,
} from '@/features/incidentReconstruction/chartLayout'
import ChartPanel from '@/features/incidentReconstruction/components/ChartPanel'
import EventsPanel from '@/features/incidentReconstruction/components/EventsPanel'
import { IncidentChartHandle } from '@/features/incidentReconstruction/components/IncidentChart'
import InputsCard from '@/features/incidentReconstruction/components/InputsCard'
import SignalsPanel from '@/features/incidentReconstruction/components/SignalsPanel'
import {
  chartBands,
  clockWarningMessages,
  codeCounts,
  defaultChartKeys,
  defaultCodes,
  eventsInWindow,
  filterEvents,
} from '@/features/incidentReconstruction/eventFilters'
import {
  RowContext,
  buildEventRows,
  buildLabeledRows,
} from '@/features/incidentReconstruction/eventRows'
import {
  downloadPng,
  exportFileName,
} from '@/features/incidentReconstruction/exportPng'
import { toIncidentReport } from '@/features/incidentReconstruction/incidentReconstruction.adapter'
import {
  GenerateClear,
  clearsOnGenerate,
  toggleLabeled,
  withFilledLabels,
  withLabelText,
  withName,
  withoutLabeled,
} from '@/features/incidentReconstruction/labelState'
import {
  normalizeAdjustment,
  toAdjusted,
} from '@/features/incidentReconstruction/latencyAdjustment'
import { reportErrorMessage } from '@/features/incidentReconstruction/reportError'
import {
  chartSubtitle,
  chartTitle,
} from '@/features/incidentReconstruction/reportText'
import {
  suggestedLabel,
  suggestedNames,
} from '@/features/incidentReconstruction/signalNames'
import {
  endAfter,
  timeOnDay,
  windowProblem,
} from '@/features/incidentReconstruction/timeWindow'
import { GeneratedView } from '@/features/incidentReconstruction/types'
import { incidentQueryParsers } from '@/features/incidentReconstruction/urlState'
import {
  pickerValueFromControllerTime,
  startOfControllerDay,
  toRequestLiteral,
} from '@/features/incidentReconstruction/wallClock'
import useMissingDays from '@/hooks/useMissingDays'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  Alert,
  Box,
  Divider,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material'
import { endOfMonth, startOfMonth } from 'date-fns'
import { useRouter } from 'next/router'
import { useQueryStates } from 'nuqs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TITLE = 'Incident Reconstruction'
const LEAVE_MESSAGE =
  'Your labels are kept only on this page and in its link. Leave anyway?'
const CLEAR_QUESTIONS: Record<GenerateClear, string | null> = {
  nothing: null,
  labels: 'A new date clears the labels on this page. Continue?',
  everything: 'A new location clears the labels on this page. Continue?',
}
const CLEARED_PARAMS: Record<
  GenerateClear,
  { bands?: null; codes?: null; labels?: null; names?: null }
> = {
  nothing: {},
  labels: { labels: null },
  everything: { bands: null, codes: null, labels: null, names: null },
}

type PanelTab = 'signals' | 'events'

interface GenerateInputs {
  locationIdentifier: string
  start: number
  end: number
}

const sameKeys = (a: string[], b: string[]) =>
  a.length === b.length && a.every((key, index) => key === b[index])

const IncidentReconstruction = () => {
  const router = useRouter()
  const [qs, setQs] = useQueryStates(incidentQueryParsers, {
    history: 'replace',
  })
  const { mutateAsync, isLoading } = useGetIncidentReconstructionReportData()

  // The inputs. They apply when Generate is pressed.
  const [locationIdentifier, setLocationIdentifier] = useState<string | null>(
    null
  )
  const [day, setDay] = useState<number | null>(null)
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)

  const [view, setView] = useState<GeneratedView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState<Zoom>(FULL_ZOOM)
  const [picking, setPicking] = useState(false)
  const [tab, setTab] = useState<PanelTab>('signals')
  const [panelOpen, setPanelOpen] = useState(true)
  const generation = useRef(0)
  const loadedLink = useRef(false)
  const chartRef = useRef<IncidentChartHandle>(null)

  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date())
  )
  const calendarStart = useMemo(
    () => startOfMonth(calendarMonth),
    [calendarMonth]
  )
  const calendarEnd = useMemo(() => endOfMonth(calendarMonth), [calendarMonth])
  const missingDays = useMissingDays(
    locationIdentifier ?? '',
    'IndianaEvent',
    'raw',
    calendarStart,
    calendarEnd
  )

  const generate = useCallback(
    async (inputs: GenerateInputs, clear: GenerateClear) => {
      setError(null)
      await setQs({
        location: inputs.locationIdentifier,
        start: inputs.start,
        end: inputs.end,
        ...CLEARED_PARAMS[clear],
      })

      try {
        const result = await mutateAsync({
          data: {
            locationIdentifier: inputs.locationIdentifier,
            start: toRequestLiteral(inputs.start),
            end: toRequestLiteral(inputs.end),
          },
        })
        generation.current += 1
        setView({
          report: toIncidentReport(result),
          start: inputs.start,
          end: inputs.end,
          generation: generation.current,
        })
        setZoom(FULL_ZOOM)
      } catch (caught) {
        setView(null)
        setError(reportErrorMessage(caught))
      }
    },
    [mutateAsync, setQs]
  )

  // Opening a shared link fills the inputs and draws the same view.
  useEffect(() => {
    if (!router.isReady || loadedLink.current) return
    loadedLink.current = true

    setLocationIdentifier(qs.location)
    setStart(qs.start)
    setEnd(qs.end)
    if (qs.start !== null) {
      setDay(startOfControllerDay(qs.start))
      setCalendarMonth(startOfMonth(pickerValueFromControllerTime(qs.start)))
    }

    if (qs.location && !windowProblem(qs.start, qs.end)) {
      void generate(
        {
          locationIdentifier: qs.location,
          start: qs.start as number,
          end: qs.end as number,
        },
        'nothing'
      )
    }
  }, [router.isReady, qs, generate])

  const hasLabels = Object.keys(qs.labels).length > 0

  // Labels live only in the page and its link, so ask before leaving.
  useEffect(() => {
    if (!hasLabels) return
    let leaving = false

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    // Back and Forward. The page replaces its own history entries, so any
    // other entry, even this page with another link, leaves the labels behind.
    router.beforePopState(({ as }) => {
      if (as === router.asPath) return true
      if (window.confirm(LEAVE_MESSAGE)) {
        leaving = true
        return true
      }
      window.history.pushState(null, '', router.asPath)
      return false
    })
    // Links and menus. Shallow changes are the page updating its own link.
    const onRouteChangeStart = (
      _url: string,
      { shallow }: { shallow: boolean }
    ) => {
      if (shallow || leaving) return
      if (window.confirm(LEAVE_MESSAGE)) {
        leaving = true
        return
      }
      router.events.emit('routeChangeError')
      throw 'Navigation cancelled to keep labels.'
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      router.events.off('routeChangeStart', onRouteChangeStart)
      router.beforePopState(() => true)
    }
  }, [hasLabels, router])

  const report = view?.report ?? null
  const allBands = useMemo(() => report?.bands ?? [], [report])
  const bandsByKey = useMemo(
    () => new Map(allBands.map((band) => [band.key, band])),
    [allBands]
  )
  const defaultKeys = useMemo(() => defaultChartKeys(allBands), [allBands])
  const chartKeys = qs.bands ?? defaultKeys
  const shownBands = useMemo(
    () => chartBands(allBands, chartKeys),
    [allBands, chartKeys]
  )
  const shownBandKeys = useMemo(
    () => new Set(shownBands.map((band) => band.key)),
    [shownBands]
  )
  // The adjustment only moves the times shown. It never changes which events
  // are in the window, so changing it does not fetch the report again.
  const adjustmentSeconds = qs.adjust
  const eventsInSpan = useMemo(
    () =>
      view ? eventsInWindow(view.report.events, view.start, view.end) : [],
    [view]
  )
  const counts = useMemo(
    () => codeCounts(eventsInSpan, shownBandKeys),
    [eventsInSpan, shownBandKeys]
  )
  const selectedCodes = useMemo(
    () =>
      qs.codes ??
      defaultCodes(
        codeCounts(eventsInSpan, new Set(allBands.map((band) => band.key)))
      ),
    [qs.codes, eventsInSpan, allBands]
  )
  const rowContext: RowContext = useMemo(
    () => ({
      bandsByKey,
      names: qs.names,
      adjustmentSeconds,
      labels: qs.labels,
    }),
    [bandsByKey, qs.names, adjustmentSeconds, qs.labels]
  )
  // Labeled events stay labeled whatever the codes; a signal taken off the
  // chart keeps its labels for when it comes back.
  const labeled = useMemo(
    () =>
      buildLabeledRows(
        eventsInSpan.filter((event) => shownBandKeys.has(event.bandKey)),
        rowContext
      ),
    [eventsInSpan, shownBandKeys, rowContext]
  )
  const unlabeled = useMemo(
    () =>
      buildEventRows(
        filterEvents(
          eventsInSpan,
          shownBandKeys,
          new Set(selectedCodes)
        ).filter((event) => !(event.key in qs.labels)),
        rowContext
      ),
    [eventsInSpan, shownBandKeys, selectedCodes, qs.labels, rowContext]
  )
  const candidates = useMemo(
    () => (picking ? unlabeled : []),
    [picking, unlabeled]
  )
  const warnings = useMemo(
    () => clockWarningMessages(eventsInSpan, adjustmentSeconds),
    [eventsInSpan, adjustmentSeconds]
  )
  const shownStart = view ? toAdjusted(view.start, adjustmentSeconds) : 0
  const shownEnd = view ? toAdjusted(view.end, adjustmentSeconds) : 0

  const title = report
    ? chartTitle(report.locationIdentifier, report.locationDescription)
    : ''
  const subtitle = report
    ? chartSubtitle(
        report.locationIdentifier,
        report.locationDescription,
        shownStart,
        shownEnd
      )
    : ''

  const problem =
    start !== null && end !== null ? windowProblem(start, end) : null
  const canGenerate = Boolean(locationIdentifier) && !windowProblem(start, end)

  const handleDateChange = (picked: number) => {
    const nextDay = startOfControllerDay(picked)
    setDay(nextDay)
    if (start !== null) {
      const nextStart = timeOnDay(nextDay, start)
      setStart(nextStart)
      if (end !== null) setEnd(endAfter(nextStart, end))
    }
    setCalendarMonth(startOfMonth(pickerValueFromControllerTime(nextDay)))
  }

  const handleStartChange = (time: number) => {
    const onDay = day ?? startOfControllerDay(time)
    const nextStart = timeOnDay(onDay, time)
    setDay(onDay)
    setStart(nextStart)
    if (end !== null) setEnd(endAfter(nextStart, end))
  }

  const handleEndChange = (time: number) => {
    if (start !== null) {
      setEnd(endAfter(start, time))
      return
    }
    const onDay = day ?? startOfControllerDay(time)
    setDay(onDay)
    setEnd(timeOnDay(onDay, time))
  }

  const handleGenerate = () => {
    if (!locationIdentifier || start === null || end === null) return
    const clear = clearsOnGenerate(
      { location: qs.location, start: qs.start },
      { location: locationIdentifier, start }
    )
    const question = CLEAR_QUESTIONS[clear]
    if (question && hasLabels && !window.confirm(question)) return

    void generate({ locationIdentifier, start, end }, clear)
  }

  const handleToggle = (key: string) => {
    void setQs((current) => ({ labels: toggleLabeled(current.labels, key) }))
  }

  const handlePick = (key: string) => {
    if (picking) handleToggle(key)
  }

  const handleLabelChange = (key: string, text: string) => {
    void setQs((current) => ({
      labels: withLabelText(current.labels, key, text),
    }))
  }

  const handleRemove = (key: string) => {
    void setQs((current) => ({ labels: withoutLabeled(current.labels, key) }))
  }

  const handleFillEmpty = () => {
    const suggestions = new Map(
      labeled.map((row) => [
        row.event.key,
        suggestedLabel(row.event, bandsByKey.get(row.event.bandKey), qs.names),
      ])
    )
    void setQs((current) => ({
      labels: withFilledLabels(current.labels, suggestions),
    }))
  }

  const handleChartKeysChange = (keys: string[]) => {
    void setQs({ bands: sameKeys(keys, defaultKeys) ? null : keys })
  }

  const handleNameChange = (key: string, name: string) => {
    void setQs((current) => ({ names: withName(current.names, key, name) }))
  }

  const handleSuggestNames = () => {
    const suggested = suggestedNames(shownBands)
    void setQs((current) => ({ names: { ...current.names, ...suggested } }))
  }

  const handleFit = () => {
    setZoom(
      fitZoom(
        labeled.map((row) => row.time),
        shownStart,
        shownEnd
      )
    )
  }

  const handleSaveImage = async () => {
    if (!report) return
    try {
      const image = await chartRef.current?.getImage()
      if (image) {
        downloadPng(
          exportFileName(report.locationIdentifier, shownStart),
          image
        )
      }
    } catch {
      setError('The chart picture could not be made.')
    }
  }

  return (
    <ResponsivePageLayout title={TITLE} hideTitle>
      <Box sx={{ mb: 3 }}>
        <Header title={TITLE} />
      </Box>

      <InputsCard
        locationIdentifier={locationIdentifier}
        day={day}
        start={start}
        end={end}
        missingDays={missingDays}
        problem={problem}
        canGenerate={canGenerate}
        loading={isLoading}
        onLocationChange={setLocationIdentifier}
        onDateChange={handleDateChange}
        onStartChange={handleStartChange}
        onEndChange={handleEndChange}
        onMonthChange={setCalendarMonth}
        onGenerate={handleGenerate}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {view && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: panelOpen ? '380px minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
            },
            alignItems: 'start',
            gap: 2,
            mt: 2,
          }}
        >
          {!panelOpen ? (
            <StyledPaper sx={{ p: 0.5 }}>
              <Tooltip title="Show phases and events" placement="right">
                <IconButton
                  aria-label="Show phases and events"
                  onClick={() => setPanelOpen(true)}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Tooltip>
            </StyledPaper>
          ) : (
            <StyledPaper sx={{ overflow: 'hidden', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tabs
                  value={tab}
                  onChange={(_, next: PanelTab) => setTab(next)}
                  variant="fullWidth"
                  sx={{ flex: 1 }}
                >
                  <Tab
                    value="signals"
                    label={`Phases (${shownBands.length})`}
                  />
                  <Tab value="events" label={`Events (${labeled.length})`} />
                </Tabs>
                <Tooltip title="Hide phases and events">
                  <IconButton
                    aria-label="Hide phases and events"
                    onClick={() => setPanelOpen(false)}
                    sx={{ mx: 0.5 }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider />
              {tab === 'signals' ? (
                <SignalsPanel
                  bands={allBands}
                  chartKeys={shownBands.map((band) => band.key)}
                  start={view.start}
                  end={view.end}
                  onChartKeysChange={handleChartKeysChange}
                />
              ) : (
                <EventsPanel
                  labeled={labeled}
                  unlabeled={unlabeled}
                  counts={counts}
                  selectedCodes={selectedCodes}
                  onCodesChange={(codes) => void setQs({ codes })}
                  onResetCodes={() => void setQs({ codes: null })}
                  onToggle={handleToggle}
                />
              )}
            </StyledPaper>
          )}

          <ChartPanel
            title={title}
            subtitle={subtitle}
            bands={shownBands}
            names={qs.names}
            labeled={labeled}
            candidates={candidates}
            start={shownStart}
            end={shownEnd}
            adjustmentSeconds={adjustmentSeconds}
            zoom={zoom}
            picking={picking}
            warnings={warnings}
            generation={view.generation}
            chartRef={chartRef}
            onZoomChange={setZoom}
            onFit={handleFit}
            onFullSpan={() => setZoom(FULL_ZOOM)}
            onAdjustmentChange={(seconds) =>
              void setQs({ adjust: normalizeAdjustment(seconds) })
            }
            onPickingChange={setPicking}
            onPick={handlePick}
            onLabelChange={handleLabelChange}
            onRemove={handleRemove}
            onFillEmpty={handleFillEmpty}
            onSignalNameChange={handleNameChange}
            onRemoveSignal={(key) =>
              handleChartKeysChange(
                shownBands
                  .map((band) => band.key)
                  .filter((item) => item !== key)
              )
            }
            onSuggestNames={handleSuggestNames}
            onSaveImage={() => void handleSaveImage()}
          />
        </Box>
      )}
    </ResponsivePageLayout>
  )
}

export default IncidentReconstruction
