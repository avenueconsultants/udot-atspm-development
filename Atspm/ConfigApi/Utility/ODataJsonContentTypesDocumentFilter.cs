#region license
// Copyright 2026 Utah Departement of Transportation
// for ConfigApi - Utah.Udot.ATSPM.ConfigApi.Utility/ODataJsonContentTypesDocumentFilter.cs
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

using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Utah.Udot.ATSPM.ConfigApi.Utility
{
    /// <summary>
    /// Collapses the content types the OData API explorer declares on each operation down to
    /// <c>application/json</c>.
    /// </summary>
    /// <remarks>
    /// The explorer lists every media type the OData formatters could negotiate - three dozen
    /// parameterized <c>application/json;odata.metadata=...</c> variants plus
    /// <c>application/xml</c>, <c>text/plain</c> and <c>application/octet-stream</c> - on every
    /// operation, whatever it returns. They all describe the same JSON schema, and the
    /// <c>octet-stream</c> entry in particular makes client generators treat the response as a
    /// binary download. A content map is only collapsed when none of its schemas is binary, so a
    /// genuine file endpoint keeps whatever it declares.
    /// </remarks>
    public class ODataJsonContentTypesDocumentFilter : IDocumentFilter
    {
        private const string Json = "application/json";

        /// <inheritdoc/>
        public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
        {
            foreach (var operation in swaggerDoc.Paths.Values.SelectMany(p => p.Operations.Values))
            {
                if (operation.RequestBody?.Content is { } requestContent)
                    Collapse(requestContent);

                foreach (var response in operation.Responses.Values)
                {
                    if (response.Content is { } responseContent)
                        Collapse(responseContent);
                }
            }
        }

        private static void Collapse(IDictionary<string, OpenApiMediaType> content)
        {
            if (content.Count <= 1 || content.Values.Any(IsBinary))
                return;

            var json = content.TryGetValue(Json, out var exact)
                ? exact
                : content.FirstOrDefault(c => c.Key.StartsWith(Json, StringComparison.OrdinalIgnoreCase)).Value;

            if (json == null)
                return;

            content.Clear();
            content[Json] = json;
        }

        private static bool IsBinary(OpenApiMediaType mediaType) =>
            mediaType.Schema is { Type: "string", Format: "binary" or "byte" };
    }
}
