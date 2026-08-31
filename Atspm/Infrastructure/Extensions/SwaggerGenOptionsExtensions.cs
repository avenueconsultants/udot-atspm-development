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
