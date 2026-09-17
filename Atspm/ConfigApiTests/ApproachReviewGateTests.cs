using System.ComponentModel.DataAnnotations;
using Utah.Udot.ATSPM.ConfigApi.DTO;
using Xunit;
using XAssert = Xunit.Assert;

namespace Utah.Udot.Atspm.ConfigApiTests
{
    public class ApproachReviewGateTests
    {
        [Fact]
        public void NeedsReviewPhaseZeroRequiresExplicitOverride()
        {
            var dto = new ApproachDto { NeedsReview = true, ProtectedPhaseNumber = 0 };
            XAssert.Throws<ValidationException>(() => dto.ValidateReviewGate());
        }

        [Theory]
        [InlineData(false, 0, false)]
        [InlineData(true, 0, true)]
        [InlineData(true, 2, false)]
        public void ReviewedOrConfiguredApproachPasses(bool needsReview, int phase, bool allowZero)
        {
            var dto = new ApproachDto
            {
                NeedsReview = needsReview,
                ProtectedPhaseNumber = phase,
                AllowZeroProtectedPhase = allowZero
            };
            dto.ValidateReviewGate();
        }
    }
}
