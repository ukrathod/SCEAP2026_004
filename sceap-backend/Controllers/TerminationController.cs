using Microsoft.AspNetCore.Mvc;
using SCEAP.Models;
using SCEAP.Services;

namespace SCEAP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TerminationController : ControllerBase
{
    private readonly ITerminationService _terminationService;

    public TerminationController(ITerminationService terminationService)
    {
        _terminationService = terminationService;
    }

    [HttpGet("cable/{cableId}")]
    public async Task<ActionResult<IEnumerable<Termination>>> GetTerminationsByCable(int cableId)
    {
        var terminations = await _terminationService.GetTerminationsByCableAsync(cableId);
        return Ok(terminations);
    }

    [HttpPost]
    public async Task<ActionResult<Termination>> CreateTermination(Termination termination)
    {
        var createdTermination = await _terminationService.CreateTerminationAsync(termination);
        return CreatedAtAction(nameof(GetTerminationsByCable), 
            new { cableId = createdTermination.CableId }, createdTermination);
    }

    [HttpPost("complete/{terminationId}")]
    public async Task<IActionResult> CompleteTermination(int terminationId)
    {
        var result = await _terminationService.CompleteTerminationAsync(terminationId);
        if (!result)
            return NotFound();

        return NoContent();
    }

    [HttpGet("pending/{projectId}")]
    public async Task<ActionResult<IEnumerable<Termination>>> GetPendingTerminations(int projectId)
    {
        var terminations = await _terminationService.GetPendingTerminationsAsync(projectId);
        return Ok(terminations);
    }
}