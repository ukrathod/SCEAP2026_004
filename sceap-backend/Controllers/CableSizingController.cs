using Microsoft.AspNetCore.Mvc;
using SCEAP.Models;
using SCEAP.Services;

namespace SCEAP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CableSizingController : ControllerBase
{
    private readonly ICableSizingService _cableSizingService;

    public CableSizingController(ICableSizingService cableSizingService)
    {
        _cableSizingService = cableSizingService;
    }

    [HttpPost("calculate")]
    public async Task<ActionResult<Cable>> CalculateCableSize(Cable cable)
    {
        var result = await _cableSizingService.CalculateCableSizeAsync(cable);
        return Ok(result);
    }

    [HttpPost("calculate-multiple")]
    public async Task<ActionResult<IEnumerable<Cable>>> CalculateMultipleCables(IEnumerable<Cable> cables)
    {
        var results = await _cableSizingService.CalculateMultipleCablesAsync(cables);
        return Ok(results);
    }

    [HttpPost("flc")]
    public async Task<ActionResult<double>> CalculateFLC([FromBody] FLCRequest request)
    {
        var flc = await _cableSizingService.CalculateFLC(request.Power, request.Voltage, request.PowerFactor);
        return Ok(flc);
    }

    [HttpPost("voltage-drop")]
    public async Task<ActionResult<double>> CalculateVoltageDrop([FromBody] VoltageDropRequest request)
    {
        var voltageDrop = await _cableSizingService.CalculateVoltageDrop(
            request.Current, request.Length, request.Resistance, request.Reactance, request.Voltage);
        return Ok(voltageDrop);
    }
}

public class FLCRequest
{
    public double Power { get; set; }
    public double Voltage { get; set; }
    public double PowerFactor { get; set; } = 0.85;
}

public class VoltageDropRequest
{
    public double Current { get; set; }
    public double Length { get; set; }
    public double Resistance { get; set; }
    public double Reactance { get; set; }
    public double Voltage { get; set; }
}