using Microsoft.AspNetCore.Mvc;
using SCEAP.Models;
using SCEAP.Services;

namespace SCEAP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CableRoutingController : ControllerBase
{
    private readonly ICableRoutingService _routingService;

    public CableRoutingController(ICableRoutingService routingService)
    {
        _routingService = routingService;
    }

    [HttpPost("calculate-route")]
    public async Task<ActionResult<IEnumerable<CableRoute>>> CalculateOptimalRoute([FromBody] RouteRequest request)
    {
        var routes = await _routingService.CalculateOptimalRouteAsync(
            request.CableId, request.StartTrayId, request.EndTrayId);
        return Ok(routes);
    }

    [HttpGet("available-trays/{projectId}")]
    public async Task<ActionResult<IEnumerable<Tray>>> GetAvailableTrays(int projectId)
    {
        var trays = await _routingService.GetAvailableTraysAsync(projectId);
        return Ok(trays);
    }

    [HttpPost("route-length")]
    public async Task<ActionResult<double>> CalculateRouteLength(IEnumerable<CableRoute> routes)
    {
        var length = await _routingService.CalculateRouteLengthAsync(routes);
        return Ok(length);
    }
}

public class RouteRequest
{
    public int CableId { get; set; }
    public int StartTrayId { get; set; }
    public int EndTrayId { get; set; }
}