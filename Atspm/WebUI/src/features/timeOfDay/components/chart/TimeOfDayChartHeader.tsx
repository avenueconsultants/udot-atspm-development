import { Box, Button, ButtonGroup, Tab, Tabs, Typography } from '@mui/material'
import type { TimeOfDayAnalysisModel } from '../../transformers'
import type { TimeOfDayAnalysisMode } from './TimeOfDayLayersPanel'

export type TimeOfDaySidebarTab = 'layers' | 'details'

interface TimeOfDayChartHeaderProps {
  model: TimeOfDayAnalysisModel
  sidebarTab: TimeOfDaySidebarTab
  sidebarWidth: number
  activeMode: TimeOfDayAnalysisMode
  onChangeSidebarTab: (tab: TimeOfDaySidebarTab) => void
  onChangeAnalysisMode: (mode: TimeOfDayAnalysisMode) => void
}

export const timeOfDayToggleGroupSx = {
  '& .MuiButton-root': {
    height: 30,
    minHeight: 30,
    px: 1.25,
    py: 0,
    borderColor: '#CBD5E1',
    color: '#475569',
    fontSize: '0.75rem',
    lineHeight: 1,
    textTransform: 'none',
    '&:hover': {
      borderColor: '#94A3B8',
      backgroundColor: 'rgba(15, 23, 42, 0.05)',
    },
  },
  '& .MuiButton-root.is-active': {
    borderColor: '#334155',
    backgroundColor: '#334155',
    color: '#FFFFFF',
    '&:hover': {
      borderColor: '#334155',
      backgroundColor: '#1F2937',
    },
  },
}

export default function TimeOfDayChartHeader({
  model,
  sidebarTab,
  sidebarWidth,
  activeMode,
  onChangeSidebarTab,
  onChangeAnalysisMode,
}: TimeOfDayChartHeaderProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: `minmax(0, 1fr) auto ${sidebarWidth}px`,
        },
        width: { md: 'calc(100% - 2px)' },
        ml: { md: '1px' },
        alignItems: 'center',
        bgcolor: 'common.white',
      }}
    >
      <Box sx={{ minWidth: 0, px: 1.75, py: 1.25 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            component="h2"
            variant="h5"
            sx={{
              fontSize: '1rem',
              fontWeight: 700,
              lineHeight: 1.2,
              minWidth: 0,
            }}
          >
            {model.header.title}
          </Typography>
          {model.header.dateRange && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {' \u2022 '}
              {model.header.dateRange}
            </Typography>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          alignSelf: 'center',
          justifySelf: { xs: 'start', md: 'end' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 0.75,
          mr: 1.5,
        }}
      >
        <ButtonGroup
          size="small"
          variant="outlined"
          aria-label="Time-of-day analysis modes"
          sx={timeOfDayToggleGroupSx}
        >
          <Button
            className={
              activeMode === 'recommendation' ? 'is-active' : undefined
            }
            onClick={() => onChangeAnalysisMode('recommendation')}
            aria-pressed={activeMode === 'recommendation'}
          >
            Recommended
          </Button>
          <Button
            className={activeMode === 'pressure' ? 'is-active' : undefined}
            onClick={() => onChangeAnalysisMode('pressure')}
            aria-pressed={activeMode === 'pressure'}
          >
            Pressure
          </Button>
        </ButtonGroup>
      </Box>
      <Box
        sx={{
          width: { xs: '100%', md: sidebarWidth },
          minWidth: { md: sidebarWidth },
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'flex-end',
          borderLeft: { xs: 0, md: '1px solid' },
          borderTop: { xs: '1px solid', md: 0 },
          borderLeftColor: { md: 'divider' },
          borderTopColor: { xs: 'divider' },
        }}
      >
        <Tabs
          value={sidebarTab}
          onChange={(_, value: TimeOfDaySidebarTab) =>
            onChangeSidebarTab(value)
          }
          aria-label="Time-of-day chart sidebar"
          sx={{ px: 1.5, minHeight: 40 }}
        >
          <Tab
            value="layers"
            label="Legend"
            sx={{ minHeight: 40, textTransform: 'none' }}
          />
          <Tab
            value="details"
            label="Details"
            sx={{ minHeight: 40, textTransform: 'none' }}
          />
        </Tabs>
      </Box>
    </Box>
  )
}
