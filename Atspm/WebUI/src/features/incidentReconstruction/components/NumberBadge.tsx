// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - NumberBadge.tsx
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
import { BADGE_COLOR } from '@/features/incidentReconstruction/chartOption'
import { Box } from '@mui/material'

/** The labeled event's number, as the chart draws it. */
export default function NumberBadge({ number }: { number: number }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 20,
        px: 0.5,
        borderRadius: 0.5,
        bgcolor: BADGE_COLOR,
        color: '#fff',
        fontSize: '0.75rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {number}
    </Box>
  )
}
