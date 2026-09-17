using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI
{
    // Extends the auto-generated context through its own extension points
    // (OnModelCreatingPartial) so nothing here gets clobbered by a re-scaffold.
    public partial class HospitalReservationsContext
    {
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
        public DbSet<Holiday> Holidays => Set<Holiday>();
        public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();
        public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
        public DbSet<AppointmentWaitlistEntry> AppointmentWaitlistEntries => Set<AppointmentWaitlistEntry>();

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<RefreshToken>(builder =>
            {
                builder.ToTable("RefreshTokens", "dbo");
                builder.HasKey(x => x.RefreshTokenId);
                builder.Property(x => x.TokenHash).HasMaxLength(32).IsRequired();
                builder.Property(x => x.ReplacedByTokenHash).HasMaxLength(32);
                builder.Property(x => x.CreatedByIp).HasMaxLength(45);
                builder.HasIndex(x => x.TokenHash).IsUnique();
                builder.HasIndex(x => x.UserId);
                builder.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
            });

            modelBuilder.Entity<SystemSetting>(builder =>
            {
                builder.ToTable("SystemSettings", "dbo");
                builder.HasKey(x => x.SettingKey);
                builder.Property(x => x.SettingKey).HasMaxLength(100).IsRequired();
                builder.Property(x => x.Description).HasMaxLength(300);
            });

            modelBuilder.Entity<Holiday>(builder =>
            {
                builder.ToTable("Holidays", "dbo");
                builder.HasKey(x => x.HolidayId);
                builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
                builder.HasIndex(x => x.HolidayDate).IsUnique();
            });

            modelBuilder.Entity<NotificationTemplate>(builder =>
            {
                builder.ToTable("NotificationTemplates", "dbo");
                builder.HasKey(x => x.TemplateId);
                builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
                builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
                builder.Property(x => x.Subject).HasMaxLength(300).IsRequired();
                builder.HasIndex(x => x.Code).IsUnique();
            });

            modelBuilder.Entity<LeaveRequest>(builder =>
            {
                builder.ToTable("LeaveRequests", "dbo");
                builder.HasKey(x => x.LeaveRequestId);
                builder.Property(x => x.Status).HasMaxLength(20).IsRequired();
                builder.Property(x => x.Reason).HasMaxLength(300);
                builder.Property(x => x.ReviewNote).HasMaxLength(300);
                builder.HasIndex(x => x.DoctorId);
                builder.HasOne(x => x.Doctor).WithMany().HasForeignKey(x => x.DoctorId);
            });

            modelBuilder.Entity<AppointmentWaitlistEntry>(builder =>
            {
                builder.ToTable("AppointmentWaitlist", "dbo");
                builder.HasKey(x => x.WaitlistId);
                builder.Property(x => x.Status).HasMaxLength(20).IsRequired();
                builder.Property(x => x.Reason).HasMaxLength(300);
                builder.HasIndex(x => new { x.DoctorId, x.PreferredDate, x.Status });
                builder.HasIndex(x => x.PatientId);
                builder.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId);
                builder.HasOne(x => x.Clinic).WithMany().HasForeignKey(x => x.ClinicId);
                builder.HasOne(x => x.Department).WithMany().HasForeignKey(x => x.DepartmentId);
                builder.HasOne(x => x.Doctor).WithMany().HasForeignKey(x => x.DoctorId);
            });
        }
    }
}
