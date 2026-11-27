import { Stack, Tooltip, Typography } from '@mui/material'
import { stateMarks, type LedgerEntry } from '../cards'

/**
 * A card's own history, kept on the card rather than in a page-level audit: what the field holds
 * now, which source put it there, and what it replaced. A later load appends rather than
 * overwriting, so "corrected from phase 2" stays readable where the work is happening.
 */
export default function CardLedger({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return null
  return (
    <Stack spacing={0.25}>
      {entries.map((entry) => (
        <Tooltip key={entry.field} title={entry.sources}>
          <Typography
            variant="caption"
            sx={{ color: stateMarks[entry.state].color }}
          >
            {stateMarks[entry.state].glyph} {entry.field.split('.').pop()}{' '}
            {entry.value}
            {entry.state === 'disagrees' && ` · was ${entry.was}`}
            {entry.state === 'notHeld' && ' · ATSPM holds nothing'}
          </Typography>
        </Tooltip>
      ))}
    </Stack>
  )
}
