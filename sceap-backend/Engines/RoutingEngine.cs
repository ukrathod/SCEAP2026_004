using SCEAP.Models;

namespace SCEAP.Engines;

public class RoutingEngine
{
    public IEnumerable<CableRoute> CalculateOptimalRoute(Cable cable, IEnumerable<Tray> availableTrays, int startTrayId, int endTrayId)
    {
        var trays = availableTrays.ToList();
        var startTray = trays.FirstOrDefault(t => t.Id == startTrayId);
        var endTray = trays.FirstOrDefault(t => t.Id == endTrayId);

        if (startTray == null || endTray == null)
            throw new ArgumentException("Start or end tray not found");

        // Simple Dijkstra's algorithm implementation
        var distances = new Dictionary<int, double>();
        var previous = new Dictionary<int, int>();
        var unvisited = new HashSet<int>();

        // Initialize
        foreach (var tray in trays)
        {
            distances[tray.Id] = double.MaxValue;
            unvisited.Add(tray.Id);
        }
        distances[startTrayId] = 0;

        while (unvisited.Count > 0)
        {
            // Find tray with minimum distance
            var current = unvisited.OrderBy(t => distances[t]).First();
            unvisited.Remove(current);

            if (current == endTrayId) break;

            var currentTray = trays.First(t => t.Id == current);

            // Check neighbors (simplified: assume all trays are connected)
            foreach (var neighbor in trays.Where(t => t.Id != current))
            {
                var distance = CalculateDistance(currentTray, neighbor);
                var alt = distances[current] + distance;

                if (alt < distances[neighbor.Id])
                {
                    distances[neighbor.Id] = alt;
                    previous[neighbor.Id] = current;
                }
            }
        }

        // Reconstruct path
        var path = new List<int>();
        var currentNode = endTrayId;
        while (previous.ContainsKey(currentNode))
        {
            path.Insert(0, currentNode);
            currentNode = previous[currentNode];
        }
        path.Insert(0, startTrayId);

        // Convert to CableRoute objects
        var routes = new List<CableRoute>();
        for (int i = 0; i < path.Count - 1; i++)
        {
            var fromTray = trays.First(t => t.Id == path[i]);
            var toTray = trays.First(t => t.Id == path[i + 1]);

            routes.Add(new CableRoute
            {
                CableId = cable.Id,
                TrayId = toTray.Id,
                Sequence = i + 1,
                Distance = CalculateDistance(fromTray, toTray)
            });
        }

        return routes;
    }

    public IEnumerable<CableRoute> CalculateLeastFillRoute(Cable cable, IEnumerable<Tray> availableTrays, int startTrayId, int endTrayId)
    {
        var trays = availableTrays.ToList();
        var startTray = trays.FirstOrDefault(t => t.Id == startTrayId);
        var endTray = trays.FirstOrDefault(t => t.Id == endTrayId);

        if (startTray == null || endTray == null)
            throw new ArgumentException("Start or end tray not found");

        // Least-fill algorithm: prefer trays with lower fill ratio
        var path = new List<Tray> { startTray };
        var currentTray = startTray;

        while (currentTray.Id != endTrayId)
        {
            var neighbors = GetNeighborTrays(currentTray, trays)
                .OrderBy(t => t.FillRatio) // Prefer less filled trays
                .ToList();

            if (!neighbors.Any()) break;

            currentTray = neighbors.First();
            path.Add(currentTray);
        }

        // Convert to CableRoute objects
        var routes = new List<CableRoute>();
        for (int i = 1; i < path.Count; i++)
        {
            routes.Add(new CableRoute
            {
                CableId = cable.Id,
                TrayId = path[i].Id,
                Sequence = i,
                Distance = CalculateDistance(path[i-1], path[i])
            });
        }

        return routes;
    }

    private double CalculateDistance(Tray tray1, Tray tray2)
    {
        // Simplified distance calculation
        // In a real implementation, this would use actual coordinates
        return Math.Sqrt(Math.Pow(tray1.Length - tray2.Length, 2) + Math.Pow(tray1.Width - tray2.Width, 2));
    }

    private IEnumerable<Tray> GetNeighborTrays(Tray currentTray, IEnumerable<Tray> allTrays)
    {
        // Simplified: assume all trays are neighbors
        // In a real implementation, this would check adjacency
        return allTrays.Where(t => t.Id != currentTray.Id);
    }
}