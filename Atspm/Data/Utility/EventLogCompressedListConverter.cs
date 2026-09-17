#region license
// Copyright 2026 Utah Departement of Transportation
// for Data - Utah.Udot.Atspm.Data.Utility/EventLogCompressedListConverter.cs
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

using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Newtonsoft.Json;
using Utah.Udot.NetStandardToolkit.Extensions;

#nullable disable

namespace Utah.Udot.Atspm.Data.Utility
{
    /// <summary>
    /// Converts Event Log model lists to compressed JSON. Release 1 writes the
    /// existing raw GZip format and reads both GZip and versioned envelopes.
    /// </summary>
    /// <typeparam name="T">Event Log model base type.</typeparam>
    internal class EventLogCompressedListConverter<T> : ValueConverter<IEnumerable<T>, byte[]>
    {
        /// <summary>
        /// Creates the Release 1 dual-read, legacy-write converter.
        /// </summary>
        public EventLogCompressedListConverter() : base(
            v => JsonConvert.SerializeObject(v, new JsonSerializerSettings()
            {
                TypeNameHandling = TypeNameHandling.Arrays,
                SerializationBinder = new CompressedSerializationBinder<T>()
            }).GZipCompressToByte(),
            v => JsonConvert.DeserializeObject<IEnumerable<T>>(EventLogCompression.Decode(v), new JsonSerializerSettings()
            {
                TypeNameHandling = TypeNameHandling.Arrays,
                SerializationBinder = new CompressedSerializationBinder<T>()
            }))
        { }
    }
}
