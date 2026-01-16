using Microsoft.AspNetCore.Mvc;
using SCEAP.Models;
using SCEAP.Services;

namespace SCEAP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrayFillController : ControllerBase
{
    private readonly ITrayFillService _trayFillService;

    public TrayFillController(ITrayFillService trayFillService)
    {
        _trayFillService = trayFillService;
    }

    [HttpGet("fill-ratio/{trayId}")]
    public async Task<ActionResult<double>> GetTrayFillRatio(int trayId)
    {
        var fillRatio = await _trayFillService.CalculateTrayFillRatioAsync(trayId);
        return Ok(fillRatio);
    }

    [HttpGet("trays-by-fill/{projectId}")]
    public async Task<ActionResult<IEnumerable<Tray>>> GetTraysByFillRatio(
        int projectId, [FromQuery] double minFillRatio = 0, [FromQuery] double maxFillRatio = 1)
    {
        var trays = await _trayFillService.GetTraysByFillRatioAsync(projectId, minFillRatio, maxFillRatio);
        return Ok(trays);
    }

    [HttpGet("overloaded/{trayId}")]
    public async Task<ActionResult<bool>> IsTrayOverloaded(int trayId)
    {
        var isOverloaded = await _trayFillService.IsTrayOverloadedAsync(trayId);
        return Ok(isOverloaded);
    }

    [HttpPost("optimize/{trayId}")]
    public async Task<ActionResult<Tray>> OptimizeTrayFill(int trayId)
    {
        var optimizedTray = await _trayFillService.OptimizeTrayFillAsync(trayId);
        return Ok(optimizedTray);
    }
}