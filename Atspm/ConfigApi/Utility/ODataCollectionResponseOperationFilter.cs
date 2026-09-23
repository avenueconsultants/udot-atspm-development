#region license
// Copyright 2026 Utah Departement of Transportation
// for ConfigApi - Utah.Udot.ATSPM.ConfigApi.Utility/ODataCollectionResponseOperationFilter.cs
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

using Microsoft.AspNetCore.OData.Routing;
using Microsoft.AspNetCore.OData.Routing.Template;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Utah.Udot.ATSPM.ConfigApi.Utility
{
    /// <summary>
    /// Documents the envelope the OData formatter adds to collection responses.
    /// </summary>
    public sealed class ODataCollectionResponseOperationFilter : IOperationFilter
    {
        /// <inheritdoc />
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            // EnableQuery also works on ordinary MVC endpoints. Only OData routes
            // use the OData output formatter and its top-level collection envelope.
            var routing = context.ApiDescription.ActionDescriptor.EndpointMetadata
                .OfType<IODataRoutingMetadata>().FirstOrDefault();
            if (routing is null)
            {
                return;
            }

            foreach (var (status, response) in operation.Responses)
            {
                if (!int.TryParse(status, out var code) || code < 200 || code >= 300)
                {
                    continue;
                }

                // Count routes inherit the collection action's response annotation,
                // but the OData formatter returns a bare count as text/plain.
                if (routing.Template.LastOrDefault() is CountSegmentTemplate)
                {
                    response.Content.Clear();
                    response.Content["text/plain"] = new OpenApiMediaType
                    {
                        Schema = new OpenApiSchema { Type = "integer", Format = "int64", Minimum = 0 },
                    };
                    continue;
                }

                foreach (var (contentType, mediaType) in response.Content)
                {
                    if (!contentType.StartsWith("application/json", StringComparison.OrdinalIgnoreCase)
                        || mediaType.Schema is not { Type: "array" } collection)
                    {
                        continue;
                    }

                    // Use the existing schema, including its item references, rather
                    // than regenerating entity schemas or wrapping nested arrays.
                    mediaType.Schema = new OpenApiSchema
                    {
                        Type = "object",
                        Required = new HashSet<string> { "value" },
                        Properties = new Dictionary<string, OpenApiSchema>
                        {
                            ["value"] = collection,
                            ["@odata.context"] = new()
                            {
                                Type = "string",
                                Description = "Context URL; omitted when odata.metadata=none is requested.",
                            },
                            ["@odata.count"] = new()
                            {
                                Description = "Total count when requested. IEEE754Compatible=true serializes the count as a string.",
                                OneOf = new List<OpenApiSchema>
                                {
                                    new() { Type = "integer", Format = "int64", Minimum = 0 },
                                    new() { Type = "string", Pattern = "^[0-9]+$" },
                                },
                            },
                            ["@odata.nextLink"] = new()
                            {
                                Type = "string",
                                Description = "URL of the next page, when the response is a partial result.",
                            },
                        },
                    };
                }
            }
        }
    }
}
