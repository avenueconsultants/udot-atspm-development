#region license
// Copyright 2026 Utah Departement of Transportation
// for ConfigApi - Utah.Udot.ATSPM.ConfigApi.Utility/ODataEnumMemberNameSchemaFilter.cs
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

using Asp.Versioning.OData;
using Microsoft.AspNetCore.OData.Edm;
using Microsoft.OData.Edm;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Reflection;

namespace Utah.Udot.ATSPM.ConfigApi.Utility
{
    /// <summary>
    /// Documents enum-typed properties of OData (EDM) types as the member-name strings the OData
    /// formatter actually writes - <c>"directionTypeId": "NB"</c> - instead of the <c>int32</c>
    /// Swashbuckle infers from the CLR enum.
    /// </summary>
    /// <remarks>
    /// Only types registered in the EDM model go through the OData serializer. Anything else an
    /// action returns (plain DTOs such as <c>RouteDto</c>) is serialized by System.Text.Json and
    /// really does carry integers, so those properties are left alone. The string form is
    /// registered once per enum as a <c>{EnumName}Name</c> schema; the integer schema keeps the
    /// enum's own name for the DTO usages.
    /// <para>
    /// Relies on <c>UseAllOfToExtendReferenceSchemas()</c>: without it a property whose type is a
    /// component schema is a bare <c>$ref</c> and Swashbuckle never runs schema filters for it.
    /// </para>
    /// <para>
    /// A <c>[Flags]</c> enum holding a combination of members is written by OData as the
    /// comma-joined names (<c>"Approach, Detector"</c>), which a closed enum can't express. The
    /// only flags enum in the model, <c>WatchDogComponentTypes</c>, is never combined, so it is
    /// documented like the rest.
    /// </para>
    /// </remarks>
    public class ODataEnumMemberNameSchemaFilter : ISchemaFilter
    {
        private readonly Lazy<IReadOnlyList<IEdmModel>> _models;

        /// <summary>
        /// Creates the filter. The EDM models are built on first use, not at registration.
        /// </summary>
        /// <param name="modelBuilder">The versioned OData model builder the API is configured with.</param>
        public ODataEnumMemberNameSchemaFilter(VersionedODataModelBuilder modelBuilder)
        {
            _models = new Lazy<IReadOnlyList<IEdmModel>>(() => modelBuilder.GetEdmModels());
        }

        /// <inheritdoc/>
        public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        {
            var enumType = Nullable.GetUnderlyingType(context.Type) ?? context.Type;

            if (!enumType.IsEnum || context.MemberInfo is not MemberInfo member)
                return;

            if (!IsEdmType(member.ReflectedType) && !IsEdmType(member.DeclaringType))
                return;

            var schemaId = $"{enumType.Name}Name";

            if (!context.SchemaRepository.Schemas.ContainsKey(schemaId))
            {
                var names = new OpenApiArray();
                names.AddRange(Enum.GetNames(enumType).Select(n => new OpenApiString(n)));

                context.SchemaRepository.AddDefinition(schemaId, new OpenApiSchema
                {
                    Type = "string",
                    Enum = names.ToList(),
                    Description = $"{enumType.Name} member names, as OData serializes them.",
                    Extensions =
                    {
                        ["x-enum-varnames"] = names,
                        ["x-enumNames"] = names,
                    },
                });
            }

            // Nullable/description on the property schema stay as generated; only the
            // reference is swapped from the integer schema to the member-name one.
            schema.Reference = null;
            schema.Type = null;
            schema.Format = null;
            schema.Enum = null;
            schema.AllOf = new List<OpenApiSchema>
            {
                new OpenApiSchema
                {
                    Reference = new OpenApiReference { Type = ReferenceType.Schema, Id = schemaId },
                },
            };
        }

        private bool IsEdmType(Type? type) =>
            type != null
            && _models.Value.Any(model => model.GetTypeMapper().GetEdmType(model, type) is IEdmStructuredType);
    }
}
