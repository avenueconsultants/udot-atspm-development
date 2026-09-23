#region license
// Copyright 2026 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.Atspm.Infrastructure.Extensions/SwaggerGenOptionsExtensions.cs
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

using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Utah.Udot.Atspm.Infrastructure.Extensions
{
    /// <summary>
    /// Swashbuckle configuration shared by the ATSPM APIs.
    /// </summary>
    public static class SwaggerGenOptionsExtensions
    {
        /// <summary>
        /// Applies the schema conventions every ATSPM API documents itself with, so the four
        /// exported specs describe their payloads the same way.
        /// </summary>
        public static SwaggerGenOptions UseAtspmSchemaConventions(this SwaggerGenOptions options)
        {
            // A bare $ref carries nothing but the reference, so a property whose type is
            // another schema loses its `nullable` flag. Wrapping it in allOf keeps the flag,
            // and lets schema filters run against the property rather than only the type.
            options.UseAllOfToExtendReferenceSchemas();

            // SupportNonNullableReferenceTypes() is deliberately not enabled. It would let a
            // DTO's `?` annotations reach the document instead of every reference-typed
            // property being documented nullable, but it makes Swashbuckle read nullability
            // metadata for every property, and NullabilityInfoContext throws
            // IndexOutOfRangeException on the config entities: they are compiled without a
            // nullable context yet derive from the generic AtspmConfigModelBase<T>, so the
            // metadata the reader expects is not there. ConfigApi cannot produce a document
            // at all with it on. Documenting everything nullable is the safe direction, so
            // it stays off until those models carry a nullable context.

            options.DocumentEnumMemberNames();

            // A System.Type property is serialized as its assembly-qualified name. Left alone,
            // Swashbuckle documents the CLR reflection graph instead: Type drags in Assembly,
            // Module, MethodInfo and two dozen more schemas that no endpoint returns, and every
            // generated client then carries them.
            options.MapType<Type>(() => new OpenApiSchema { Type = "string" });

            return options;
        }

        /// <summary>
        /// Names each schema after its CLR type, giving generic types a readable, unique name
        /// such as <c>KeyValuePairOfDateTimeAndInt32</c>.
        /// </summary>
        /// <remarks>
        /// Swashbuckle's own generator already handles generic types. What breaks them is
        /// overriding it with a bare <c>type.Name</c>, which yields the raw CLR name
        /// (<c>KeyValuePair`2</c>) and is not a valid OpenAPI component key. ConfigApi keeps
        /// Swashbuckle's default naming, which its OData document is built around.
        /// </remarks>
        public static SwaggerGenOptions UseGenericAwareSchemaIds(this SwaggerGenOptions options)
        {
            options.CustomSchemaIds(SchemaId);
            return options;
        }

        /// <summary>
        /// Adds each enum's member names to its schema as <c>x-enum-varnames</c> / <c>x-enumNames</c>,
        /// so client generators (orval, NSwag, openapi-generator) emit named members instead of
        /// positional ones like <c>NUMBER_3</c>. Without the names, a member inserted into a C# enum
        /// silently changes what every generated positional name after it refers to.
        /// </summary>
        public static SwaggerGenOptions DocumentEnumMemberNames(this SwaggerGenOptions options)
        {
            options.SchemaFilter<EnumMemberNamesSchemaFilter>();
            return options;
        }

        private static string SchemaId(Type type)
        {
            if (!type.IsGenericType)
            {
                return type.Name;
            }

            var name = type.Name.Split('`')[0];
            var args = string.Join("And", type.GetGenericArguments().Select(SchemaId));
            return $"{name}Of{args}";
        }
    }

    /// <summary>
    /// Schema filter behind <see cref="SwaggerGenOptionsExtensions.DocumentEnumMemberNames"/>.
    /// </summary>
    public class EnumMemberNamesSchemaFilter : ISchemaFilter
    {
        /// <inheritdoc/>
        public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        {
            var type = Nullable.GetUnderlyingType(context.Type) ?? context.Type;

            if (!type.IsEnum || schema.Enum == null || schema.Enum.Count == 0)
                return;

            // Swashbuckle lists the values in Enum.GetValues order, which is also the order
            // Enum.GetNames uses. If the counts differ (a custom converter, a filtered set)
            // the names can't be trusted to line up, so leave the schema alone.
            var names = Enum.GetNames(type);
            if (names.Length != schema.Enum.Count)
                return;

            var nameList = new OpenApiArray();
            nameList.AddRange(names.Select(n => new OpenApiString(n)));

            schema.Extensions["x-enum-varnames"] = nameList;
            schema.Extensions["x-enumNames"] = nameList;
        }
    }
}
