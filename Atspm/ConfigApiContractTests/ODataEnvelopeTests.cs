#region license
// Copyright 2026 Utah Departement of Transportation
// for ConfigApiContractTests - ConfigApiContractTests/ODataEnvelopeTests.cs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#endregion

using System.Net;
using System.Text.Json;
using Asp.Versioning;
using Asp.Versioning.OData;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.OData;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OData.ModelBuilder;
using Microsoft.OpenApi.Models;
using Moq;
using Swashbuckle.AspNetCore.Swagger;
using Utah.Udot.Atspm.ConfigApi.Controllers;
using Utah.Udot.Atspm.Data.Models.ConfigurationModels;
using Utah.Udot.Atspm.Infrastructure.Extensions;
using Utah.Udot.ATSPM.ConfigApi.Utility;
using Utah.Udot.NetStandardToolkit.Services;
using Xunit;

namespace ConfigApiContractTests;

public sealed class ODataEnvelopeTests(EnvelopeHost host) : IClassFixture<EnvelopeHost>
{
    [Theory]
    [InlineData("/api/v1/EnvelopeItems", "/api/v1/EnvelopeItems", 2)]
    [InlineData("/api/v1/EnvelopeItems/1", "/api/v1/EnvelopeItems/{key}", 1)]
    [InlineData("/api/v1/EnvelopeItems/1/children", "/api/v1/EnvelopeItems/{key}/children", 1)]
    [InlineData("/api/v1/EnvelopeItems/Labels", "/api/v1/EnvelopeItems/Labels", 2)]
    public async Task Collections_match_the_documented_envelope(string url, string path, int count)
    {
        using var response = await host.Client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(count, body.RootElement.GetProperty("value").GetArrayLength());
        Assert.True(body.RootElement.TryGetProperty("@odata.context", out _));

        var schema = host.ResponseSchema(path);
        Assert.Equal("object", schema.Type);
        Assert.Contains("value", schema.Required);
        Assert.Equal("array", schema.Properties["value"].Type);
        Assert.NotNull(schema.Properties["value"].Items);
        Assert.DoesNotContain("@odata.count", schema.Required);
        Assert.DoesNotContain("@odata.context", schema.Required);
    }

    [Fact]
    public async Task Expanded_navigation_stays_an_array_inside_the_entity()
    {
        using var response = await host.Client.GetAsync("/api/v1/EnvelopeItems/1?$expand=children");
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var item = body.RootElement.GetProperty("value")[0];
        Assert.Equal(1, item.GetProperty("children").GetArrayLength());
        Assert.Equal("Active", item.GetProperty("kind").GetString());

        var itemRef = host.ResponseSchema("/api/v1/EnvelopeItems/{key}").Properties["value"].Items.Reference.Id;
        var entity = host.Document.Components.Schemas[itemRef];
        Assert.Equal("array", entity.Properties["children"].Type);
        Assert.False(entity.Properties.ContainsKey("@odata.context"));
    }

    [Fact]
    public async Task Count_and_metadata_negotiation_match_optional_properties()
    {
        using var response = await host.Client.GetAsync("/api/v1/EnvelopeItems?$count=true");
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2, body.RootElement.GetProperty("@odata.count").GetInt64());

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/EnvelopeItems?$count=true");
        request.Headers.Accept.ParseAdd("application/json;odata.metadata=none;IEEE754Compatible=true");
        using var negotiated = await host.Client.SendAsync(request);
        negotiated.EnsureSuccessStatusCode();
        using var payload = JsonDocument.Parse(await negotiated.Content.ReadAsStringAsync());
        Assert.False(payload.RootElement.TryGetProperty("@odata.context", out _));
        Assert.Equal("2", payload.RootElement.GetProperty("@odata.count").GetString());
        Assert.Equal(2, payload.RootElement.GetProperty("value").GetArrayLength());

