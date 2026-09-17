using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace HospitalReservationsAPI.Controllers
{
    // Gov.gr OIDC (Authorization Code + PKCE, handled by the ASP.NET Core OIDC
    // middleware — see Program.cs) plus a dev-only mock login so every role can
    // be exercised in the UI before real Gov.gr credentials exist.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    public class AuthController : BaseApiController
    {
        private const string RefreshCookieName = "hr_refresh";

        private readonly HospitalReservationsContext _db;
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;
        private readonly ILogger<AuthController> _logger;
        private readonly string _frontendBaseUrl;
        private readonly bool _mockAuthEnabled;

        public AuthController(
            HospitalReservationsContext db,
            IConfiguration configuration,
            IMemoryCache cache,
            ILogger<AuthController> logger)
        {
            _db = db;
            _configuration = configuration;
            _cache = cache;
            _logger = logger;
            _frontendBaseUrl = configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
            _mockAuthEnabled = configuration.GetValue<bool>("MockAuth:Enabled");
        }

        #region Gov.gr OIDC

        [HttpGet("GovGr/Login")]
        [AllowAnonymous]
        public IActionResult GovGrLogin()
        {
            var props = new AuthenticationProperties
            {
                RedirectUri = Url.Action(nameof(GovGrComplete))
            };
            return Challenge(props, "GovGr");
        }

        [HttpGet("GovGr/Complete")]
        [AllowAnonymous]
        public async Task<IActionResult> GovGrComplete()
        {
            var externalResult = await HttpContext.AuthenticateAsync("External");
            if (!externalResult.Succeeded || externalResult.Principal is null)
            {
                await AuditLogger.LogAsync(_db, HttpContext, "LoginFailed", "Auth", null, after: new { reason = "external_auth_failed" });
                return Redirect($"{_frontendBaseUrl}/login?error=govgr_failed");
            }

            var principal = externalResult.Principal;

            // TODO: confirm the exact claim names gov.gr Sign-In returns for the
            // registered scopes (AMKA/ΑΦΜ etc. are scope-dependent) once real
            // client credentials exist, and adjust this mapping accordingly.
            var subject = principal.FindFirst("sub")?.Value ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = principal.FindFirst(ClaimTypes.Email)?.Value ?? principal.FindFirst("email")?.Value;
            var givenName = principal.FindFirst(ClaimTypes.GivenName)?.Value ?? principal.FindFirst("given_name")?.Value;
            var familyName = principal.FindFirst(ClaimTypes.Surname)?.Value ?? principal.FindFirst("family_name")?.Value;
            var name = principal.FindFirst(ClaimTypes.Name)?.Value ?? principal.FindFirst("name")?.Value
                ?? $"{givenName} {familyName}".Trim();
            if (string.IsNullOrWhiteSpace(name)) name = email ?? "Gov.gr User";

            await HttpContext.SignOutAsync("External");

            if (string.IsNullOrEmpty(subject))
            {
                await AuditLogger.LogAsync(_db, HttpContext, "LoginFailed", "Auth", null, after: new { reason = "missing_subject_claim" });
                return Redirect($"{_frontendBaseUrl}/login?error=govgr_failed");
            }

            var user = await _db.Users.FirstOrDefaultAsync(u => u.ExternalProvider == "GovGr" && u.ExternalSubjectId == subject);
            var isNewUser = user is null;

            if (user is null)
            {
                user = new User
                {
                    Email = email ?? $"{subject}@govgr.local",
                    FullName = name,
                    ExternalProvider = "GovGr",
                    ExternalSubjectId = subject
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                // Self-service gov.gr sign-in only ever grants Patient. Staff
                // roles (Doctor/Reception/ClinicManager/Admin/SuperUser) are
                // assigned afterwards by an admin — never inferred from an
                // external claim (least privilege / .agent.master.md).
                var patientRoleId = await _db.Roles.Where(r => r.Name == "Patient").Select(r => r.RoleId).FirstAsync();
                _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = patientRoleId });

                _db.Patients.Add(new Patient
                {
                    UserId = user.UserId,
                    FirstName = givenName ?? name,
                    LastName = familyName ?? string.Empty,
                    // TODO: gov.gr should supply a real date-of-birth claim for the
                    // registered scope — this placeholder needs a proper reception
                    // follow-up prompt until that mapping is confirmed.
                    DateOfBirth = DateTime.UtcNow.Date
                });

                await _db.SaveChangesAsync();
            }
            else if (!user.IsActive || user.IsDeleted)
            {
                await AuditLogger.LogAsync(_db, HttpContext, "LoginFailed", "Auth", user.UserId.ToString(), after: new { reason = "account_disabled" });
                return Redirect($"{_frontendBaseUrl}/login?error=account_disabled");
            }

            var exchangeCode = Guid.NewGuid().ToString("N");
            _cache.Set(CacheKey(exchangeCode), user.UserId, TimeSpan.FromSeconds(30));

            await AuditLogger.LogAsync(_db, HttpContext, isNewUser ? "LoginProvisioned" : "Login", "User", user.UserId.ToString());

            return Redirect($"{_frontendBaseUrl}/auth/callback?code={exchangeCode}");
        }

        // The SPA calls this immediately after the gov.gr redirect lands on
        // /auth/callback — keeps the access token out of the browser's address
        // bar/history (the exchange code is single-use and expires in 30s).
        [HttpPost("Token/Exchange")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<TokenResponse>> ExchangeCode(TokenExchangeRequest request)
        {
            if (string.IsNullOrEmpty(request.Code) || !_cache.TryGetValue(CacheKey(request.Code), out Guid userId))
                return BadRequest("Invalid or expired code.");

            _cache.Remove(CacheKey(request.Code));

            var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId && !u.IsDeleted && u.IsActive);
            if (user is null) return Unauthorized();

            return Ok(await IssueTokensAsync(user));
        }

        private static string CacheKey(string code) => $"authcode:{code}";

        #endregion

        #region Mock login (dev only)

        [HttpGet("Mock/Roles")]
        [AllowAnonymous]
        public async Task<ActionResult<List<string>>> MockRoles()
        {
            if (!_mockAuthEnabled) return NotFound();
            return Ok(await _db.Roles.OrderBy(r => r.Name).Select(r => r.Name).ToListAsync());
        }

        [HttpPost("Mock/Login")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<TokenResponse>> MockLogin(MockLoginRequest request)
        {
            if (!_mockAuthEnabled) return NotFound();

            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == request.Role);
            if (role is null)
                return BadRequest($"Unknown role '{request.Role}'.");

            // One deterministic demo account per role — reusing it across mock
            // logins keeps whatever test data you attach to it (appointments,
            // patients, etc.) stable between sessions.
            var email = $"demo.{request.Role.ToLowerInvariant()}@mock.local";
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user is null)
            {
                user = new User
                {
                    Email = email,
                    FullName = $"Demo {request.Role}",
                    ExternalProvider = "Mock",
                    ExternalSubjectId = email
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId });

                if (request.Role == "Patient")
                {
                    _db.Patients.Add(new Patient
                    {
                        UserId = user.UserId,
                        FirstName = "Demo",
                        LastName = "Patient",
                        DateOfBirth = new DateTime(1990, 1, 1)
                    });
                }
                // A demo Doctor also needs a Clinic/Department to attach to —
                // seed those first, then create the Doctor row from the admin
                // screen. Mock login only grants the JWT role claim, not a
                // ready-to-use Doctor/Clinic record.

                await _db.SaveChangesAsync();
            }

            await AuditLogger.LogAsync(_db, HttpContext, "MockLogin", "User", user.UserId.ToString(), after: new { request.Role });

            return Ok(await IssueTokensAsync(user));
        }

        #endregion

        #region Session

        [HttpPost("Refresh")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<TokenResponse>> Refresh()
        {
            if (!Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) || string.IsNullOrEmpty(rawToken))
                return Unauthorized();

            var hash = HashToken(rawToken);
            var stored = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
            if (stored is null || !stored.IsActive)
            {
                Response.Cookies.Delete(RefreshCookieName);
                return Unauthorized();
            }

            var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == stored.UserId && !u.IsDeleted && u.IsActive);
            if (user is null) return Unauthorized();

            stored.RevokedAt = DateTimeOffset.Now;
            return Ok(await IssueTokensAsync(user, stored));
        }

        [HttpPost("Logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            if (Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) && !string.IsNullOrEmpty(rawToken))
            {
                var hash = HashToken(rawToken);
                var stored = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
                if (stored is not null)
                {
                    stored.RevokedAt = DateTimeOffset.Now;
                    await _db.SaveChangesAsync();
                }
            }

            Response.Cookies.Delete(RefreshCookieName);
            await AuditLogger.LogAsync(_db, HttpContext, "Logout", "User", User.GetUserId()?.ToString());

            return NoContent();
        }

        [HttpGet("Me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var userId = User.GetUserId();
            if (userId is null) return Unauthorized();

            // AMKA lives on whichever record (Patient or Doctor) this login is
            // tied to — most staff roles (Admin/SuperUser/ClinicManager/
            // Reception) have neither, so this is null for them.
            var amka = await _db.Patients.Where(p => p.UserId == userId && !p.IsDeleted).Select(p => p.Amka).FirstOrDefaultAsync()
                ?? await _db.Doctors.Where(d => d.UserId == userId && !d.IsDeleted).Select(d => d.Amka).FirstOrDefaultAsync();

            return Ok(new
            {
                UserId = userId,
                Email = User.FindFirst(ClaimTypes.Email)?.Value,
                FullName = User.FindFirst(ClaimTypes.Name)?.Value,
                Amka = amka,
                Roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value)
            });
        }

        #endregion

        #region Token issuance

        private async Task<TokenResponse> IssueTokensAsync(User user, RefreshToken? replacing = null)
        {
            var roles = await _db.UserRoles.Where(ur => ur.UserId == user.UserId)
                .Join(_db.Roles, ur => ur.RoleId, r => r.RoleId, (ur, r) => r.Name)
                .ToListAsync();

            var rootPages = await MenuBuilder.BuildRootPagesAsync(_db, roles);

            var (accessToken, expiresAt) = GenerateAccessToken(user, roles);
            var (rawRefresh, refreshHash, refreshExpiry) = GenerateRefreshToken();

            if (replacing is not null)
                replacing.ReplacedByTokenHash = refreshHash;

            _db.RefreshTokens.Add(new RefreshToken
            {
                UserId = user.UserId,
                TokenHash = refreshHash,
                ExpiresAt = refreshExpiry,
                CreatedByIp = HttpContext.Connection.RemoteIpAddress?.ToString()
            });
            await _db.SaveChangesAsync();

            SetRefreshCookie(rawRefresh, refreshExpiry);

            return new TokenResponse
            {
                AccessToken = accessToken,
                AccessTokenExpiresAt = expiresAt,
                UserId = user.UserId,
                Email = user.Email,
                FullName = user.FullName,
                Roles = roles,
                RootPages = rootPages
            };
        }

        private (string token, DateTimeOffset expiresAt) GenerateAccessToken(User user, List<string> roles)
        {
            var minutes = _configuration.GetValue<int?>("JwtSettings:AccessTokenMinutes") ?? 15;
            var expiresAt = DateTimeOffset.Now.AddMinutes(minutes);
            var secret = _configuration["JwtSettings:SigningKey"]
                ?? throw new InvalidOperationException("JwtSettings:SigningKey is not configured (user-secrets/environment/Key Vault).");

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Name, user.FullName)
            };
            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var token = new JwtSecurityToken(
                issuer: _configuration["JwtSettings:Issuer"],
                audience: _configuration["JwtSettings:Audience"],
                claims: claims,
                expires: expiresAt.UtcDateTime,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

            return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
        }

        private (string raw, byte[] hash, DateTimeOffset expiresAt) GenerateRefreshToken()
        {
            var days = _configuration.GetValue<int?>("JwtSettings:RefreshTokenDays") ?? 14;
            var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            return (raw, HashToken(raw), DateTimeOffset.Now.AddDays(days));
        }

        private static byte[] HashToken(string raw) => SHA256.HashData(Encoding.UTF8.GetBytes(raw));

        private void SetRefreshCookie(string rawToken, DateTimeOffset expiresAt)
        {
            Response.Cookies.Append(RefreshCookieName, rawToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps, // mirrors CookieSecurePolicy.SameAsRequest — true once the API runs behind HTTPS
                SameSite = SameSiteMode.Lax, // SPA and API are different origins but same site (localhost, different ports) — Lax still sends it
                Expires = expiresAt,
                Path = "/Auth"
            });
        }

        #endregion
    }
}
