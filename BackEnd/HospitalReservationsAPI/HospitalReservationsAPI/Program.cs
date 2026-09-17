using HospitalReservationsAPI;
using HospitalReservationsAPI.Model.SignalR;
using HospitalReservationsAPI.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Real value lives outside source control: `dotnet user-secrets set
// "ConnectionStrings:HospitalReservations" "..."` in dev, an environment
// variable or Key Vault in other environments — never in appsettings.json.
builder.Services.AddDbContext<HospitalReservationsContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("HospitalReservations")));

builder.Services.AddSignalR();
builder.Services.AddSingleton<SignalRConnectionMapping>();
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<AppointmentReminderService>();

// Dev-permissive default policy so the Vite frontend can call the API locally.
// Tighten to an explicit allowlist (per .agent.master.md, Security controls) before deploying.
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins("http://localhost:5173", "http://localhost:5174", "http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

// auth: our own short-lived JWT for API calls (JwtBearer), a transient cookie
// scheme the OIDC handler uses to stash the gov.gr principal mid-handshake
// (External), and the gov.gr OIDC client itself (GovGr) — Authorization Code
// + PKCE, handled entirely by AddOpenIdConnect. See .agent.security.md.
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    // No DefaultChallengeScheme override: it falls back to DefaultScheme
    // (JwtBearer), which just answers 401 for an ordinary [Authorize]
    // failure. GovGr is only ever challenged explicitly, from
    // AuthController.GovGrLogin's Challenge(props, "GovGr") call — if it
    // were the default challenge scheme, every unauthenticated request to
    // ANY [Authorize] endpoint (including the SignalR hub, which the SPA
    // hits before login) would try an OIDC discovery fetch and 500 instead
    // of a clean 401 whenever gov.gr isn't configured/reachable yet.
    options.DefaultSignInScheme = "External";
})
.AddJwtBearer(options =>
{
    var jwtSection = builder.Configuration.GetSection("JwtSettings");
    var signingKey = builder.Configuration["JwtSettings:SigningKey"];

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtSection["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSection["Audience"],
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = string.IsNullOrEmpty(signingKey)
            ? null
            : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30)
    };
})
.AddCookie("External", options =>
{
    options.Cookie.Name = "hr_external";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; // dev runs the API over plain HTTP (see launchSettings.json)
    options.Cookie.SameSite = SameSiteMode.Lax; // gov.gr's redirect back is a top-level GET, which Lax still allows
    options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
})
.AddOpenIdConnect("GovGr", options =>
{
    var govgr = builder.Configuration.GetSection("GovGr");
    options.Authority = govgr["Authority"];
    options.ClientId = govgr["ClientId"];
    options.ClientSecret = govgr["ClientSecret"];
    options.ResponseType = OpenIdConnectResponseType.Code;
    options.UsePkce = true;
    options.CallbackPath = govgr["CallbackPath"] ?? "/signin-govgr";
    options.SignInScheme = "External";
    options.SaveTokens = false; // we mint our own app JWT; gov.gr's tokens don't need to persist
    options.GetClaimsFromUserInfoEndpoint = true;
    options.Scope.Clear();
    options.Scope.Add("openid");
    options.Scope.Add("profile");
    options.Scope.Add("email");
});

builder.Services.AddAuthorization();

// Fixed-window limiter on the auth endpoints only (login/mock-login/refresh) —
// brute-force / credential-stuffing protection per .agent.security.md.
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
// Path matches the frontend's existing convention (Services/signalRService.ts,
// VITE_SIGNALR_API_LOCAL_URL) — not a free choice.
app.MapHub<SignalRHub>("/SignalRHub");

app.Run();
