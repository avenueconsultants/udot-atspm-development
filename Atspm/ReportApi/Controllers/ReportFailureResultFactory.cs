#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.Controllers/ReportFailureResultFactory.cs
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

using System.Collections;
using Utah.Udot.Atspm.Business.Common;

namespace Utah.Udot.Atspm.ReportApi.Controllers
{
    internal static class ReportFailureResultFactory
    {
        public static bool TryCreateFailureResult(Type resultType, ReportError error, out object failureResult)
        {
            failureResult = null;

            if (TryGetReportResultValueType(resultType, out var valueType))
            {
                failureResult = CreateReportResultFailure(valueType, error);
                return true;
            }

            if (TryGetEnumerableReportResultItemType(resultType, out var itemType))
            {
                var value = CreateReportResultFailure(itemType.GetGenericArguments()[0], error);
                var list = (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(itemType));
                list.Add(value);
                failureResult = list;
                return true;
            }

            return false;
        }

        private static bool TryGetReportResultValueType(Type type, out Type valueType)
        {
            valueType = null;
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(ReportResult<>))
            {
                valueType = type.GetGenericArguments()[0];
                return true;
            }

            return false;
        }

        private static bool TryGetEnumerableReportResultItemType(Type type, out Type itemType)
        {
            itemType = null;
            var enumerableType = type.IsGenericType && type.GetGenericTypeDefinition() == typeof(IEnumerable<>)
                ? type
                : type.GetInterfaces().FirstOrDefault(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>));

            var candidate = enumerableType?.GetGenericArguments()[0];
            if (candidate != null && candidate.IsGenericType && candidate.GetGenericTypeDefinition() == typeof(ReportResult<>))
            {
                itemType = candidate;
                return true;
            }

            return false;
        }

        private static object CreateReportResultFailure(Type valueType, ReportError error)
        {
            var reportResultType = typeof(ReportResult<>).MakeGenericType(valueType);
            var failureMethod = reportResultType.GetMethod(nameof(ReportResult<object>.Failure));
            return failureMethod.Invoke(null, [error]);
        }
    }
}
