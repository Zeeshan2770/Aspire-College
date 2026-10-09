// ============================================================
// ASPIRE GROUP OF COLLEGES — MANAGEMENT PORTAL
// Supabase Edge Function: create-user
//
// Creates:
// - SUB_SUPER_ADMIN accounts
// - CR accounts
//
// SECURITY RULES:
//
// MAIN_SUPER_ADMIN:
//   - Can create SUB_SUPER_ADMIN
//   - Can create CR
//
// SUB_SUPER_ADMIN:
//   - Can create CR only if they have user-management permission
//   - Cannot create another SUB_SUPER_ADMIN
//
// CR:
//   - Cannot create any users
//
// IMPORTANT:
// This function runs server-side.
// SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed to the browser.
// ============================================================

import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2.45.4';

// ------------------------------------------------------------
// SUPABASE ENVIRONMENT VARIABLES
//
// These are automatically available inside Supabase Edge Functions.
// DO NOT manually run:
// supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
// ------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    'Required Supabase environment variables are missing.'
  );
}


// ============================================================
// CORS HEADERS
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};


// ============================================================
// ROLE TYPES
// ============================================================

type Role =
  | 'MAIN_SUPER_ADMIN'
  | 'PRINCIPAL'
  | 'SUB_SUPER_ADMIN'
  | 'CR';

type CreatableRole =
  | 'PRINCIPAL'
  | 'SUB_SUPER_ADMIN'
  | 'CR';


// ============================================================
// PERMISSION TYPES
//
// Mirrors the real `admin_permissions` table columns exactly
// (see supabase/migrations/0001_init.sql + 0011_concerns_upgrade.sql).
// Keep this in sync with src/types/index.ts's AdminPermissions.
// ============================================================

type AdminPermissions = {
  manage_students?: boolean;
  manage_classes?: boolean;
  manage_sections?: boolean;
  manage_crs?: boolean;
  view_attendance?: boolean;
  manage_attendance?: boolean;
  view_concerns?: boolean;
  manage_concerns?: boolean;
  raise_concerns?: boolean;
  generate_reports?: boolean;
  import_students?: boolean;
  export_students?: boolean;
  manage_admissions?: boolean;
  manage_faculty?: boolean;
  manage_content?: boolean;
};


// ============================================================
// HELPER: JSON RESPONSE
// ============================================================

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}


// ============================================================
// HELPER: VALIDATE ROLE
// ============================================================

function isCreatableRole(
  role: unknown
): role is CreatableRole {

  return (
    role === 'PRINCIPAL' ||
    role === 'SUB_SUPER_ADMIN' ||
    role === 'CR'
  );

}


// ============================================================
// HELPER: CLEAN PERMISSIONS
//
// Only allows approved permission fields.
// Prevents unexpected or malicious fields.
// ============================================================

function sanitizePermissions(
  permissions: unknown
): AdminPermissions {

  if (
    !permissions ||
    typeof permissions !== 'object'
  ) {
    return {};
  }

  const p =
    permissions as Record<string, unknown>;

  return {

    manage_students:
      p.manage_students === true,

    manage_classes:
      p.manage_classes === true,

    manage_sections:
      p.manage_sections === true,

    manage_crs:
      p.manage_crs === true,

    view_attendance:
      p.view_attendance === true,

    manage_attendance:
      p.manage_attendance === true,

    view_concerns:
      p.view_concerns === true,

    manage_concerns:
      p.manage_concerns === true,

    raise_concerns:
      p.raise_concerns === true,

    generate_reports:
      p.generate_reports === true,

    import_students:
      p.import_students === true,

    export_students:
      p.export_students === true,

    manage_admissions:
      p.manage_admissions === true,

    manage_faculty:
      p.manage_faculty === true,

    manage_content:
      p.manage_content === true,

  };

}


// ============================================================
// MAIN EDGE FUNCTION
// ============================================================

