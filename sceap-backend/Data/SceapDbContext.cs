using Microsoft.EntityFrameworkCore;
using SCEAP.Models;

namespace SCEAP.Data;

public class SceapDbContext : DbContext
{
    public SceapDbContext(DbContextOptions<SceapDbContext> options)
        : base(options)
    {
    }

    public DbSet<Project> Projects { get; set; } = null!;
    public DbSet<Cable> Cables { get; set; } = null!;
    public DbSet<Tray> Trays { get; set; } = null!;
    public DbSet<CableRoute> CableRoutes { get; set; } = null!;
    public DbSet<Termination> Terminations { get; set; } = null!;
    public DbSet<DrumSpool> DrumSpools { get; set; } = null!;
    public DbSet<Raceway> Raceways { get; set; } = null!;
    public DbSet<Report> Reports { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Project relationships
        modelBuilder.Entity<Project>()
            .HasMany(p => p.Cables)
            .WithOne(c => c.Project)
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Project>()
            .HasMany(p => p.Trays)
            .WithOne(t => t.Project)
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Project>()
            .HasMany(p => p.CableRoutes)
            .WithOne()
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Project>()
            .HasMany(p => p.Reports)
            .WithOne(r => r.Project)
            .HasForeignKey(r => r.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cable relationships
        modelBuilder.Entity<Cable>()
            .HasMany(c => c.CableRoutes)
            .WithOne(cr => cr.Cable)
            .HasForeignKey(cr => cr.CableId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Cable>()
            .HasMany(c => c.Terminations)
            .WithOne(t => t.Cable)
            .HasForeignKey(t => t.CableId)
            .OnDelete(DeleteBehavior.Cascade);

        // Tray relationships
        modelBuilder.Entity<Tray>()
            .HasMany(t => t.CableRoutes)
            .WithOne(cr => cr.Tray)
            .HasForeignKey(cr => cr.TrayId)
            .OnDelete(DeleteBehavior.Cascade);

        // Raceway relationships
        modelBuilder.Entity<Raceway>()
            .HasOne(r => r.Project)
            .WithMany(p => p.Raceways)
            .HasForeignKey(r => r.ProjectId);

        // Indexes for performance
        modelBuilder.Entity<Cable>()
            .HasIndex(c => c.ProjectId);

        modelBuilder.Entity<Tray>()
            .HasIndex(t => t.ProjectId);

        modelBuilder.Entity<CableRoute>()
            .HasIndex(cr => new { cr.CableId, cr.TrayId });

        modelBuilder.Entity<Termination>()
            .HasIndex(t => t.CableId);
    }
}