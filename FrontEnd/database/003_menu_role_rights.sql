/* ============================================================================
   Role-driven dynamic menu.

   LoginApplicationForms already exists (empty) and stays as-is — it's the
   page/menu tree. LoginApplicationFormRights currently grants per row in the
   old AMA-era LoginAdditionalRights ("Admin", "Supervisor" — not this app's
   roles). This migration repoints grants at dbo.Roles instead, and drops the
   now-unused LoginAdditionalRights table (nothing else references it).

   Run after 002_refresh_tokens.sql.
   ============================================================================ */

IF OBJECT_ID('FK_LoginApplicationFormRights_LoginAdditionalRights', 'F') IS NOT NULL
    ALTER TABLE dbo.LoginApplicationFormRights DROP CONSTRAINT FK_LoginApplicationFormRights_LoginAdditionalRights;
GO

ALTER TABLE dbo.LoginApplicationFormRights DROP COLUMN AdditionalRightId;
GO

DROP TABLE IF EXISTS dbo.LoginAdditionalRights;
GO

ALTER TABLE dbo.LoginApplicationFormRights ADD RoleId INT NOT NULL;
GO

ALTER TABLE dbo.LoginApplicationFormRights
    ADD CONSTRAINT FK_LoginApplicationFormRights_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId);
GO

-- A role is either granted a given form or not — no duplicate grants.
ALTER TABLE dbo.LoginApplicationFormRights
    ADD CONSTRAINT UQ_LoginApplicationFormRights_Form_Role UNIQUE (ApplicationFormId, RoleId);
GO
