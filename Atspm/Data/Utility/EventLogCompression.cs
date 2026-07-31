#region license
// Copyright 2026 Utah Departement of Transportation
// for Data - Utah.Udot.Atspm.Data.Utility/EventLogCompression.cs
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

using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using Utah.Udot.NetStandardToolkit.Extensions;

namespace Utah.Udot.Atspm.Data.Utility
{
    /// <summary>
    /// Reads legacy GZip event-log JSON and the versioned ATSPM compression envelope.
    /// Release 1 continues to write legacy GZip; <see cref="EncodeBrotli"/> is the
    /// approved future write format after all event-log readers support the envelope.
    /// </summary>
    internal static class EventLogCompression
    {
        internal const byte CurrentEnvelopeVersion = 1;
        internal const byte BrotliCodec = 1;
        internal const int EnvelopeHeaderLength = 50;

        private const int MagicLength = 8;
        private const int VersionOffset = MagicLength;
        private const int CodecOffset = VersionOffset + 1;
        private const int LengthOffset = CodecOffset + 1;
        private const int HashOffset = LengthOffset + sizeof(ulong);
        private const int HashLength = 32;

        private static readonly byte[] Magic = Encoding.ASCII.GetBytes("ATSPMCMP");

        /// <summary>
        /// Encodes UTF-8 JSON using the approved version 1 Brotli envelope.
        /// This is deliberately not the active Event Log write path in Release 1.
        /// </summary>
        internal static byte[] EncodeBrotli(string json)
        {
            ArgumentNullException.ThrowIfNull(json);

            var uncompressed = Encoding.UTF8.GetBytes(json);
            byte[] payload;

            using (var output = new MemoryStream())
            {
                using (var compressor = new BrotliStream(output, CompressionLevel.Optimal, true))
                {
                    compressor.Write(uncompressed, 0, uncompressed.Length);
                }

                payload = output.ToArray();
            }

            var result = new byte[EnvelopeHeaderLength + payload.Length];
            Magic.CopyTo(result, 0);
            result[VersionOffset] = CurrentEnvelopeVersion;
            result[CodecOffset] = BrotliCodec;
            BinaryPrimitives.WriteUInt64LittleEndian(result.AsSpan(LengthOffset, sizeof(ulong)), (ulong)uncompressed.Length);
            SHA256.HashData(uncompressed).CopyTo(result, HashOffset);
            payload.CopyTo(result, EnvelopeHeaderLength);

            return result;
        }

        /// <summary>
        /// Decodes either a legacy raw GZip stream or a recognized ATSPM envelope.
        /// Unknown formats are rejected rather than guessed because Brotli has no
        /// reliable format signature of its own.
        /// </summary>
        internal static string Decode(byte[] data)
        {
            ArgumentNullException.ThrowIfNull(data);

            if (IsLegacyGZip(data))
                return data.GZipDecompressToString();

            if (!HasEnvelopeMagic(data))
                throw new InvalidDataException("Event Log data is neither legacy GZip nor an ATSPM compression envelope.");

            if (data.Length < EnvelopeHeaderLength)
                throw new InvalidDataException("The ATSPM Event Log compression envelope is truncated.");

            var version = data[VersionOffset];
            if (version != CurrentEnvelopeVersion)
                throw new InvalidDataException($"Unsupported ATSPM Event Log compression envelope version {version}.");

            var codec = data[CodecOffset];
            if (codec != BrotliCodec)
                throw new InvalidDataException($"Unsupported ATSPM Event Log compression codec {codec}.");

            var expectedLength = BinaryPrimitives.ReadUInt64LittleEndian(data.AsSpan(LengthOffset, sizeof(ulong)));
            if (expectedLength > int.MaxValue)
                throw new InvalidDataException($"The ATSPM Event Log payload length {expectedLength} exceeds the supported size.");

            var uncompressed = DecompressBrotli(data.AsSpan(EnvelopeHeaderLength), (int)expectedLength);
            var expectedHash = data.AsSpan(HashOffset, HashLength);
            var actualHash = SHA256.HashData(uncompressed);

            if (!CryptographicOperations.FixedTimeEquals(expectedHash, actualHash))
                throw new InvalidDataException("The ATSPM Event Log payload failed its SHA-256 integrity check.");

            return Encoding.UTF8.GetString(uncompressed);
        }

        private static bool IsLegacyGZip(ReadOnlySpan<byte> data) =>
            data.Length >= 2 && data[0] == 0x1f && data[1] == 0x8b;

        private static bool HasEnvelopeMagic(ReadOnlySpan<byte> data) =>
            data.Length >= MagicLength && data[..MagicLength].SequenceEqual(Magic);

        private static byte[] DecompressBrotli(ReadOnlySpan<byte> payload, int expectedLength)
        {
            try
            {
                using var input = new MemoryStream(payload.ToArray());
                using var decompressor = new BrotliStream(input, CompressionMode.Decompress);
                using var output = new MemoryStream();
                var buffer = new byte[81920];

                while (true)
                {
                    var read = decompressor.Read(buffer, 0, buffer.Length);
                    if (read == 0)
                        break;

                    if (output.Length + read > expectedLength)
                        throw new InvalidDataException("The ATSPM Event Log payload exceeds its declared uncompressed length.");

                    output.Write(buffer, 0, read);
                }

                if (output.Length != expectedLength)
                    throw new InvalidDataException($"The ATSPM Event Log payload length was {output.Length}, expected {expectedLength}.");

                return output.ToArray();
            }
            catch (InvalidDataException)
            {
                throw;
            }
            catch (InvalidOperationException exception)
            {
                throw new InvalidDataException("The ATSPM Event Log Brotli payload is invalid.", exception);
            }
        }
    }
}