        var count = host.ResponseSchema("/api/v1/EnvelopeItems").Properties["@odata.count"];
        Assert.Contains(count.OneOf, s => s.Type == "integer");
        Assert.Contains(count.OneOf, s => s.Type == "string");
    }

    [Theory]
    [InlineData("/api/v1/EnvelopeItems/$count", "/api/v1/EnvelopeItems/$count", 2)]
    [InlineData("/api/v1/EnvelopeItems/$count?$filter=id eq 1", "/api/v1/EnvelopeItems/$count", 1)]
    public async Task Count_routes_are_plain_text_scalars(string url, string path, long count)
    {
        using var response = await host.Client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        Assert.Equal("text/plain", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal(count, long.Parse(await response.Content.ReadAsStringAsync()));

        var content = host.Document.Paths[path].Operations[OperationType.Get].Responses["200"].Content;
        Assert.Single(content);
        var schema = content["text/plain"].Schema;
        Assert.Equal("integer", schema.Type);
        Assert.Equal("int64", schema.Format);
    }

    [Fact]
    public async Task Paging_documents_the_continuation_link()
    {
        using var response = await host.Client.GetAsync("/api/v1/EnvelopeItems/Paged");
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Single(body.RootElement.GetProperty("value").EnumerateArray());
        Assert.False(string.IsNullOrEmpty(body.RootElement.GetProperty("@odata.nextLink").GetString()));
        Assert.Equal("string", host.ResponseSchema("/api/v1/EnvelopeItems/Paged").Properties["@odata.nextLink"].Type);
    }

    [Theory]
    [InlineData("/api/v1/EnvelopeItems/Single", "object")]
    [InlineData("/plain", "object")]
    [InlineData("/plain/items", "array")]
    public async Task Single_entities_and_non_OData_responses_are_not_wrapped(string path, string expectedType)
    {
        using var response = await host.Client.GetAsync(path);
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(expectedType == "array" ? JsonValueKind.Array : JsonValueKind.Object, body.RootElement.ValueKind);
        if (expectedType == "object") Assert.False(body.RootElement.TryGetProperty("value", out _));
        var schema = host.ResponseSchema(path);
        Assert.False(schema.Properties.ContainsKey("@odata.context"));
        Assert.Equal(expectedType, schema.Reference is null ? schema.Type : host.Document.Components.Schemas[schema.Reference.Id].Type);
    }

    [Fact]
    public async Task Missing_key_and_write_schemas_are_not_collection_envelopes()
    {
        using var response = await host.Client.GetAsync("/api/v1/EnvelopeItems/999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var error = host.Document.Paths["/api/v1/EnvelopeItems/{key}"].Operations[OperationType.Get].Responses["404"];
        Assert.All(error.Content.Values, media => Assert.False(media.Schema.Properties.ContainsKey("@odata.context")));
        var post = host.Document.Paths["/plain"].Operations[OperationType.Post];
        Assert.All(post.RequestBody.Content.Values, media => Assert.False(media.Schema.Properties.ContainsKey("@odata.context")));
        Assert.All(post.Responses["201"].Content.Values, media => Assert.False(media.Schema.Properties.ContainsKey("@odata.context")));
    }
}

public sealed class EnvelopeHost : IDisposable
{
    private readonly TestServer server;
    public HttpClient Client { get; }
    public OpenApiDocument Document { get; }

    public EnvelopeHost()
    {
        var repository = new Mock<IAsyncRepository<EnvelopeItem>>();
        repository.Setup(r => r.GetList()).Returns(EnvelopeData.Items.AsQueryable());
        server = new TestServer(new WebHostBuilder()
            .ConfigureServices(services =>
            {
                services.AddSingleton(repository.Object);
                services.AddControllers()
                    .ConfigureApplicationPartManager(manager =>
                    {
                        manager.ApplicationParts.Clear();
                        manager.ApplicationParts.Add(new AssemblyPart(typeof(EnvelopeHost).Assembly));
                    })
                    .AddOData(options =>
                    {
                        options.Count().Select().Expand().Filter().OrderBy().SetMaxTop(null);
                        options.RouteOptions.EnableKeyInParenthesis = false;
                        options.RouteOptions.EnablePropertyNameCaseInsensitive = true;
                        options.RouteOptions.EnableNonParenthesisForEmptyParameterFunction = true;
                        options.RouteOptions.EnableUnqualifiedOperationCall = true;
                    });
                services.AddTransient<IModelConfiguration, EnvelopeModelConfiguration>();
                services.AddApiVersioning().AddMvc()
                    .AddOData(options => options.AddRouteComponents("api/v{version:apiVersion}"))
                    .AddODataApiExplorer(options =>
                    {
                        options.GroupNameFormat = "'v'VVV";
                        options.SubstituteApiVersionInUrl = true;
                    });
                services.AddSwaggerGen(options =>
                {
                    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Contract tests", Version = "v1" });
                    options.UseAtspmSchemaConventions();
                    options.SchemaFilter<ODataEnumMemberNameSchemaFilter>();
                    options.OperationFilter<ODataCollectionResponseOperationFilter>();
                    options.DocumentFilter<ODataJsonContentTypesDocumentFilter>();
                });
            })
            .Configure(app =>
            {
                app.UseRouting();
                app.UseEndpoints(endpoints => endpoints.MapControllers());
            }));
        Client = server.CreateClient();
        Document = server.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
    }

    public OpenApiSchema ResponseSchema(string path) =>
        Document.Paths[path].Operations[OperationType.Get].Responses["200"].Content["application/json"].Schema;

    public void Dispose()
    {
        Client.Dispose();
        server.Dispose();
    }
}

public sealed class EnvelopeModelConfiguration : IModelConfiguration
{
    public void Apply(ODataModelBuilder builder, ApiVersion apiVersion, string? routePrefix)
    {
        ((ODataConventionModelBuilder)builder).EnableLowerCamelCase();
        var item = builder.EntitySet<EnvelopeItem>("EnvelopeItems").EntityType;
        builder.EntitySet<EnvelopeChild>("EnvelopeChildren");
        item.Collection.Function("Labels").ReturnsCollection<string>();
        item.Collection.Function("Paged").ReturnsCollectionFromEntitySet<EnvelopeItem>("EnvelopeItems");
        item.Collection.Function("Single").ReturnsFromEntitySet<EnvelopeItem>("EnvelopeItems");
    }
}

public enum EnvelopeKind { Active, Inactive }
public sealed class EnvelopeItem : AtspmConfigModelBase<int>
{
    public string Name { get; set; } = "";
    public EnvelopeKind Kind { get; set; }
    public List<EnvelopeChild> Children { get; set; } = [];
}
public sealed class EnvelopeChild : AtspmConfigModelBase<int>
{
    public string Name { get; set; } = "";
}
public sealed record PlainEnvelopeDto(string Name, int[] Values);
public static class EnvelopeData
{
    public static readonly EnvelopeItem[] Items =
    [
        new() { Id = 1, Name = "First", Children = [new() { Id = 10, Name = "Child" }] },
        new() { Id = 2, Name = "Second" },
    ];
}

// Inherit the production actions so the keyed-GET test exercises its actual
// return value and EnableQuery attribute, not a reimplementation of that action.
[ApiVersion(1.0)]
public sealed class EnvelopeItemsController(IAsyncRepository<EnvelopeItem> repository)
    : ConfigControllerBase<EnvelopeItem, int>(repository)
{
    [EnableQuery]
    public ActionResult<IEnumerable<EnvelopeChild>> GetChildren(int key) =>
        GetNavigationProperty<IEnumerable<EnvelopeChild>>(key);

    [HttpGet, EnableQuery]
    [ProducesResponseType(typeof(IEnumerable<string>), 200)]
    public IActionResult Labels() => Ok(new[] { "one", "two" });

    [HttpGet, EnableQuery(PageSize = 1)]
    [ProducesResponseType(typeof(IEnumerable<EnvelopeItem>), 200)]
    public IActionResult Paged() => Ok(EnvelopeData.Items.AsQueryable());

    [HttpGet, EnableQuery]
    [ProducesResponseType(typeof(EnvelopeItem), 200)]
    public IActionResult Single() => Ok(EnvelopeData.Items[0]);
}

[ApiVersion(1.0)]
[Route("plain")]
public sealed class PlainEnvelopeController : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(PlainEnvelopeDto), 201)]
    public ActionResult<PlainEnvelopeDto> Post([FromBody] PlainEnvelopeDto item) => Created("/plain/1", item);

    [HttpGet]
    public ActionResult<PlainEnvelopeDto> Get() => Ok(new PlainEnvelopeDto("plain", [1, 2]));

    // The same EDM entity type and EnableQuery on an ordinary MVC route must
    // still be documented as a bare array.
    [HttpGet("items"), EnableQuery]
    public ActionResult<IEnumerable<EnvelopeItem>> GetItems() => Ok(EnvelopeData.Items);
}