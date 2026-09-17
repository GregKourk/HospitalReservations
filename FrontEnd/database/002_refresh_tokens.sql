/* ============================================================================
   Incremental migration: refresh token storage for the Gov.gr OIDC / JWT auth
   flow (.agent.security.md — refresh token rotation). Run after hospital-schema.sql.
   ============================================================================ */

CREATE TABLE dbo.RefreshTokens (
    RefreshTokenId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserId                  UNIQUEIDENTIFIER    NOT NULL,
    TokenHash               VARBINARY(32)       NOT NULL,   -- SHA-256 of the raw token; the raw value never touches the DB
    ExpiresAt                DATETIMEOFFSET(3)   NOT NULL,
    CreatedAt                DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    RevokedAt                DATETIMEOFFSET(3)   NULL,
    ReplacedByTokenHash      VARBINARY(32)       NULL,       -- rotation chain: points at the token that replaced this one
    CreatedByIp              NVARCHAR(45)        NULL,
    CONSTRAINT PK_RefreshTokens PRIMARY KEY CLUSTERED (RefreshTokenId),
    CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);
GO
CREATE UNIQUE INDEX UQ_RefreshTokens_TokenHash ON dbo.RefreshTokens(TokenHash);
CREATE INDEX IX_RefreshTokens_UserId ON dbo.RefreshTokens(UserId);
GO