Deno.serve(async (req: Request) => {

  // ----------------------------------------------------------
  // HANDLE PREFLIGHT REQUEST
  // ----------------------------------------------------------

  if (req.method === 'OPTIONS') {

    return new Response(
      'ok',
      {
        headers: corsHeaders,
      }
    );

  }


  // ----------------------------------------------------------
  // ONLY ALLOW POST
  // ----------------------------------------------------------

  if (req.method !== 'POST') {

    return json(
      {
        error:
          'Method not allowed. Only POST requests are allowed.',
      },
      405
    );

  }


  try {

    // ========================================================
    // GET AUTHORIZATION HEADER
    // ========================================================

    const authHeader =
      req.headers.get('Authorization');


    if (!authHeader) {

      return json(
        {
          error:
            'Not authenticated. Authorization token is missing.',
        },
        401
      );

    }


    // ========================================================
    // CLIENT FOR AUTHENTICATING THE CALLER
    //
    // Uses ANON KEY + user's JWT.
    // ========================================================

    const authClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        }
      );


    // ========================================================
    // VERIFY THE CURRENT USER
    // ========================================================

    const {
      data: authData,
      error: authError,
    } =
      await authClient.auth.getUser();


    if (
      authError ||
      !authData.user
    ) {

      return json(
        {
          error:
            'Invalid or expired authentication session.',
        },
        401
      );

    }


    const caller =
      authData.user;


    // ========================================================
    // ADMIN CLIENT
    //
    // IMPORTANT:
    // Uses SERVICE ROLE KEY.
    //
    // This client is ONLY inside the Edge Function.
    // Never expose this in frontend code.
    // ========================================================

    const adminClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
      );


    // ========================================================
    // GET CALLER PROFILE
    // ========================================================

    const {
      data: callerProfile,
      error: profileError,
    } =
      await adminClient
        .from('profiles')
        .select(
          `
          id,
          role,
          full_name,
          is_active
          `
        )
        .eq(
          'id',
          caller.id
        )
        .single();


    if (
      profileError ||
      !callerProfile
    ) {

      return json(
        {
          error:
            'Your user profile could not be found.',
        },
        403
      );

    }


    // ========================================================
    // CHECK IF ACCOUNT IS ACTIVE
    // ========================================================

    if (
      callerProfile.is_active === false
    ) {

      return json(
        {
          error:
            'Your account has been disabled.',
        },
        403
      );

    }


    // ========================================================
    // GET CALLER ROLE
    // ========================================================

    const callerRole =
      callerProfile.role as Role;


    const isMainSuperAdmin =
      callerRole ===
      'MAIN_SUPER_ADMIN';


    const isSubSuperAdmin =
      callerRole ===
      'SUB_SUPER_ADMIN';


    // ========================================================
    // BASIC ROLE AUTHORIZATION
    // ========================================================

    if (
      !isMainSuperAdmin &&
      !isSubSuperAdmin
    ) {

      return json(
        {
          error:
            'Only authorized administrators can create accounts.',
        },
        403
      );

    }


    // ========================================================
    // GET SUB SUPER ADMIN PERMISSIONS
    // ========================================================

    let callerPermissions:
      AdminPermissions = {};


    if (isSubSuperAdmin) {

      const {
        data: permissionData,
      } =
        await adminClient
          .from('admin_permissions')
          .select('*')
          .eq(
            'profile_id',
            caller.id
          )
          .maybeSingle();


      if (permissionData) {

        callerPermissions =
          permissionData as AdminPermissions;

      }

    }


    // ========================================================
    // READ REQUEST BODY
    // ========================================================

    let body: unknown;


    try {

      body =
        await req.json();

    } catch {

      return json(
        {
          error:
            'Invalid JSON request body.',
        },
        400
      );

    }


    const {
      fullName,
      email,
      phone,
      password,
      role,
      permissions,
    } =
      body as {

        fullName?: unknown;

        email?: unknown;

        phone?: unknown;

        password?: unknown;

        role?: unknown;

        permissions?: unknown;

      };


    // ========================================================
    // VALIDATE ROLE
    // ========================================================

    if (
      !isCreatableRole(role)
    ) {

      return json(
        {
          error:
            'Invalid role. You can only create PRINCIPAL, SUB_SUPER_ADMIN or CR accounts.',
        },
        400
      );

    }


    // ========================================================
    // VALIDATE REQUIRED FIELDS
    // ========================================================

    if (
      typeof fullName !== 'string' ||
      !fullName.trim()
    ) {

      return json(
        {
          error:
            'Full name is required.',
        },
        400
      );

    }


    if (
      typeof email !== 'string' ||
      !email.trim()
    ) {

      return json(
        {
          error:
            'Email address is required.',
        },
        400
      );

    }


    if (
      typeof phone !== 'string' ||
      !phone.trim()
    ) {

      return json(
        {
          error:
            'Mobile number is required.',
        },
        400
      );

    }


    if (
      typeof password !== 'string' ||
      !password
    ) {

      return json(
        {
          error:
            'Password is required.',
        },
        400
      );

    }


    // ========================================================
    // PASSWORD SECURITY
    // ========================================================

    if (
      password.length < 8
    ) {

      return json(
        {
          error:
            'Password must contain at least 8 characters.',
        },
        400
      );

    }


    // ========================================================
    // CLEAN INPUT
    // ========================================================

    const cleanFullName =
      fullName.trim();


    const cleanEmail =
      email
        .trim()
        .toLowerCase();


    const cleanPhone =
      phone.trim();


    // ========================================================
    // ROLE PERMISSION CHECKING
    // ========================================================


    // --------------------------------------------------------
    // MAIN SUPER ADMIN
    //
    // Can create:
    // - SUB_SUPER_ADMIN
    // - CR
    // --------------------------------------------------------

    if (isMainSuperAdmin) {

      // Main Super Admin has full authority.

    }


    // --------------------------------------------------------
    // SUB SUPER ADMIN
    //
    // Can ONLY create CR accounts.
    // Requires:
    // manage_crs = true
    // --------------------------------------------------------

    if (isSubSuperAdmin) {

      // Cannot create another Sub Super Admin, and cannot create a
      // Principal — both are at or above their own level.

      if (
        role ===
          'SUB_SUPER_ADMIN' ||
        role ===
          'PRINCIPAL'
      ) {

        return json(
          {
            error:
              'You do not have permission to create a Sub Super Admin or Principal account.',
          },
          403
        );

      }


      // Must have CR-management permission.

      if (
        callerPermissions
          .manage_crs !== true
      ) {

        return json(
          {
            error:
              'You do not have permission to create CR accounts.',
          },
          403
        );

      }

    }


    // ========================================================
    // CLEAN SUB ADMIN PERMISSIONS
    //
    // Only MAIN_SUPER_ADMIN can assign these permissions.
    // ========================================================

    const cleanPermissions =
      sanitizePermissions(
        permissions
      );


    // ========================================================
    // CREATE AUTH USER
    // ========================================================

    const {
      data: createdUserData,
      error: createUserError,
    } =
      await adminClient
        .auth
        .admin
        .createUser({

          email:
            cleanEmail,

          password,

          email_confirm:
            true,

        });


    // ========================================================
    // CHECK USER CREATION
    // ========================================================

    if (
      createUserError ||
      !createdUserData.user
    ) {

      return json(
        {
          error:
            createUserError?.message ||
            'Failed to create the user account.',
        },
        400
      );

    }


    const newUser =
      createdUserData.user;


    // ========================================================
    // CREATE PROFILE
    // ========================================================

    const {
      error: createProfileError,
    } =
      await adminClient
        .from('profiles')
        .insert({

          id:
            newUser.id,

          full_name:
            cleanFullName,

          email:
            cleanEmail,

          phone:
            cleanPhone,

          role,

          is_active:
            true,

        });


    // ========================================================
    // ROLLBACK IF PROFILE CREATION FAILS
    // ========================================================

    if (
      createProfileError
    ) {

      await adminClient
        .auth
        .admin
        .deleteUser(
          newUser.id
        );


      return json(
        {
          error:
            createProfileError.message,
        },
        400
      );

    }


    // ========================================================
    // CREATE PERMISSIONS FOR SUB SUPER ADMIN
    // ========================================================

    if (
      role ===
      'SUB_SUPER_ADMIN'
    ) {

      const {
        error:
          createPermissionsError,
      } =
        await adminClient
          .from(
            'admin_permissions'
          )
          .insert({

            profile_id:
              newUser.id,

            ...cleanPermissions,

          });


      // ======================================================
      // ROLLBACK EVERYTHING IF PERMISSIONS FAIL
      // ======================================================

      if (
        createPermissionsError
      ) {

        // Delete profile.

        await adminClient
          .from('profiles')
          .delete()
          .eq(
            'id',
            newUser.id
          );


        // Delete auth user.

        await adminClient
          .auth
          .admin
          .deleteUser(
            newUser.id
          );


        return json(
          {
            error:
              'Failed to create administrator permissions: ' +
              createPermissionsError.message,
          },
          400
        );

      }

    }


    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return json(
      {

        success:
          true,

        message:
          `${role} account created successfully.`,

        user: {

          id:
            newUser.id,

          full_name:
            cleanFullName,

          email:
            cleanEmail,

          phone:
            cleanPhone,

          role,

        },

      },
      201
    );


  } catch (error) {

    console.error(
      'CREATE USER FUNCTION ERROR:',
      error
    );


    return json(
      {

        error:
          'An unexpected server error occurred.',

      },
      500
    );

  }

});