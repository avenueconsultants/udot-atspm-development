#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/ReportResultExtensions.cs
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

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    internal static class ReportResultExtensions
    {
        public static ReportResult<T> ToReportResult<T>(this T result)
            => ReportResult<T>.Success(result);

        public static ReportResult<T> ToFailureReportResult<T>(this ReportError error)
            => ReportResult<T>.Failure(error);

        public static IEnumerable<ReportResult<T>> ToReportResults<T>(this IEnumerable<T> results)
            => results?.Where(result => result != null).Select(ReportResult<T>.Success) ?? [];

        public static IEnumerable<ReportResult<T>> ToFailureReportResults<T>(this ReportError error)
            => [ReportResult<T>.Failure(error)];

        public static async Task<ReportResult<T>> ToReportResultAsync<T>(
            this Task<T> task,
            Func<Exception, ReportError> createError)
        {
            try
            {
                var result = await task;
                return result == null ? null : ReportResult<T>.Success(result);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ReportResult<T>.Failure(createError(ex));
            }
        }

        public static async Task<IEnumerable<ReportResult<T>>> ToReportResultsAsync<T>(
            this Task<IEnumerable<ReportResult<T>>> task,
            Func<Exception, ReportError> createError)
        {
            try
            {
                return await task;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ReportResult<T>.Failure(createError(ex)).Yield();
            }
        }

        private static IEnumerable<T> Yield<T>(this T value)
        {
            yield return value;
        }
    }
}
