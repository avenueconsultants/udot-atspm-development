// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - urlState.ts
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
import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from 'nuqs'
import { normalizeAdjustment } from './latencyAdjustment'
import {
  Labels,
  SignalNames,
  parseAdjustmentParam,
  parseLabels,
  parseNames,
  parseTimeParam,
  serializeAdjustmentParam,
  serializeLabels,
  serializeNames,
  serializeTimeParam,
} from './urlCodecs'

// The nuqs parsers for everything the share link carries. The encoding itself
// lives in urlCodecs.ts.

const labelsParser = createParser<Labels>({
  parse: parseLabels,
  serialize: serializeLabels,
  eq: (a, b) => serializeLabels(a) === serializeLabels(b),
})

const namesParser = createParser<SignalNames>({
  parse: parseNames,
  serialize: serializeNames,
  eq: (a, b) => serializeNames(a) === serializeNames(b),
})

const controllerTimeParser = createParser<number>({
  parse: parseTimeParam,
  serialize: serializeTimeParam,
  eq: (a, b) => a === b,
})

const adjustmentParser = createParser<number>({
  parse: parseAdjustmentParam,
  serialize: serializeAdjustmentParam,
  eq: (a, b) => normalizeAdjustment(a) === normalizeAdjustment(b),
})

export const incidentQueryParsers = {
  location: parseAsString,
  start: controllerTimeParser,
  end: controllerTimeParser,
  adjust: adjustmentParser.withDefault(0),
  /** The signals on the chart, in chart order. Missing means every vehicle phase. */
  bands: parseAsArrayOf(parseAsString, ','),
  names: namesParser.withDefault({}),
  /** Missing means the default codes. */
  codes: parseAsArrayOf(parseAsInteger, ','),
  /** The labeled events and their text. */
  labels: labelsParser.withDefault({}),
}
