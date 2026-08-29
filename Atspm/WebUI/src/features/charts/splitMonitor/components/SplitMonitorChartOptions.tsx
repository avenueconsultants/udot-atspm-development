import { YAxisDefaultInput } from '@/features/charts/components/selectChart/YAxisDefaultInput'
import { SplitMonitorChartOptionsDefaults } from '@/features/charts/splitMonitor/types'
import { Default } from '@/features/charts/types'
import { useChartsStore } from '@/stores/charts'
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

// The report API's SplitMonitorOptions.percentileSplit is an int, so "None"
// cannot travel as the word: it goes out as '0', which the service and the
// transformer both treat as "no percentile". The select shows 'None' for a
// stored '0' so a saved measure default round-trips.
const NONE_LABEL = 'None'
const NONE_VALUE = '0'
const PERCENTILE_SPLIT_CHOICES = [NONE_LABEL, '50', '75', '85', '90', '95']

const toPercentileLabel = (value: string | undefined) =>
  value === NONE_VALUE ? NONE_LABEL : value
const toPercentileValue = (label: string) =>
  label === NONE_LABEL ? NONE_VALUE : label

interface SplitMonitorChartOptionsProps {
  chartDefaults: SplitMonitorChartOptionsDefaults
  handleChartOptionsUpdate: (update: Default) => void
  isMeasureDefaultView?: boolean
}

export const SplitMonitorChartOptions = ({
  chartDefaults,
  handleChartOptionsUpdate,
  isMeasureDefaultView = false,
}: SplitMonitorChartOptionsProps) => {
  const [selectedPercentile, setSelectedPercentile] = useState(
    toPercentileLabel(chartDefaults?.percentileSplit?.value)
  )
  const { setYAxisMaxStore } = useChartsStore()

  const [yAxisMax, setYAxisMax] = useState<string | null>(
    chartDefaults.yAxisDefault?.value
  )

  useEffect(() => {
    setYAxisMaxStore(chartDefaults.yAxisDefault?.value)
  }, [chartDefaults.yAxisDefault?.value, setYAxisMaxStore])

  const handleSelectedPercentileChange = (event: SelectChangeEvent<string>) => {
    const newPercentile = event.target.value
    setSelectedPercentile(newPercentile)

    handleChartOptionsUpdate({
      value: toPercentileValue(newPercentile),
      option: chartDefaults.percentileSplit.option,
      id: chartDefaults.percentileSplit.id,
    })
  }

  const updateYAxisDefault = (newYAxis: string) => {
    setYAxisMax(newYAxis)

    if (isMeasureDefaultView) {
      handleChartOptionsUpdate({
        value: newYAxis,
        option: chartDefaults.yAxisDefault.option,
        id: chartDefaults.yAxisDefault.id,
      })
    } else {
      setYAxisMaxStore(newYAxis)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        flexDirection: 'column',
        gap: 1,
        flex: '1 1 0%',
      }}
    >
      <Box display="flex" justifyContent={'space-between'}>
        <InputLabel
          sx={{ color: 'black' }}
          htmlFor="percentile-split-input"
          id="percentile-split-input-label"
        >
          Percentile Split
        </InputLabel>
        <Box
          sx={{ display: 'flex', alignItems: 'center', marginRight: '12px' }}
        >
          <FormControl variant="outlined">
            <Select
              labelId="percentile-split-input-label"
              id="percentile-split-input"
              value={selectedPercentile}
              onChange={handleSelectedPercentileChange}
              variant="standard"
              size="small"
              sx={{ width: '60px' }}
              inputProps={{ id: 'percentile-split-input' }}
            >
              {PERCENTILE_SPLIT_CHOICES.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ ml: '0.5rem' }}>
            %
          </Typography>
        </Box>
      </Box>

      <YAxisDefaultInput
        value={yAxisMax}
        handleChange={updateYAxisDefault}
        isMeasureDefaultView={isMeasureDefaultView}
      />
    </Box>
  )
}
