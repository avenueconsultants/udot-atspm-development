#region license
// Copyright 2026 Utah Departement of Transportation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
#endregion

using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Utah.Udot.Atspm.Data.Enums;

namespace Utah.Udot.Atspm.Infrastructure.Services.DownloaderClients
{
    /// <summary>
    /// Downloads paginated object events from an Ouster BlueCity Edge Analytics API.
    /// </summary>
    public class OusterBlueCityEdgeDownloaderClient : DownloaderClientBase
    {
        private const string DefaultEventsPath = "analytics/api/v1/object_events";
        private readonly HttpClient _injectedClient;
        private readonly Func<DateTime> _now;
        private HttpClient _client;
        private Uri _baseAddress;
        private Uri _tokenAddress;
        private NetworkCredential _credentials;
        private Dictionary<string, string> _properties;
        private string _accessToken;
        private DateTimeOffset _tokenExpiresAt;

        /// <summary>
        /// Creates a client that owns its HTTP transport.
        /// </summary>
        public OusterBlueCityEdgeDownloaderClient() : this(null, null) { }

        /// <summary>
        /// Creates a client with an HTTP transport supplied by the caller, primarily for component tests.
        /// </summary>
        public OusterBlueCityEdgeDownloaderClient(HttpClient client, Func<DateTime> now = null)
        {
            _injectedClient = client;
            _now = now ?? (() => DateTime.Now);
        }

        /// <inheritdoc/>
        public override TransportProtocols Protocol => TransportProtocols.OusterBlueCityEdge;

        /// <inheritdoc/>
        public override bool IsConnected => _client != null && _baseAddress != null && !string.IsNullOrWhiteSpace(_accessToken);

        /// <inheritdoc/>
        protected override async Task Connect(
            IPEndPoint connection,
            NetworkCredential credentials,
            int connectionTimeout = 2000,
            int operationTimeout = 2000,
            Dictionary<string, string> connectionProperties = null,
            CancellationToken token = default)
        {
            _credentials = credentials;
            _properties = connectionProperties == null
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(connectionProperties, StringComparer.OrdinalIgnoreCase);

            _baseAddress = GetConfiguredUri("BaseUrl")
                ?? new UriBuilder(Uri.UriSchemeHttps, connection.Address.ToString(), connection.Port).Uri;
            _tokenAddress = GetConfiguredUri("TokenUrl")
                ?? new Uri(new UriBuilder(_baseAddress.Scheme, _baseAddress.Host, _baseAddress.Port).Uri,
                    $"auth/realms/{GetString("Realm", "detect")}/protocol/openid-connect/token");

            ValidateEndpoint(_baseAddress, connection.Address);
            ValidateEndpoint(_tokenAddress, connection.Address);

            _client = _injectedClient ?? CreateHttpClient(connectionTimeout);
            _client.BaseAddress = _baseAddress;
            _client.Timeout = TimeSpan.FromMilliseconds(operationTimeout);

            await RefreshToken(token).ConfigureAwait(false);
        }

        private HttpClient CreateHttpClient(int connectionTimeout)
        {
            var handler = new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                ConnectTimeout = TimeSpan.FromMilliseconds(connectionTimeout)
            };

            var pinnedThumbprint = GetString("PinnedCertThumbprint", null)?.Replace(" ", string.Empty, StringComparison.Ordinal);
            var allowUntrusted = GetBool("AllowUntrustedCertificate", false);
            if (!string.IsNullOrWhiteSpace(pinnedThumbprint) || allowUntrusted)
            {
                handler.SslOptions.RemoteCertificateValidationCallback = (_, certificate, chain, errors) =>
                    ValidateCertificate(certificate, chain, errors, pinnedThumbprint, allowUntrusted);
            }

            return new HttpClient(handler, disposeHandler: true);
        }

        private static bool ValidateCertificate(
            X509Certificate certificate,
            X509Chain chain,
            SslPolicyErrors errors,
            string pinnedThumbprint,
            bool allowUntrusted)
        {
            if (!string.IsNullOrWhiteSpace(pinnedThumbprint))
            {
                if (certificate == null)
                    return false;

                using var certificate2 = new X509Certificate2(certificate);
                return string.Equals(
                    certificate2.Thumbprint?.Replace(" ", string.Empty, StringComparison.Ordinal),
                    pinnedThumbprint,
                    StringComparison.OrdinalIgnoreCase);
            }

            return allowUntrusted || errors == SslPolicyErrors.None;
        }

