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
            using var sut = new OusterBlueCityEdgeDownloaderClient(http, () => new DateTime(2026, 9, 17, 12, 0, 0));
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
            var resource = Assert.Single(await sut.ListResourcesAsync("object_events"));
            Assert.Contains("start_time=2026-09-17T11%3A40%3A00", resource.Query);
            Assert.Contains("end_time=2026-09-17T12%3A00%3A00", resource.Query);
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
                () => new DateTime(2026, 9, 17, 12, 0, 0));

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
            Assert.Contains("start_time=2026-09-17T09%3A55%3A00", resources[0].Query);
            Assert.Contains("end_time=2026-09-17T10%3A55%3A00", resources[0].Query);
            Assert.Contains("start_time=2026-09-17T10%3A55%3A00", resources[1].Query);
            Assert.Contains("end_time=2026-09-17T11%3A55%3A00", resources[1].Query);
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempPath)) Directory.Delete(_tempPath, true);
        }

        private sealed class BlueCityStubHandler : HttpMessageHandler
        {
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

                EventRequests++;
                BearerTokens.Add(request.Headers.Authorization?.Parameter);
                var page = ParseQuery(request.RequestUri.Query)["page"];
                if (EventRequests == 1)
                    return new HttpResponseMessage(HttpStatusCode.Unauthorized);

                return page == "1"
                    ? Json("""{"timezone":"US/Mountain","units":"imperial","pagination":{"current_page":1,"next_page":2},"events":[{"id":101}]}""")
                    : Json("""{"timezone":"US/Mountain","units":"imperial","pagination":{"current_page":2,"next_page":null},"events":[{"id":102}]}""");
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
