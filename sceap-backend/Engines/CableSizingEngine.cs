using SCEAP.Models;

namespace SCEAP.Engines;

public class CableSizingEngine
{
    // Cable catalog with standard sizes and current carrying capacities
    private readonly Dictionary<double, double> _cableCatalog = new()
    {
        { 1.5, 20.0 }, { 2.5, 27.0 }, { 4.0, 36.0 }, { 6.0, 46.0 },
        { 10.0, 63.0 }, { 16.0, 85.0 }, { 25.0, 115.0 }, { 35.0, 145.0 },
        { 50.0, 180.0 }, { 70.0, 225.0 }, { 95.0, 275.0 }, { 120.0, 320.0 },
        { 150.0, 370.0 }, { 185.0, 430.0 }, { 240.0, 530.0 }, { 300.0, 640.0 },
        { 400.0, 780.0 }, { 500.0, 920.0 }, { 630.0, 1100.0 }
    };

    // Copper resistance per km at 20°C (Ω/km)
    private readonly Dictionary<double, double> _resistanceTable = new()
    {
        { 1.5, 12.1 }, { 2.5, 7.41 }, { 4.0, 4.61 }, { 6.0, 3.08 },
        { 10.0, 1.83 }, { 16.0, 1.15 }, { 25.0, 0.727 }, { 35.0, 0.524 },
        { 50.0, 0.387 }, { 70.0, 0.268 }, { 95.0, 0.193 }, { 120.0, 0.153 },
        { 150.0, 0.124 }, { 185.0, 0.0991 }, { 240.0, 0.0754 }, { 300.0, 0.0601 },
        { 400.0, 0.0470 }, { 500.0, 0.0366 }, { 630.0, 0.0283 }
    };

    // Reactance per km (Ω/km) - approximate values
    private readonly Dictionary<double, double> _reactanceTable = new()
    {
        { 1.5, 0.08 }, { 2.5, 0.08 }, { 4.0, 0.07 }, { 6.0, 0.07 },
        { 10.0, 0.06 }, { 16.0, 0.06 }, { 25.0, 0.05 }, { 35.0, 0.05 },
        { 50.0, 0.04 }, { 70.0, 0.04 }, { 95.0, 0.04 }, { 120.0, 0.03 },
        { 150.0, 0.03 }, { 185.0, 0.03 }, { 240.0, 0.03 }, { 300.0, 0.02 },
        { 400.0, 0.02 }, { 500.0, 0.02 }, { 630.0, 0.02 }
    };

    public Cable CalculateCableSize(Cable cable)
    {
        // Phase 1: Current Carrying Capacity
        var flc = CalculateFLC(cable.Current, cable.Voltage);
        var deratingFactor = GetDeratingFactor(cable);
        var requiredCurrent = flc / deratingFactor;

        var suitableSize = _cableCatalog
            .Where(c => c.Value >= requiredCurrent)
            .OrderBy(c => c.Key)
            .FirstOrDefault();

        if (suitableSize.Key == 0) return cable; // No suitable size found

        cable.CrossSection = suitableSize.Key;

        // Phase 2: Voltage Drop Analysis
        var resistance = _resistanceTable[cable.CrossSection] * cable.Length / 1000;
        var reactance = _reactanceTable[cable.CrossSection] * cable.Length / 1000;
        var voltageDrop = CalculateVoltageDrop(requiredCurrent, cable.Length, resistance, reactance, cable.Voltage);

        // If voltage drop exceeds 5%, select next larger size
        if (voltageDrop > 0.05)
        {
            var nextSize = _cableCatalog
                .Where(c => c.Key > cable.CrossSection)
                .OrderBy(c => c.Key)
                .FirstOrDefault();

            if (nextSize.Key != 0)
            {
                cable.CrossSection = nextSize.Key;
            }
        }

        // Phase 3: Short Circuit Compliance (simplified)
        // In a real implementation, this would check against short circuit current ratings

        cable.Status = "Calculated";
        return cable;
    }

    public double CalculateFLC(double power, double voltage, double powerFactor = 0.85)
    {
        // FLC = P / (√3 × V × PF × η)
        // Assuming η = 0.95 for motor efficiency
        return power / (Math.Sqrt(3) * voltage * powerFactor * 0.95);
    }

    public double CalculateVoltageDrop(double current, double length, double resistance, double reactance, double voltage)
    {
        // ΔV = I × L × (R × cosφ + X × sinφ) / 1000
        // Assuming cosφ = 0.85, sinφ = 0.526
        var voltageDrop = current * length * (resistance * 0.85 + reactance * 0.526) / 1000;
        return voltageDrop / voltage; // Return as percentage
    }

    private double GetDeratingFactor(Cable cable)
    {
        // Simplified derating factors
        double factor = 1.0;

        // Ambient temperature derating (assuming 40°C ambient)
        if (cable.Type.Contains("XLPE")) factor *= 0.87;

        // Grouping factor (assuming single cable)
        factor *= 1.0;

        // Installation method factor
        factor *= 0.9;

        return factor;
    }
}