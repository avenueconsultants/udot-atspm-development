using Asp.Versioning;
using Microsoft.OData.ModelBuilder;
using Microsoft.OData.Edm;
using Utah.Udot.Atspm.ConfigApi.Configuration;
using Xunit;
using XAssert = Xunit.Assert;

namespace Utah.Udot.Atspm.ConfigApiTests
{
    public class DeviceConfigurationOdataSecurityTests
    {
        [Fact]
        public void ReadModelOmitsCredentialFields()
        {
            var builder = new ODataConventionModelBuilder();
            new DeviceConfigurationOdataConfiguration().Apply(builder, new ApiVersion(1, 0), "api/v1");

            var type = builder.GetEdmModel().FindDeclaredType("Utah.Udot.Atspm.Data.Models.DeviceConfiguration");

            var structuredType = XAssert.IsAssignableFrom<IEdmStructuredType>(type);
            XAssert.DoesNotContain(structuredType.DeclaredProperties, property => property.Name == "Password");
            XAssert.DoesNotContain(structuredType.DeclaredProperties, property => property.Name == "ConnectionProperties");
        }
    }
}