        private static void ValidateEndpoint(Uri endpoint, IPAddress expectedAddress)
        {
            if (endpoint == null || !endpoint.IsAbsoluteUri || endpoint.Scheme != Uri.UriSchemeHttps)
                throw new UriFormatException("BlueCity endpoints must be absolute HTTPS URLs.");

            if (!IPAddress.TryParse(endpoint.Host, out var endpointAddress) || !endpointAddress.Equals(expectedAddress))
                throw new InvalidOperationException("BlueCity endpoint host must match the configured device IP address.");
        }

        private async Task RefreshToken(CancellationToken token)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _tokenAddress)
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = _credentials.UserName ?? string.Empty,
                    ["client_secret"] = _credentials.Password ?? string.Empty
                })
            };
            using var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: token).ConfigureAwait(false);
            if (!document.RootElement.TryGetProperty("access_token", out var accessToken) || string.IsNullOrWhiteSpace(accessToken.GetString()))
                throw new HttpRequestException("The token response did not contain an access token.");

            _accessToken = accessToken.GetString();
            var expiresIn = document.RootElement.TryGetProperty("expires_in", out var expiry) && expiry.TryGetInt32(out var seconds)
                ? seconds
                : 300;
            _tokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(1, expiresIn));
        }

        private async Task<HttpResponseMessage> SendAuthorizedGet(Uri uri, CancellationToken token)
        {
            if (_tokenExpiresAt <= DateTimeOffset.UtcNow.AddSeconds(60))
                await RefreshToken(token).ConfigureAwait(false);

            var response = await SendGet(uri, token).ConfigureAwait(false);
            if (response.StatusCode != HttpStatusCode.Unauthorized)
                return response;

            response.Dispose();
            await RefreshToken(token).ConfigureAwait(false);
            return await SendGet(uri, token).ConfigureAwait(false);
        }

        private async Task<HttpResponseMessage> SendGet(Uri uri, CancellationToken token)
        {
            EnsureSameHost(uri);
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            return await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
        }

        /// <inheritdoc/>
        protected override Task DeleteResource(Uri resource, CancellationToken token = default) => Task.CompletedTask;

        /// <inheritdoc/>
        protected override Task Disconnect(CancellationToken token = default)
        {
            _client?.CancelPendingRequests();
            _client?.Dispose();
            _client = null;
            _accessToken = null;
            _baseAddress = null;
            return Task.CompletedTask;
        }

        /// <inheritdoc/>
        protected override async Task<FileInfo> DownloadResource(FileInfo file, Uri remote, CancellationToken token = default)
        {
            var events = new List<JsonElement>();
            string timezone = null;
            string units = null;
            var current = remote;
            var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            while (current != null)
            {
                if (!visited.Add(current.AbsoluteUri))
                    throw new InvalidDataException("BlueCity pagination returned a repeated page.");

                using var response = await SendAuthorizedGet(current, token).ConfigureAwait(false);
                response.EnsureSuccessStatusCode();
                await using var stream = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
                using var document = await JsonDocument.ParseAsync(stream, cancellationToken: token).ConfigureAwait(false);
                var root = document.RootElement;

                timezone ??= GetOptionalString(root, "timezone");
                units ??= GetOptionalString(root, "units");
                if (!root.TryGetProperty("events", out var pageEvents) || pageEvents.ValueKind != JsonValueKind.Array)
                    throw new InvalidDataException("BlueCity response did not contain an events array.");

                events.AddRange(pageEvents.EnumerateArray().Select(item => item.Clone()));
                current = GetNextPage(root, current);
            }

            await using var output = File.Create(file.FullName);
            await using var writer = new Utf8JsonWriter(output);
            writer.WriteStartObject();
            if (timezone != null) writer.WriteString("timezone", timezone);
            if (units != null) writer.WriteString("units", units);
            writer.WritePropertyName("events");
            writer.WriteStartArray();
            foreach (var item in events) item.WriteTo(writer);
            writer.WriteEndArray();
            writer.WriteEndObject();
            await writer.FlushAsync(token).ConfigureAwait(false);
            return file;
        }

        private Uri GetNextPage(JsonElement root, Uri current)
        {
            if (!root.TryGetProperty("pagination", out var pagination)
                || !pagination.TryGetProperty("next_page", out var nextPage)
                || nextPage.ValueKind == JsonValueKind.Null)
                return null;

            if (!nextPage.TryGetInt32(out var page) || page < 1)
                throw new InvalidDataException("BlueCity pagination returned an invalid next page.");

            var parameters = ParseQuery(current.Query);
            parameters["page"] = page.ToString(CultureInfo.InvariantCulture);
            return BuildUri(current.GetLeftPart(UriPartial.Path), parameters);
        }

        /// <inheritdoc/>
        protected override Task<IEnumerable<Uri>> ListResources(string path, CancellationToken token = default, params string[] query)
        {
            token.ThrowIfCancellationRequested();
            var now = _now();
            var end = now.AddMinutes(-GetInt("EndLagMinutes", 2));
            var start = now.AddMinutes(-GetInt("LoggingOffset", 20) - GetInt("OverlapMinutes", 5));
            var maxWindow = GetInt("MaxWindowMinutes", 60);
            if (maxWindow < 1 || start >= end)
                throw new InvalidOperationException("BlueCity download window configuration is invalid.");

            var endpoint = new Uri(_baseAddress, string.IsNullOrWhiteSpace(path) ? DefaultEventsPath : path.TrimStart('/'));
            EnsureSameHost(endpoint);
            var result = new List<Uri>();
            for (var chunkStart = start; chunkStart < end; chunkStart = chunkStart.AddMinutes(maxWindow))
            {
                var chunkEnd = chunkStart.AddMinutes(maxWindow);
                if (chunkEnd > end) chunkEnd = end;
                result.Add(BuildUri(endpoint.GetLeftPart(UriPartial.Path), new Dictionary<string, string>
                {
                    ["start_time"] = chunkStart.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
                    ["end_time"] = chunkEnd.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
                    ["timezone"] = GetString("Timezone", "US/Mountain"),
                    ["imperial_measuring_unit"] = GetBool("Imperial", true).ToString().ToLowerInvariant(),
                    ["deduplicate_objects"] = GetBool("DeduplicateObjects", true).ToString().ToLowerInvariant(),
                    ["page"] = "1",
                    ["per_page"] = Math.Clamp(GetInt("PageSize", 5000), 1, 5000).ToString(CultureInfo.InvariantCulture)
                }));
            }

            return Task.FromResult<IEnumerable<Uri>>(result);
        }

        private void EnsureSameHost(Uri uri)
        {
            if (uri == null || !string.Equals(uri.Host, _baseAddress.Host, StringComparison.OrdinalIgnoreCase) || uri.Port != _baseAddress.Port)
                throw new InvalidOperationException("BlueCity requests may not target a different host or port.");
        }

        private Uri GetConfiguredUri(string name) =>
            _properties.TryGetValue(name, out var value) && Uri.TryCreate(value, UriKind.Absolute, out var uri) ? uri : null;

        private string GetString(string name, string defaultValue) =>
            _properties.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value) ? value : defaultValue;

        private int GetInt(string name, int defaultValue) =>
            _properties.TryGetValue(name, out var value) && int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : defaultValue;

        private bool GetBool(string name, bool defaultValue) =>
            _properties.TryGetValue(name, out var value) && bool.TryParse(value, out var parsed) ? parsed : defaultValue;

        private static string GetOptionalString(JsonElement root, string property) =>
            root.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

        private static Dictionary<string, string> ParseQuery(string query)
        {
            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var parts = pair.Split('=', 2);
                result[Uri.UnescapeDataString(parts[0])] = parts.Length == 2 ? Uri.UnescapeDataString(parts[1]) : string.Empty;
            }
            return result;
        }

        private static Uri BuildUri(string path, IReadOnlyDictionary<string, string> parameters)
        {
            var query = string.Join("&", parameters.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
            return new UriBuilder(path) { Query = query }.Uri;
        }

        /// <inheritdoc/>
        protected override void DisposeManagedCode()
        {
            _client?.CancelPendingRequests();
            _client?.Dispose();
            _client = null;
        }
    }
}
