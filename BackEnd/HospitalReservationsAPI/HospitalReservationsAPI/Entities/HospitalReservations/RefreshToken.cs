namespace HospitalReservationsAPI
{
    // Hand-written to match database/002_refresh_tokens.sql — re-run the EF Power
    // Tools scaffold and this file can be deleted once it picks the table up.
    public class RefreshToken
    {
        public Guid RefreshTokenId { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public byte[] TokenHash { get; set; } = Array.Empty<byte>();
        public DateTimeOffset ExpiresAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
        public DateTimeOffset? RevokedAt { get; set; }
        public byte[]? ReplacedByTokenHash { get; set; }
        public string? CreatedByIp { get; set; }

        public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.Now;
    }
}
