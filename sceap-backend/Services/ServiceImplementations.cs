using Microsoft.EntityFrameworkCore;
using SCEAP.Data;
using SCEAP.Models;
using SCEAP.Engines;

namespace SCEAP.Services;

public class ProjectService : IProjectService
{
    private readonly SceapDbContext _context;

    public ProjectService(SceapDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Project>> GetAllProjectsAsync()
    {
        return await _context.Projects.Include(p => p.Cables).ToListAsync();
    }

    public async Task<Project?> GetProjectByIdAsync(int id)
    {
        return await _context.Projects
            .Include(p => p.Cables)
            .Include(p => p.Trays)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<Project> CreateProjectAsync(Project project)
    {
        _context.Projects.Add(project);
        await _context.SaveChangesAsync();
        return project;
    }

    public async Task<Project?> UpdateProjectAsync(int id, Project project)
    {
        var existingProject = await _context.Projects.FindAsync(id);
        if (existingProject == null) return null;

        existingProject.Name = project.Name;
        existingProject.Description = project.Description;
        existingProject.Status = project.Status;
        existingProject.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existingProject;
    }

    public async Task<bool> DeleteProjectAsync(int id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null) return false;

        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();
        return true;
    }
}

public class CableSizingService : ICableSizingService
{
    private readonly CableSizingEngine _engine;

    public CableSizingService()
    {
        _engine = new CableSizingEngine();
    }

    public async Task<Cable> CalculateCableSizeAsync(Cable cable)
    {
        return await Task.Run(() => _engine.CalculateCableSize(cable));
    }

    public async Task<IEnumerable<Cable>> CalculateMultipleCablesAsync(IEnumerable<Cable> cables)
    {
        var results = new List<Cable>();
        foreach (var cable in cables)
        {
            results.Add(await CalculateCableSizeAsync(cable));
        }
        return results;
    }

    public async Task<double> CalculateFLC(double power, double voltage, double powerFactor = 0.85)
    {
        return await Task.Run(() => _engine.CalculateFLC(power, voltage, powerFactor));
    }

    public async Task<double> CalculateVoltageDrop(double current, double length, double resistance, double reactance, double voltage)
    {
        return await Task.Run(() => _engine.CalculateVoltageDrop(current, length, resistance, reactance, voltage));
    }
}

public class CableRoutingService : ICableRoutingService
{
    private readonly SceapDbContext _context;
    private readonly RoutingEngine _engine;

    public CableRoutingService(SceapDbContext context)
    {
        _context = context;
        _engine = new RoutingEngine();
    }

    public async Task<IEnumerable<CableRoute>> CalculateOptimalRouteAsync(int cableId, int startTrayId, int endTrayId)
    {
        var cable = await _context.Cables.FindAsync(cableId);
        if (cable == null) throw new ArgumentException("Cable not found");

        var trays = await _context.Trays.Where(t => t.ProjectId == cable.ProjectId).ToListAsync();

        return await Task.Run(() => _engine.CalculateOptimalRoute(cable, trays, startTrayId, endTrayId));
    }

    public async Task<IEnumerable<Tray>> GetAvailableTraysAsync(int projectId)
    {
        return await _context.Trays.Where(t => t.ProjectId == projectId).ToListAsync();
    }

    public async Task<double> CalculateRouteLengthAsync(IEnumerable<CableRoute> routes)
    {
        return routes.Sum(r => r.Distance);
    }
}

public class TrayFillService : ITrayFillService
{
    private readonly SceapDbContext _context;

    public TrayFillService(SceapDbContext context)
    {
        _context = context;
    }

    public async Task<double> CalculateTrayFillRatioAsync(int trayId)
    {
        var tray = await _context.Trays
            .Include(t => t.CableRoutes)
            .FirstOrDefaultAsync(t => t.Id == trayId);

        if (tray == null) return 0;

        var cableCount = tray.CableRoutes.Count();
        return (double)cableCount / tray.Capacity;
    }

    public async Task<IEnumerable<Tray>> GetTraysByFillRatioAsync(int projectId, double minFillRatio, double maxFillRatio)
    {
        var trays = await _context.Trays
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.CableRoutes)
            .ToListAsync();

        return trays.Where(t => {
            var fillRatio = (double)t.CableRoutes.Count() / t.Capacity;
            return fillRatio >= minFillRatio && fillRatio <= maxFillRatio;
        });
    }

    public async Task<bool> IsTrayOverloadedAsync(int trayId)
    {
        var fillRatio = await CalculateTrayFillRatioAsync(trayId);
        return fillRatio > 1.0;
    }

    public async Task<Tray> OptimizeTrayFillAsync(int trayId)
    {
        var tray = await _context.Trays.FindAsync(trayId);
        if (tray == null) throw new ArgumentException("Tray not found");

        // Simple optimization: redistribute cables if overloaded
        if (await IsTrayOverloadedAsync(trayId))
        {
            // Implementation would redistribute to adjacent trays
            // For now, just return the tray
        }

        return tray;
    }
}

public class DrumEstimationService : IDrumEstimationService
{
    private readonly SceapDbContext _context;

    public DrumEstimationService(SceapDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<DrumSpool>> EstimateDrumRequirementsAsync(int projectId)
    {
        var cables = await _context.Cables.Where(c => c.ProjectId == projectId).ToListAsync();

        var drumGroups = cables.GroupBy(c => new { c.Type, c.CrossSection });

        var drums = new List<DrumSpool>();
        foreach (var group in drumGroups)
        {
            var totalLength = group.Sum(c => c.Length);
            drums.Add(new DrumSpool
            {
                CableType = group.Key.Type,
                CrossSection = group.Key.CrossSection,
                Length = totalLength,
                Quantity = 1, // Simplified: one drum per type
                Location = "Warehouse"
            });
        }

        return drums;
    }

    public async Task<DrumSpool> CalculateDrumForCableAsync(Cable cable)
    {
        return new DrumSpool
        {
            CableType = cable.Type,
            CrossSection = cable.CrossSection,
            Length = cable.Length,
            Quantity = 1,
            Location = "Warehouse"
        };
    }

    public async Task<double> CalculateTotalCableLengthAsync(int projectId)
    {
        return await _context.Cables
            .Where(c => c.ProjectId == projectId)
            .SumAsync(c => c.Length);
    }
}

public class TerminationService : ITerminationService
{
    private readonly SceapDbContext _context;

    public TerminationService(SceapDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Termination>> GetTerminationsByCableAsync(int cableId)
    {
        return await _context.Terminations.Where(t => t.CableId == cableId).ToListAsync();
    }

    public async Task<Termination> CreateTerminationAsync(Termination termination)
    {
        _context.Terminations.Add(termination);
        await _context.SaveChangesAsync();
        return termination;
    }

    public async Task<bool> CompleteTerminationAsync(int terminationId)
    {
        var termination = await _context.Terminations.FindAsync(terminationId);
        if (termination == null) return false;

        termination.CompletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<Termination>> GetPendingTerminationsAsync(int projectId)
    {
        return await _context.Terminations
            .Where(t => t.CompletedAt == null && _context.Cables.Any(c => c.Id == t.CableId && c.ProjectId == projectId))
            .ToListAsync();
    }
}