<?php
namespace App\Controllers;

use App\Helpers\Db;
use App\Helpers\JwtHelper;
use App\Helpers\Response;
use App\Dao\AuditLogDao;

class AuthController
{
    public function login(array $params = []): void
    {
        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = trim($body['email'] ?? '');
        $pass  = $body['password'] ?? '';

        if (!$email || !$pass) {
            Response::error('Email and password are required', 422);
        }

        $db   = Db::connection();
        $stmt = $db->prepare(
            'SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
                    u.capacity_hours, u.department_id, u.enrollment_number,
                    r.role_name,
                    d.faculty_id
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.email = :email
             LIMIT 1'
        );
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($pass, $user['password_hash'])) {
            Response::error('Invalid credentials', 401);
        }

        if (!$user['is_active']) {
            Response::error('Account is deactivated. Contact the system administrator.', 403);
        }

        // For deans, look up faculty_id from faculties table
        $facultyId = $user['faculty_id'];
        if ($user['role_name'] === 'dean') {
            $fs = $db->prepare('SELECT id FROM faculties WHERE dean_id = :uid LIMIT 1');
            $fs->execute([':uid' => $user['id']]);
            $frow = $fs->fetch();
            $facultyId = $frow['id'] ?? null;
        }

        $payload = [
            'sub'     => (int)$user['id'],
            'name'    => $user['full_name'],
            'email'   => $user['email'],
            'role'    => $user['role_name'],
            'dept'    => $user['department_id'] ? (int)$user['department_id'] : null,
            'faculty' => $facultyId ? (int)$facultyId : null,
        ];

        $token = JwtHelper::generate($payload);

        AuditLogDao::log((int)$user['id'], 'login', 'users', (int)$user['id']);

        Response::success([
            'token' => $token,
            'user'  => [
                'id'                => (int)$user['id'],
                'full_name'         => $user['full_name'],
                'email'             => $user['email'],
                'role'              => $user['role_name'],
                'dept_id'           => $user['department_id'] ? (int)$user['department_id'] : null,
                'faculty_id'        => $facultyId ? (int)$facultyId : null,
                'enrollment_number' => $user['enrollment_number'] ?? null,
                'contact'           => $user['contact'] ?? null,
            ],
        ], 'Login successful');
    }

    public function logout(array $params = []): void
    {
        // JWT is stateless — client discards the token
        Response::success(null, 'Logged out');
    }
}
