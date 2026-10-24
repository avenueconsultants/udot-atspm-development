#region license
// Copyright 2026 Utah Departement of Transportation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
#endregion

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Exceptions;
using Utah.Udot.Atspm.Infrastructure.Services.DownloaderClients;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.DownloaderClientTests
{
    public class OusterBlueCityEdgeDownloaderClientTests : IDisposable
    {
        private readonly string _tempPath = Path.Combine(Path.GetTempPath(), $"atspm-bluecity-{Guid.NewGuid():N}");

        public OusterBlueCityEdgeDownloaderClientTests() => Directory.CreateDirectory(_tempPath);

        [Fact]
        public async Task DownloadsTwentyMinuteWindowAcrossPagesAndRefreshesAfterUnauthorized()
        {
            var handler = new BlueCityStubHandler();
            using var http = new HttpClient(handler);
            using var sut = new OusterBlueCityEdgeDownloaderClient(http, () => new DateTimeOffset(2026, 9, 17, 18, 0, 0, TimeSpan.Zero));
            var properties = new Dictionary<string, string>
            {
                ["BaseUrl"] = "https://10.235.13.48/analytics/api/v1/",
                ["TokenUrl"] = "https://10.235.13.48/auth/realms/detect/protocol/openid-connect/token",
                ["LoggingOffset"] = "20",
                ["OverlapMinutes"] = "0",
                ["EndLagMinutes"] = "0",
                ["MaxWindowMinutes"] = "20",
                ["PageSize"] = "50",
                ["Timezone"] = "US/Mountain"
            };

            await sut.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443),
                new NetworkCredential("analytics-client", "secret-value"),
                connectionProperties: properties);

            Assert.True(sut.IsConnected);
            Assert.Equal(TransportProtocols.OusterBlueCityEdge, sut.Protocol);
            var resource = Assert.Single(await sut.ListResourcesAsync(string.Empty));
            Assert.Equal("/analytics/api/v1/object_events", resource.AbsolutePath);
            Assert.Contains("start_time=2026-09-17T11%3A40%3A00-06%3A00", resource.Query);
            Assert.Contains("end_time=2026-09-17T12%3A00%3A00-06%3A00", resource.Query);
            Assert.Contains("per_page=50", resource.Query);
            Assert.Contains("page=1", resource.Query);
            Assert.DoesNotContain("secret-value", resource.AbsoluteUri);

            var local = new UriBuilder(Uri.UriSchemeFile, "localhost")
            {
                Path = Path.Combine(_tempPath, "events.json")
            }.Uri;
            var file = await sut.DownloadResourceAsync(local, resource);

            using var document = JsonDocument.Parse(await File.ReadAllTextAsync(file.FullName));
            Assert.Equal("US/Mountain", document.RootElement.GetProperty("timezone").GetString());
            Assert.Equal("imperial", document.RootElement.GetProperty("units").GetString());
            Assert.Equal(new long[] { 101, 102 }, document.RootElement.GetProperty("events").EnumerateArray().Select(e => e.GetProperty("id").GetInt64()));
            Assert.Equal(2, handler.TokenRequests);
            Assert.Equal(3, handler.EventRequests);
            Assert.Equal(new[] { "token-1", "token-2", "token-2" }, handler.BearerTokens);
            Assert.Equal("analytics-client", handler.ClientIds.Distinct().Single());
            Assert.Equal("secret-value", handler.ClientSecrets.Distinct().Single());
        }

        [Fact]
        public async Task RejectsConfiguredEndpointOnAnotherHost()
        {
            using var sut = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler()));
            var exception = await Assert.ThrowsAsync<DownloaderClientConnectionException>(() => sut.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443),
                new NetworkCredential("client", "secret"),
                connectionProperties: new Dictionary<string, string>
                {
                    ["BaseUrl"] = "https://192.0.2.5/analytics/api/v1/"
                }));

            Assert.DoesNotContain("secret", exception.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task DerivesDefaultEndpointsAndSplitsLargeWindows()
        {
            var handler = new BlueCityStubHandler();
            using var sut = new OusterBlueCityEdgeDownloaderClient(
                new HttpClient(handler),
                () => new DateTimeOffset(2026, 9, 17, 18, 0, 0, TimeSpan.Zero));

            await sut.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443),
                new NetworkCredential("client", "secret"),
                connectionProperties: new Dictionary<string, string>
                {
                    ["LoggingOffset"] = "125",
                    ["OverlapMinutes"] = "0",
                    ["EndLagMinutes"] = "5",
                    ["MaxWindowMinutes"] = "60"
                });

            var resources = (await sut.ListResourcesAsync(string.Empty)).ToArray();

            Assert.Equal("/auth/realms/detect/protocol/openid-connect/token", handler.TokenUris.Single().AbsolutePath);
            Assert.Equal(2, resources.Length);
            Assert.All(resources, resource => Assert.Equal("/analytics/api/v1/object_events", resource.AbsolutePath));
            Assert.Contains("start_time=2026-09-17T09%3A55%3A00-06%3A00", resources[0].Query);
            Assert.Contains("end_time=2026-09-17T10%3A55%3A00-06%3A00", resources[0].Query);
            Assert.Contains("start_time=2026-09-17T10%3A55%3A00-06%3A00", resources[1].Query);
            Assert.Contains("end_time=2026-09-17T11%3A55%3A00-06%3A00", resources[1].Query);
        }

        [Fact]
        public async Task RejectsZeroLoggingOffsetAndMalformedConfiguredUrl()
        {
            using var zeroOffset = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler()));
            await zeroOffset.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443),
                new NetworkCredential("client", "secret"),
                connectionProperties: new Dictionary<string, string> { ["LoggingOffset"] = "0", ["Timezone"] = "US/Mountain" });
            await Assert.ThrowsAsync<DownloaderClientListResourcesException>(() => zeroOffset.ListResourcesAsync(string.Empty));

            using var malformed = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler()));
            await Assert.ThrowsAsync<DownloaderClientConnectionException>(() => malformed.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443),
                new NetworkCredential("client", "secret"),
                connectionProperties: new Dictionary<string, string> { ["BaseUrl"] = "not a URL" }));
        }

        [Fact]
        public async Task SecureHandlerDisablesRedirectsAndCertificatePinTakesPrecedence()
        {
            using var sut = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler()));
            await sut.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443),
                new NetworkCredential("client", "secret"),
                connectionProperties: new Dictionary<string, string>
                {
                    ["LoggingOffset"] = "20",
                    ["Timezone"] = "US/Mountain",
                    ["AllowUntrustedCertificate"] = "true",
                    ["PinnedCertThumbprint"] = "00:11"
                });

            using var handler = sut.CreateHandler(5000);
            Assert.False(handler.AllowAutoRedirect);
            Assert.Equal(TimeSpan.FromSeconds(5), handler.ConnectTimeout);
            Assert.NotNull(handler.SslOptions.RemoteCertificateValidationCallback);

            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=bluecity-test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddMinutes(5));
            var colonPin = string.Join(":", Enumerable.Range(0, certificate.Thumbprint.Length / 2).Select(i => certificate.Thumbprint.Substring(i * 2, 2)));

            Assert.Equal(certificate.Thumbprint, certificate.GetCertHashString());
            Assert.Equal(certificate.Thumbprint, colonPin.Replace(":", string.Empty));
            Assert.True(OusterBlueCityEdgeDownloaderClient.ValidateCertificate(certificate, null, SslPolicyErrors.RemoteCertificateChainErrors, certificate.Thumbprint, true));
            Assert.True(OusterBlueCityEdgeDownloaderClient.ValidateCertificate(certificate, null, SslPolicyErrors.RemoteCertificateChainErrors, colonPin, true));
            Assert.False(OusterBlueCityEdgeDownloaderClient.ValidateCertificate(certificate, null, SslPolicyErrors.None, "0011", true));
        }

        [Fact]
        public async Task EnforcesBoxTimezoneAndFailedConfigLeavesClientDisconnected()
        {
            using var mismatch = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler()));
            await Assert.ThrowsAsync<DownloaderClientConnectionException>(() => mismatch.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443), new NetworkCredential("client", "secret"),
                connectionProperties: new Dictionary<string, string> { ["Timezone"] = "UTC" }));
            Assert.False(mismatch.IsConnected);

            using var failedConfig = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler { ConfigStatusCode = HttpStatusCode.InternalServerError }));
            await Assert.ThrowsAsync<DownloaderClientConnectionException>(() => failedConfig.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443), new NetworkCredential("client", "secret")));
            Assert.False(failedConfig.IsConnected);
        }

        [Fact]
        public async Task EnforcesWindowCapsPathPrefixPortAndResponseTimezone()
        {
            async Task<OusterBlueCityEdgeDownloaderClient> Connected(Dictionary<string, string> properties = null, BlueCityStubHandler handler = null)
            {
                var result = new OusterBlueCityEdgeDownloaderClient(new HttpClient(handler ?? new BlueCityStubHandler()));
                await result.ConnectAsync(new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443), new NetworkCredential("client", "secret"), connectionProperties: properties);
                return result;
            }

            using (var maxTotal = await Connected(new() { ["LoggingOffset"] = "21", ["OverlapMinutes"] = "0", ["EndLagMinutes"] = "0", ["MaxTotalWindowMinutes"] = "20" }))
                await Assert.ThrowsAsync<DownloaderClientListResourcesException>(() => maxTotal.ListResourcesAsync(string.Empty));

            using (var maxChunks = await Connected(new() { ["LoggingOffset"] = "21", ["OverlapMinutes"] = "0", ["EndLagMinutes"] = "0", ["MaxWindowMinutes"] = "10", ["MaxChunks"] = "2" }))
                await Assert.ThrowsAsync<DownloaderClientListResourcesException>(() => maxChunks.ListResourcesAsync(string.Empty));

            using (var prefix = await Connected(new() { ["LoggingOffset"] = "20" }))
            {
                var normalized = Assert.Single(await prefix.ListResourcesAsync("analytics/api/v1/object_events"));
                Assert.Equal("/analytics/api/v1/object_events", normalized.AbsolutePath);
                await Assert.ThrowsAsync<DownloaderClientListResourcesException>(() => prefix.ListResourcesAsync("/lidar-hub/status"));
            }

            using var portMismatch = new OusterBlueCityEdgeDownloaderClient(new HttpClient(new BlueCityStubHandler()));
            await Assert.ThrowsAsync<DownloaderClientConnectionException>(() => portMismatch.ConnectAsync(
                new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443), new NetworkCredential("client", "secret"),
                connectionProperties: new() { ["TokenUrl"] = "https://10.235.13.48:8443/auth/realms/detect/protocol/openid-connect/token" }));

            var timezoneHandler = new BlueCityStubHandler { ResponseTimezone = "UTC", ForceFirstUnauthorized = false };
            using var timezone = await Connected(new() { ["LoggingOffset"] = "20" }, timezoneHandler);
            var resource = Assert.Single(await timezone.ListResourcesAsync(string.Empty));
            var local = new UriBuilder(Uri.UriSchemeFile, "localhost") { Path = Path.Combine(_tempPath, "timezone.json") }.Uri;
            await Assert.ThrowsAsync<DownloaderClientDownloadResourceException>(() => timezone.DownloadResourceAsync(local, resource));
        }

        [Fact]
        public async Task EnforcesPageCapAndDefaultHandlerHasNoTlsCallback()
        {
            var pageHandler = new BlueCityStubHandler { ForceFirstUnauthorized = false, AlwaysNextPage = true };
            using var client = new OusterBlueCityEdgeDownloaderClient(new HttpClient(pageHandler));
            await client.ConnectAsync(new IPEndPoint(IPAddress.Parse("10.235.13.48"), 443), new NetworkCredential("client", "secret"),
                connectionProperties: new() { ["LoggingOffset"] = "20", ["MaxPages"] = "1" });
            var resource = Assert.Single(await client.ListResourcesAsync(string.Empty));
            var local = new UriBuilder(Uri.UriSchemeFile, "localhost") { Path = Path.Combine(_tempPath, "pages.json") }.Uri;
            await Assert.ThrowsAsync<DownloaderClientDownloadResourceException>(() => client.DownloadResourceAsync(local, resource));

            using var handler = client.CreateHandler(5000);
            Assert.Null(handler.SslOptions.RemoteCertificateValidationCallback);
            Assert.NotNull(OusterBlueCityEdgeDownloaderClient.ResolveTimeZone("US/Mountain"));
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempPath)) Directory.Delete(_tempPath, true);
        }

        private sealed class BlueCityStubHandler : HttpMessageHandler
        {
            public HttpStatusCode ConfigStatusCode { get; init; } = HttpStatusCode.OK;
            public string ResponseTimezone { get; init; } = "US/Mountain";
            public bool ForceFirstUnauthorized { get; init; } = true;
            public bool AlwaysNextPage { get; init; }
            public int TokenRequests { get; private set; }
            public int EventRequests { get; private set; }
            public List<string> BearerTokens { get; } = [];
            public List<string> ClientIds { get; } = [];
            public List<string> ClientSecrets { get; } = [];
            public List<Uri> TokenUris { get; } = [];

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                if (request.Method == HttpMethod.Post && request.RequestUri.AbsolutePath.EndsWith("/token", StringComparison.Ordinal))
                {
                    TokenRequests++;
                    TokenUris.Add(request.RequestUri);
                    var form = ParseForm(await request.Content.ReadAsStringAsync(cancellationToken));
                    ClientIds.Add(form["client_id"]);
                    ClientSecrets.Add(form["client_secret"]);
                    return Json($$"""{"access_token":"token-{{TokenRequests}}","expires_in":3600}""");
                }

                if (request.RequestUri.AbsolutePath.EndsWith("/config", StringComparison.Ordinal))
                    return ConfigStatusCode == HttpStatusCode.OK
                        ? Json("""{"timezone":"US/Mountain","imperial_measuring_unit":true}""")
                        : new HttpResponseMessage(ConfigStatusCode);

                EventRequests++;
                BearerTokens.Add(request.Headers.Authorization?.Parameter);
                var page = ParseQuery(request.RequestUri.Query)["page"];
                if (ForceFirstUnauthorized && EventRequests == 1)
                    return new HttpResponseMessage(HttpStatusCode.Unauthorized);

                var next = AlwaysNextPage ? int.Parse(page) + 1 : page == "1" ? 2 : (int?)null;
                return Json($$"""{"timezone":"{{ResponseTimezone}}","units":"imperial","pagination":{"current_page":{{page}},"next_page":{{(next?.ToString() ?? "null")}}},"events":[{"id":{{100 + int.Parse(page)}}}]}""");
            }

            private static HttpResponseMessage Json(string value) => new(HttpStatusCode.OK)
            {
                Content = new StringContent(value, Encoding.UTF8, "application/json")
            };

            private static Dictionary<string, string> ParseForm(string value) => ParseQuery(value);

            private static Dictionary<string, string> ParseQuery(string value) => value.TrimStart('?')
                .Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(pair => pair.Split('=', 2))
                .ToDictionary(pair => Uri.UnescapeDataString(pair[0]), pair => Uri.UnescapeDataString(pair[1].Replace('+', ' ')));
        }
    }
}
