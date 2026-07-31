#region license
// Copyright 2026 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.Atspm.Infrastructure.Services.EventLogDecoders/BluebandLidarEventDecoder.cs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#endregion

using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Text;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.Infrastructure.Services.EventLogDecoders
{
    /// <summary>
    /// Decodes the JSON envelope returned by the BlueBand SPM+ events API.
    /// </summary>
    public class BluebandLidarEventDecoder : EventLogDecoderBase<BluebandLidarEvent>
    {
        /// <inheritdoc/>
        public override IEnumerable<BluebandLidarEvent> Decode(Device device, Stream stream, CancellationToken cancelToken = default)
        {
            cancelToken.ThrowIfCancellationRequested();

            if (device == null)
                throw new ArgumentNullException(nameof(device), "Device can not be null");

            if (stream == null || stream.Length == 0)
                throw new InvalidDataException("Stream is empty");

            if (device.Location == null || string.IsNullOrWhiteSpace(device.Location.LocationIdentifier))
                throw new InvalidDataException("BlueBand LiDAR device must be assigned to a location");

            try
            {
                stream.Position = 0;

                using var textReader = new StreamReader(stream, Encoding.UTF8, true, leaveOpen: true);
                using var jsonReader = new JsonTextReader(textReader);
                var envelope = JObject.Load(jsonReader);

                if (envelope["events"] is not JArray events)
                    throw new InvalidDataException("BlueBand response does not contain an events array");

                var result = new List<BluebandLidarEvent>(events.Count);

                foreach (var token in events)
                {
                    cancelToken.ThrowIfCancellationRequested();

                    if (token is not JObject source)
                        throw new InvalidDataException("BlueBand events array contains a non-object value");

                    var item = source.ToObject<BluebandLidarEvent>()
                        ?? throw new InvalidDataException("BlueBand event could not be decoded");

                    if (item.SourceTimestampMilliseconds <= 0)
                        throw new InvalidDataException("BlueBand event is missing a valid date value");

                    item.LocationIdentifier = device.Location.LocationIdentifier;
                    item.Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(item.SourceTimestampMilliseconds).UtcDateTime;
                    item.SourcePayloadBytes = Encoding.UTF8.GetByteCount(source.ToString(Formatting.None));
                    result.Add(item);
                }

                return result;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (EventLogDecoderException)
            {
                throw;
            }
            catch (Exception e)
            {
                throw new EventLogDecoderException(e);
            }
        }
    }
}
