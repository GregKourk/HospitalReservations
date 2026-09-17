using HospitalReservationsAPI.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HospitalReservationsAPI.Controllers
{    
    [Route("[controller]")]
    [ApiController]
    [EnableCors]
    [Authorize]
    public class BaseApiController : ControllerBase
    {
        protected String ControllerBaseSource => ControllerContext.ActionDescriptor.ControllerName.Replace("Controller", "");
        protected int UserId => int.Parse(FindClaim(ClaimTypes.NameIdentifier));

        protected string FindClaim(string claimType)
        {
            var claimsIdentity = HttpContext.User.Identity as ClaimsIdentity;
            var claim = claimsIdentity.FindFirst(claimType);
            if (claim == null)
            {
                return null;
            }
            return claim.Value;
        }

        // Delegates to AppUser's implicit operator (AppUser.cs) — the single source of
        // truth for claim-name -> field mapping, so this and the JWT generation in
        // AuthController can't drift apart again like they previously did.
        protected AppUser GetAppUser()
        {
            var claimsIdentity = HttpContext.User.Identity as ClaimsIdentity;
            return claimsIdentity;
        }

        [HttpOptions("{**path}")]
        [AllowAnonymous]
        public IActionResult PreflightRoute()
        {
            return NoContent();
        }
    }
}
