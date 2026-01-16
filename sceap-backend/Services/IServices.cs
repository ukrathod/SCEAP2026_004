using SCEAP.Models;

namespace SCEAP.Services;

public interface IProjectService
{
    Task<IEnumerable<Project>> GetAllProjectsAsync();
    Task<Project?> GetProjectByIdAsync(int id);
    Task<Project> CreateProjectAsync(Project project);
    Task<Project?> UpdateProjectAsync(int id, Project project);
    Task<bool> DeleteProjectAsync(int id);
}

public interface ICableSizingService
{
    Task<Cable> CalculateCableSizeAsync(Cable cable);
    Task<IEnumerable<Cable>> CalculateMultipleCablesAsync(IEnumerable<Cable> cables);
    Task<double> CalculateFLC(double power, double voltage, double powerFactor = 0.85);
    Task<double> CalculateVoltageDrop(double current, double length, double resistance, double reactance, double voltage);
}

public interface ICableRoutingService
{
    Task<IEnumerable<CableRoute>> CalculateOptimalRouteAsync(int cableId, int startTrayId, int endTrayId);
    Task<IEnumerable<Tray>> GetAvailableTraysAsync(int projectId);
    Task<double> CalculateRouteLengthAsync(IEnumerable<CableRoute> routes);
}

public interface ITrayFillService
{
    Task<double> CalculateTrayFillRatioAsync(int trayId);
    Task<IEnumerable<Tray>> GetTraysByFillRatioAsync(int projectId, double minFillRatio, double maxFillRatio);
    Task<bool> IsTrayOverloadedAsync(int trayId);
    Task<Tray> OptimizeTrayFillAsync(int trayId);
}

public interface IDrumEstimationService
{
    Task<IEnumerable<DrumSpool>> EstimateDrumRequirementsAsync(int projectId);
    Task<DrumSpool> CalculateDrumForCableAsync(Cable cable);
    Task<double> CalculateTotalCableLengthAsync(int projectId);
}

public interface ITerminationService
{
    Task<IEnumerable<Termination>> GetTerminationsByCableAsync(int cableId);
    Task<Termination> CreateTerminationAsync(Termination termination);
    Task<bool> CompleteTerminationAsync(int terminationId);
    Task<IEnumerable<Termination>> GetPendingTerminationsAsync(int projectId);
}