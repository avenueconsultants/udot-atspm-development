#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.Controllers/LinkPivotController.cs
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

using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Utah.Udot.Atspm.Business.LinkPivot;
using Utah.Udot.Atspm.ReportApi.ReportServices;

namespace Utah.Udot.Atspm.ReportApi.Controllers
{
    /// <summary>
    /// Left turn gap analysis report controller
    /// </summary>
    [ApiVersion(1.0)]
    public class LinkPivotController : ReportControllerBase<LinkPivotOptions, ReportResult<LinkPivotResult>>
    {
        private readonly LinkPivotReportService linkPivotReportService;
        /// <inheritdoc/>
        public LinkPivotController(IReportService<LinkPivotOptions, ReportResult<LinkPivotResult>> reportService, LinkPivotReportService linkPivotReportService, ILogger<LinkPivotController> logger) : base(reportService, logger)
        {
            this.linkPivotReportService = linkPivotReportService;
        }

        [HttpPost("getPcdData")]
        //[Produces("application/json", "application/xml")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ReportResult<LinkPivotPcdResult>>> GetPcdData(LinkPivotPcdOptions options)
        {
            try
            {
                var result = await linkPivotReportService.GetPcdData(options);

                return Ok(result);
            }
            catch (Exception e)
            {
                return Ok(ReportResult<LinkPivotPcdResult>.Failure(ReportErrorFactory.FromException(e, nameof(LinkPivotController))));
            }
        }

        [HttpPost("getLinkPivotForTsd")]
        //[Produces("application/json", "application/xml")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<IEnumerable<ReportResult<LinkPivotForTsd>>>> GetLinkPivotForTSD(TimeSpaceDiagramOptions options)
        {
            try
            {
                var result = await linkPivotReportService.GetLinkPivotForTSD(options);

                return Ok(result);
            }
            catch (Exception e)
            {
                return Ok(ReportErrorFactory.FromException(e, nameof(LinkPivotController)).ToFailureReportResults<LinkPivotForTsd>());
            }
        }
    }
}
