// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - ClockWarning.tsx
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
import { Alert } from '@mui/material'

/** Shown when the window has flash, stop time, clock or power events, even if they are filtered out. */
export default function ClockWarning({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null

  return (
    <Alert severity="warning" sx={{ mb: 1.5 }}>
      {messages.map((message) => (
        <div key={message}>{message}</div>
      ))}
    </Alert>
  )
}
