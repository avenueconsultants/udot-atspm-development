import {
  useDeleteWatchDogIgnoreEventFromKey,
  usePatchWatchDogIgnoreEventFromKey,
  useGetWatchDogIgnoreEvent,
  WatchDogComponentTypes,
  WatchDogIgnoreEvent,
} from '@/api/config'
import ATSPMDialog from '@/components/ATSPMDialog'
import AdminTable from '@/components/AdminTable/AdminTable'
import DeleteModal from '@/components/AdminTable/DeleteModal'
import { useNotificationStore } from '@/stores/notifications'
import { toUTCDateStamp } from '@/utils/dateTime'
import { Box, Button, TextField } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

function componentLabel(e: WatchDogIgnoreEvent) {
  if (e.componentType == null) return 'Location'
  if (e.componentType === WatchDogComponentTypes.NUMBER_0)
    return `Location (${e.componentId ?? '—'})`
  if (e.componentType === WatchDogComponentTypes.NUMBER_1)
    return `Approach (${e.componentId ?? '—'})`
  return `Detector (${e.componentId ?? '—'})`
}

const issueTypeLabels: Record<number, string> = {
  1: 'Record Count',
  2: 'Low Detector Hits',
  3: 'Stuck Ped',
  4: 'Force Off Threshold',
  5: 'Max Out Threshold',
  6: 'Unconfigured Approach',
  7: 'Unconfigured Detector',
  8: 'Missing Mainline Data',
  9: 'Stuck Queue Detection',
  10: 'Low Ramp Detector Hits',
  11: 'Ramp Missed Detector Hits',
}

function issueTypeLabel(issueType: WatchDogIgnoreEvent['issueType']) {
  if (issueType == null) return ''
  return issueTypeLabels[issueType] ?? String(issueType)
}

type IgnoreEventEditorModalProps = {
  open: boolean
  onSave: (row: WatchDogIgnoreEvent) => void | Promise<void>
  onClose: () => void
  data?: WatchDogIgnoreEvent | null
}

function IgnoreEventEditorModal({
  open,
  onSave,
  onClose,
  data,
}: IgnoreEventEditorModalProps) {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  useEffect(() => {
    if (!open) return

    setStartDate(data?.start ? new Date(data.start) : null)
    setEndDate(data?.end ? new Date(data.end) : null)
  }, [open, data])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data || !startDate) return

    await onSave({
      ...data,
      start: toUTCDateStamp(startDate),
      // The generated WatchDogIgnoreEvent.end type has no null variant, but
      // the PATCH endpoint uses OData Delta<T> semantics where an omitted
      // (undefined) key means "no change" - sending null is what actually
      // clears the end date server-side.
      end: (endDate ? toUTCDateStamp(endDate) : null) as string | undefined,
    })
    onClose()
  }

  return (
    <ATSPMDialog
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Edit Ignored Event"
      auditInfo={data ?? undefined}
      dialogProps={{ sx: { minWidth: 520, pt: 0 } }}
    >
      <TextField
        autoFocus
        margin="dense"
        fullWidth
        label="Location"
        value={data?.locationIdentifier ?? ''}
        disabled
      />
      <TextField
        margin="dense"
        fullWidth
        label="Component"
        value={data ? componentLabel(data) : ''}
        disabled
      />
      <TextField
        margin="dense"
        fullWidth
        label="Issue"
        value={issueTypeLabel(data?.issueType)}
        disabled
      />
      <TextField
        margin="dense"
        fullWidth
        label="Phase"
        value={data?.phase ?? '—'}
        disabled
      />
      <DatePicker
        label="Start Date"
        value={startDate}
        onChange={(newValue) => setStartDate(newValue)}
        slotProps={{
          textField: {
            autoFocus: true,
            margin: 'dense',
            fullWidth: true,
            required: true,
          },
        }}
      />
      <DatePicker
        label="End Date"
        value={endDate}
        onChange={(newValue) => setEndDate(newValue)}
        slotProps={{
          textField: {
            margin: 'dense',
            fullWidth: true,
            helperText: 'Optional',
          },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Button type="button" onClick={() => setEndDate(null)}>
          Clear End Date
        </Button>
      </Box>
    </ATSPMDialog>
  )
}

export default function WatchdogIgnoredEvents() {
  const { addNotification } = useNotificationStore()

  const { data, isLoading, refetch } = useGetWatchDogIgnoreEvent()
  const { mutateAsync: editIgnore } = usePatchWatchDogIgnoreEventFromKey()
  const { mutateAsync: deleteIgnore } = useDeleteWatchDogIgnoreEventFromKey()

  const rows = useMemo(() => {
    const value = data ?? []
    return value.slice().sort((a, b) => {
      const ak = `${a.locationIdentifier}-${a.componentType ?? 'Global'}-${
        a.componentId ?? -1
      }-${a.issueType}-${a.phase ?? -1}`
      const bk = `${b.locationIdentifier}-${b.componentType ?? 'Global'}-${
        b.componentId ?? -1
      }-${b.issueType}-${b.phase ?? -1}`
      return ak.localeCompare(bk)
    })
  }, [data])

  if (isLoading) return <Box height="500px">Loading…</Box>

  const tableData = rows.map((r) => ({
    ...r,
    component: componentLabel(r),
    issueTypeDisplay: issueTypeLabel(r.issueType),
    phaseDisplay: r.phase ?? '—',
    endDisplay: r.end ?? '—',
  }))

  const cells = [
    { key: 'locationIdentifier', label: 'Location' },
    { key: 'component', label: 'Component' },
    { key: 'issueTypeDisplay', label: 'Issue' },
    { key: 'key', label: 'Key' },
    { key: 'phaseDisplay', label: 'Phase' },
    { key: 'start', label: 'Start' },
    { key: 'endDisplay', label: 'End' },
  ]

  const handleEditRow = async (updated: WatchDogIgnoreEvent) => {
    try {
      await editIgnore({
        key: updated.id ?? 0,
        data: {
          locationId: updated.locationId,
          locationIdentifier: updated.locationIdentifier,
          issueType: updated.issueType,
          start: updated.start,
          end: updated.end,
          componentType: updated.componentType,
          componentId: updated.componentId,
          phase: updated.phase,
        },
      })

      addNotification({ title: 'Ignore Event Updated', type: 'success' })
      await refetch()
    } catch {
      addNotification({ title: 'Error Updating Ignore Event', type: 'error' })
    }
  }

  const handleDeleteById = async (id: string | number) => {
    try {
      await deleteIgnore({ key: Number(id) })
      addNotification({ title: 'Ignore Event Removed', type: 'success' })
      await refetch()
    } catch {
      addNotification({ title: 'Error Removing Ignore Event', type: 'error' })
    }
  }

  const filterAssociatedObjects = () => []

  return (
    <AdminTable
      cells={cells}
      pageName="Ignored Event"
      data={tableData}
      marginTop={0}
      hasEditPrivileges={true}
      hasDeletePrivileges={true}
      editModal={
        <IgnoreEventEditorModal
          open={true}
          onSave={handleEditRow}
          onClose={() => {}}
        />
      }
      deleteModal={
        <DeleteModal
          id={0}
          name={''}
          objectType="Ignored Event"
          open={false}
          onClose={() => {}}
          onConfirm={handleDeleteById}
          associatedObjects={[]}
          associatedObjectsLabel=""
          filterFunction={filterAssociatedObjects}
        />
      }
    />
  )
}
