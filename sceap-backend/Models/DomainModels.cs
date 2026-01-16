namespace SCEAP.Models;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string Status { get; set; } = "Active";

    // Navigation properties
    public ICollection<Cable> Cables { get; set; } = new List<Cable>();
    public ICollection<Tray> Trays { get; set; } = new List<Tray>();
    public ICollection<CableRoute> CableRoutes { get; set; } = new List<CableRoute>();
    public ICollection<Report> Reports { get; set; } = new List<Report>();
    public ICollection<Raceway> Raceways { get; set; } = new List<Raceway>();
}

public class Cable
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public double CrossSection { get; set; } // mm²
    public double Length { get; set; } // meters
    public double Current { get; set; } // Amperes
    public double Voltage { get; set; } // Volts
    public string Standard { get; set; } = "IEC 60287";
    public string Status { get; set; } = "Designed";

    // Navigation properties
    public Project? Project { get; set; }
    public ICollection<CableRoute> CableRoutes { get; set; } = new List<CableRoute>();
    public ICollection<Termination> Terminations { get; set; } = new List<Termination>();
}

public class Tray
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public double Length { get; set; } // meters
    public double Width { get; set; } // meters
    public double FillRatio { get; set; } // 0-1
    public int Capacity { get; set; } // number of cables

    // Navigation properties
    public Project? Project { get; set; }
    public ICollection<CableRoute> CableRoutes { get; set; } = new List<CableRoute>();
}

public class CableRoute
{
    public int Id { get; set; }
    public int CableId { get; set; }
    public int TrayId { get; set; }
    public int Sequence { get; set; }
    public double Distance { get; set; } // meters

    // Navigation properties
    public Cable? Cable { get; set; }
    public Tray? Tray { get; set; }
}

public class Termination
{
    public int Id { get; set; }
    public int CableId { get; set; }
    public string FromEquipment { get; set; } = string.Empty;
    public string ToEquipment { get; set; } = string.Empty;
    public string TerminationType { get; set; } = string.Empty;
    public DateTime? CompletedAt { get; set; }

    // Navigation properties
    public Cable? Cable { get; set; }
}

public class DrumSpool
{
    public int Id { get; set; }
    public string CableType { get; set; } = string.Empty;
    public double CrossSection { get; set; } // mm²
    public double Length { get; set; } // meters
    public int Quantity { get; set; }
    public string Location { get; set; } = string.Empty;
}

public class Raceway
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public double Length { get; set; } // meters
    public double FillRatio { get; set; }

    // Navigation properties
    public Project? Project { get; set; }
}

public class Report
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Project? Project { get; set; }
}