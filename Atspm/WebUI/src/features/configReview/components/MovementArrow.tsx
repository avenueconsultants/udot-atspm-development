import { Box, Tooltip } from '@mui/material'

/**
 * A movement arrow is drawn from an ATSPM approach's direction and movement. Neither comes from
 * any controller, radar or lidar on this corridor, so a phase with no approach gets no arrow -
 * which is the finding, drawn. Nothing here maps a phase number to a direction: phase 2 is
 * westbound at seventeen of nineteen locations on R2:192 and northbound at the two where the
 * mainline runs north-south, so such a map would be silently wrong twice per corridor.
 */
export const directionNames: Record<number, string> = {
  0: 'unknown direction',
  1: 'northbound',
  2: 'southbound',
  3: 'eastbound',
  4: 'westbound',
  5: 'northeastbound',
  6: 'northwestbound',
  7: 'southeastbound',
  8: 'southwestbound',
}
export const movementNames: Record<number, string> = {
  0: 'unknown movement',
  1: 'through',
  2: 'right turn',
  3: 'left turn',
  4: 'through and right',
  5: 'through and left',
  6: 'northwest',
  7: 'left, through and right',
  8: 'crosswalk',
}

// Degrees clockwise from an arrow drawn pointing north, so the turn geometry rotates with the
// approach rather than being redrawn per direction.
const rotation: Record<number, number> = {
  1: 0,
  2: 180,
  3: 90,
  4: 270,
  5: 45,
  6: 315,
  7: 135,
  8: 225,
}
const head = 'M12 2 l4.2 5.4 h-8.4 z'
const shapes: Record<number, string[]> = {
  1: [head, 'M10.8 6.6 h2.4 V22 h-2.4 z'],
  // A turn arrow: up the stem, then the head pointing off to the side.
  3: ['M2 9.6 l5.4 4.2 v-8.4 z', 'M6.6 11.1 h6 V22 h2.4 V8.7 h-8.4 z'],
  2: ['M22 9.6 l-5.4 4.2 v-8.4 z', 'M17.4 11.1 h-6 V22 h-2.4 V8.7 h8.4 z'],
}
const combinations: Record<number, number[]> = {
  4: [1, 2],
  5: [1, 3],
  7: [3, 1, 2],
  6: [1],
}

export default function MovementArrow({
  direction,
  movement,
  protectedMovement = true,
  size = 26,
}: {
  direction: number
  movement: number
  protectedMovement?: boolean
  size?: number
}) {
  const parts = combinations[movement] ?? (shapes[movement] ? [movement] : [])
  const label = `${directionNames[direction] ?? 'unknown direction'} ${
    movementNames[movement] ?? 'unknown movement'
  }${protectedMovement ? '' : ', permissive'}`
  if (!parts.length || !rotation[direction])
    return (
      <Tooltip title={`No arrow: ${label}`}>
        <Box
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: '1px dashed',
            borderColor: 'text.disabled',
            color: 'text.disabled',
            fontSize: size * 0.6,
            lineHeight: `${size - 2}px`,
            textAlign: 'center',
          }}
          aria-label={`No arrow: ${label}`}
          role="img"
        >
          ?
        </Box>
      </Tooltip>
    )
  return (
    <Tooltip title={label}>
      <Box
        component="svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-label={label}
        sx={{ display: 'block', flexShrink: 0 }}
      >
        <g transform={`rotate(${rotation[direction]} 12 12)`}>
          {parts.flatMap((part) =>
            shapes[part].map((path, index) => (
              <path
                key={`${part}-${index}`}
                d={path}
                fill={protectedMovement ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={protectedMovement ? 0 : 1.4}
              />
            ))
          )}
        </g>
      </Box>
    </Tooltip>
  )
}
