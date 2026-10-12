// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - SectionHeader.tsx
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
import { Box, Typography } from '@mui/material'

/** "SELECTED · 2" */
export default function SectionHeader({
  title,
  count,
}: {
  title: string
  count: number
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 40,
        px: 3,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 1, lineHeight: 1.5 }}
      >
        {title} · {count}
      </Typography>
    </Box>
  )
}
