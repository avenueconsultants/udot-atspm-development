using Microsoft.AspNetCore.HttpLogging;

namespace Utah.Udot.Atspm.ConfigApi.Configuration
{
    /// <summary>
    /// Prevents write-only device credentials from entering HTTP request/response logs.
    /// </summary>
    public sealed class CredentialHttpLoggingInterceptor : IHttpLoggingInterceptor
    {
        public ValueTask OnRequestAsync(HttpLoggingInterceptorContext logContext)
        {
            if (logContext.HttpContext.Request.Path.Value?.EndsWith("/credentials", StringComparison.OrdinalIgnoreCase) == true)
                logContext.LoggingFields = HttpLoggingFields.None;
            return ValueTask.CompletedTask;
        }

        public ValueTask OnResponseAsync(HttpLoggingInterceptorContext logContext) => ValueTask.CompletedTask;
    }
}
