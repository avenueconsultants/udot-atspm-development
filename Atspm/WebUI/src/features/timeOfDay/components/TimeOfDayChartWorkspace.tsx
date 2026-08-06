import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { TimeOfDayAnalysisModel } from '../transformers'
import type { TimeOfDaySidebarTab } from './chart/TimeOfDayChartHeader'
import TimeOfDayChartHeader from './chart/TimeOfDayChartHeader'
import TimeOfDayEChart from './chart/TimeOfDayEChart'
import type {
  TimeOfDayAnalysisMode,
  TimeOfDayScheduleView,
} from './chart/TimeOfDayLayersPanel'
import TimeOfDayLayersPanel, {
  getAnalysisModeSeriesSelection,
  getLayerAnalysisMode,
  getScheduleViewForLayer,
  getSidebarLayers,
  isScheduleLayerSelected,
} from './chart/TimeOfDayLayersPanel'

const sidebarWidths: Record<TimeOfDaySidebarTab, number> = {
  layers: 360,
  details: 700,
}

const sidebarTransition = (theme: {
  transitions: {
    create: (
      properties: string | string[],
      options: { duration: number; easing: string }
    ) => string
    duration: { standard: number }
    easing: { easeInOut: string }
  }
}) =>
  theme.transitions.create('width', {
    duration: theme.transitions.duration.standard,
    easing: theme.transitions.easing.easeInOut,
  })

const SidebarDetails = memo(
  function SidebarDetails({
    active,
    children,
  }: {
    active: boolean
    children: ReactNode
  }) {
    return (
      <Box
        sx={{
          display: active ? 'block' : 'none',
          width: { xs: '100%', md: sidebarWidths.details },
        }}
      >
        {children}
      </Box>
    )
  },
  (previous, next) => !previous.active && !next.active
)

interface TimeOfDayChartWorkspaceProps {
  model: TimeOfDayAnalysisModel
  renderDetails: (props: {
    activeMode: TimeOfDayAnalysisMode
    selectedSeries: Record<string, boolean>
    selectedDetailKey?: string
    onSelectDetail: (detailKey: string) => void
    onSetSeriesVisibility: (seriesNames: string[], visible: boolean) => void
  }) => ReactNode
}

