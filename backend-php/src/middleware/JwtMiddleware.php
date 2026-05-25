<?php
// ============================================================
// UniAlloc — JWT Auth & RBAC Middleware
// ============================================================

namespace App\Middleware;

use App\Helpers\JwtHelper;
use App\Helpers\Response;

class JwtMiddleware
{
    /**
     * Call before any protected route handler.
     * Injects $auth into $_REQUEST for downstream controllers.
     *
     * @param array $allowedRoles  e.g. ['system_admin','dean']  — empty means any authenticated user
     */
    public static function handle(array $allowedRoles = []): array
    {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!str_starts_with($authHeader, 'Bearer ')) {
            Response::error('Unauthorised — token missing', 401);
        }

        $token   = substr($authHeader, 7);
        $payload = JwtHelper::validate($token);

        if ($payload === null) {
            Response::error('Unauthorised — invalid or expired token', 401);
        }

        if (!empty($allowedRoles) && !in_array($payload['role'], $allowedRoles, true)) {
            Response::error('Forbidden — insufficient role', 403);
        }

        return $payload; // ['sub'=>userId, 'role'=>roleName, 'dept'=>deptId|null, 'faculty'=>facultyId|null]
    }
}
