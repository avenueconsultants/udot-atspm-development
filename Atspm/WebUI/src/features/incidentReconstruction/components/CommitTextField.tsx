// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - CommitTextField.tsx
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
import { TextField, TextFieldProps } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

const COMMIT_DELAY = 400

type CommitTextFieldProps = Omit<
  TextFieldProps,
  'value' | 'onChange' | 'onBlur'
> & {
  value: string
  maxLength: number
  onCommit(text: string): void
}

/** Keeps typing local and writes the text to the page a moment after the last key. */
export default function CommitTextField({
  value,
  maxLength,
  onCommit,
  inputProps,
  ...props
}: CommitTextFieldProps) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const pending = useRef(false)

  useEffect(() => {
    if (!pending.current) setText(value)
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = (next: string) => {
    clearTimeout(timer.current)
    pending.current = false
    if (next !== value) onCommit(next)
  }

  return (
    <TextField
      {...props}
      value={text}
      inputProps={{ ...inputProps, maxLength }}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        pending.current = true
        clearTimeout(timer.current)
        timer.current = setTimeout(() => commit(next), COMMIT_DELAY)
      }}
      onBlur={() => commit(text)}
    />
  )
}