export default function TimeOfDayChartWorkspace({
  model,
  renderDetails,
}: TimeOfDayChartWorkspaceProps) {
  const [activeMode, setActiveMode] =
    useState<TimeOfDayAnalysisMode>('recommendation')
  const [sidebarTab, setSidebarTab] = useState<TimeOfDaySidebarTab>('layers')
  const [hasOpenedDetails, setHasOpenedDetails] = useState(false)
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>(
    () => model.defaultSelectedSeries
  )
  const [selectedDetailKey, setSelectedDetailKey] = useState<string>()

  useEffect(() => {
    setActiveMode('recommendation')
    setSidebarTab('layers')
    setHasOpenedDetails(false)
    setSelectedSeries(model.defaultSelectedSeries)
    setSelectedDetailKey(undefined)
  }, [model])

  const setSeriesVisibility = useCallback(
    (seriesNames: string[], visible: boolean) => {
      setSelectedSeries((current) => {
        const next = { ...current }
        seriesNames.forEach((seriesName) => {
          next[seriesName] = visible
        })
        return next
      })
    },
    []
  )

  const toggleScheduleView = useCallback(
    (view: TimeOfDayScheduleView) => {
      const selectedLayer = model.layers.find(
        (layer) => getScheduleViewForLayer(layer) === view
      )
      if (!selectedLayer?.available) return

      setSelectedSeries((current) => {
        const next = { ...current }
        const scheduleLayers = model.layers.filter(
          (layer) => getScheduleViewForLayer(layer) && layer.available
        )
        const selected = isScheduleLayerSelected(selectedLayer, current)
        selectedLayer.seriesNames.forEach((seriesName) => {
          next[seriesName] = !selected
        })

        const proposedLayer = scheduleLayers.find(
          (layer) => getScheduleViewForLayer(layer) === 'proposed'
        )
        const existingLayer = scheduleLayers.find(
          (layer) => getScheduleViewForLayer(layer) === 'existing'
        )
        const showDifferences =
          isScheduleLayerSelected(proposedLayer, next) &&
          isScheduleLayerSelected(existingLayer, next)
        const differenceLayer = model.layers.find(
          (layer) => layer.id === 'difference-windows'
        )
        differenceLayer?.seriesNames.forEach((seriesName) => {
          next[seriesName] = differenceLayer.available && showDifferences
        })

        return next
      })
    },
    [model.layers]
  )

  const changeAnalysisMode = useCallback(
    (mode: TimeOfDayAnalysisMode) => {
      if (mode === activeMode) return

      setActiveMode(mode)
      setSelectedSeries((currentSelection) =>
        getAnalysisModeSeriesSelection(model.layers, [mode], currentSelection)
      )
    },
    [activeMode, model.layers]
  )

  const selectDetail = useCallback(
    (detailKey: string) => {
      const target = model.detailTargets[detailKey]
      if (target) {
        const targetLayer = model.layers.find(
          (layer) => layer.id === target.layerId
        )
        const targetMode = targetLayer
          ? getLayerAnalysisMode(targetLayer)
          : undefined
        if (targetMode) changeAnalysisMode(targetMode)
        setSeriesVisibility([target.seriesName], true)
      }
      setSelectedDetailKey(detailKey)
      setHasOpenedDetails(true)
      setSidebarTab('details')
    },
    [changeAnalysisMode, model.detailTargets, model.layers, setSeriesVisibility]
  )

  const changeSidebarTab = useCallback((tab: TimeOfDaySidebarTab) => {
    if (tab === 'details') setHasOpenedDetails(true)
    setSidebarTab(tab)
  }, [])

  const showPercentAxis = model.percentSeriesNames.some(
    (seriesName) => selectedSeries[seriesName]
  )
  const sidebarLayers = useMemo(
    () => getSidebarLayers(model.layers, [activeMode]),
    [activeMode, model.layers]
  )
  const sidebarWidth = sidebarWidths[sidebarTab]
  const selectedDetail = selectedDetailKey
    ? model.detailTargets[selectedDetailKey]
    : undefined
  const details = useMemo(
    () =>
      renderDetails({
        activeMode,
        selectedSeries,
        selectedDetailKey,
        onSelectDetail: selectDetail,
        onSetSeriesVisibility: setSeriesVisibility,
      }),
    [
      activeMode,
      renderDetails,
      selectDetail,
      selectedDetailKey,
      selectedSeries,
      setSeriesVisibility,
    ]
  )

  return (
    <Box sx={{ width: '100%' }}>
      <TimeOfDayChartHeader
        model={model}
        sidebarTab={sidebarTab}
        sidebarWidth={sidebarWidth}
        activeMode={activeMode}
        onChangeSidebarTab={changeSidebarTab}
        onChangeAnalysisMode={changeAnalysisMode}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: { xs: 0, md: 840 },
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          <Box sx={{ height: 840, minWidth: 600 }}>
            <TimeOfDayEChart
              option={model.option}
              selectedSeries={selectedSeries}
              showPercentAxis={showPercentAxis}
              selectedDetail={selectedDetail}
              onSelectDetail={selectDetail}
              onToggleScheduleView={toggleScheduleView}
            />
          </Box>
        </Box>
        <Box
          component="aside"
          aria-label="Time-of-day chart controls"
          sx={{
            width: { xs: '100%', md: sidebarWidth },
            flexShrink: 0,
            height: { xs: 'auto', md: 840 },
            borderLeft: { xs: 0, md: '1px solid' },
            borderTop: { xs: '1px solid', md: 0 },
            borderLeftColor: { md: 'divider' },
            borderTopColor: { xs: 'divider' },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'common.white',
            overflow: 'hidden',
            transition: sidebarTransition,
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <Box
              sx={{
                display: sidebarTab === 'layers' ? 'block' : 'none',
                width: { xs: '100%', md: sidebarWidths.layers },
                boxSizing: 'border-box',
                p: 1.25,
              }}
            >
              <TimeOfDayLayersPanel
                layers={sidebarLayers}
                selectedSeries={selectedSeries}
                onToggleScheduleView={toggleScheduleView}
                onSetSeriesVisibility={setSeriesVisibility}
              />
            </Box>
            {hasOpenedDetails && (
              <SidebarDetails active={sidebarTab === 'details'}>
                {details}
              </SidebarDetails>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
