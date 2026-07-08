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
            'SELECT u.id, u.full_name, u.position, u.email, u.password_hash, u.is_active,
                    u.capacity_hours, u.department_id, u.enrollment_number,
                    r.role_name,
                    d.faculty_id,
                    f.faculty_name
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN faculties f ON f.id = d.faculty_id
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
        $facultyName = $user['faculty_name'] ?? null;
        if ($user['role_name'] === 'dean') {
            $fs = $db->prepare('SELECT id, faculty_name FROM faculties WHERE dean_id = :uid LIMIT 1');
            $fs->execute([':uid' => $user['id']]);
            $frow = $fs->fetch();
            $facultyId = $frow['id'] ?? null;
            $facultyName = $frow['faculty_name'] ?? null;
        }

        $payload = [
            'sub'          => (int)$user['id'],
            'name'         => $user['full_name'],
            'email'        => $user['email'],
            'role'         => $user['role_name'],
            'dept'         => $user['department_id'] ? (int)$user['department_id'] : null,
            'faculty'      => $facultyId ? (int)$facultyId : null,
            'faculty_name' => $facultyName,
        ];

        $token = JwtHelper::generate($payload);

        AuditLogDao::log((int)$user['id'], 'login', 'users', (int)$user['id']);

        Response::success([
            'token' => $token,
            'user'  => [
                'id'                => (int)$user['id'],
                'full_name'         => $user['full_name'],
                'position'          => $user['position'] ?? null,
                'email'             => $user['email'],
                'role'              => $user['role_name'],
                'dept_id'           => $user['department_id'] ? (int)$user['department_id'] : null,
                'faculty_id'        => $facultyId ? (int)$facultyId : null,
                'faculty_name'      => $facultyName,
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

    public function register(array $params = []): void
    {
        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $fullName = trim($body['full_name'] ?? '');
        $email    = trim($body['email'] ?? '');
        $pass     = $body['password'] ?? '';
        $deptId   = $body['department_id'] ?? null;
        $enrollNo = trim($body['enrollment_number'] ?? '');

        if (!$fullName || !$email || !$pass || !$deptId || !$enrollNo) {
            Response::error('All fields (Full Name, Email, Password, Department, Enrollment Number) are required', 422);
        }

        $db = Db::connection();

        // Check if email or enrollment number exists
        $stmt = $db->prepare('SELECT email, enrollment_number FROM users WHERE email = :email OR enrollment_number = :enroll LIMIT 1');
        $stmt->execute([':email' => $email, ':enroll' => $enrollNo]);
        $existing = $stmt->fetch();
        
        if ($existing) {
            if ($existing['email'] === $email) {
                Response::error('Email is already registered', 409);
            }
            if ($existing['enrollment_number'] === $enrollNo) {
                Response::error('Enrollment number is already registered', 409);
            }
        }

        $hash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);

        try {
            $db->beginTransaction();

            $insertStmt = $db->prepare(
                'INSERT INTO users (full_name, email, password_hash, role_id, department_id, enrollment_number, capacity_hours)
                 VALUES (:fname, :email, :hash, 5, :dept, :enroll, 0.00)' // role_id 5 = student
            );
            $insertStmt->execute([
                ':fname'  => $fullName,
                ':email'  => $email,
                ':hash'   => $hash,
                ':dept'   => $deptId,
                ':enroll' => $enrollNo
            ]);
            $userId = (int)$db->lastInsertId();

            AuditLogDao::log($userId, 'register', 'users', $userId);

            $db->commit();

            // Auto-login logic
            $stmt = $db->prepare(
                'SELECT u.id, u.full_name, u.email, u.department_id, u.enrollment_number,
                        r.role_name, d.faculty_id, f.faculty_name
                 FROM users u
                 JOIN roles r ON r.id = u.role_id
                 LEFT JOIN departments d ON d.id = u.department_id
                 LEFT JOIN faculties f ON f.id = d.faculty_id
                 WHERE u.id = :id
                 LIMIT 1'
            );
            $stmt->execute([':id' => $userId]);
            $user = $stmt->fetch();

            $facultyId = $user['faculty_id'] ? (int)$user['faculty_id'] : null;
            $facultyName = $user['faculty_name'] ?? null;

            $payload = [
                'sub'          => (int)$user['id'],
                'name'         => $user['full_name'],
                'email'        => $user['email'],
                'role'         => $user['role_name'],
                'dept'         => $user['department_id'] ? (int)$user['department_id'] : null,
                'faculty'      => $facultyId,
                'faculty_name' => $facultyName,
            ];

            $token = JwtHelper::generate($payload);

            Response::success([
                'token' => $token,
                'user'  => [
                    'id'                => (int)$user['id'],
                    'full_name'         => $user['full_name'],
                    'email'             => $user['email'],
                    'role'              => $user['role_name'],
                    'dept_id'           => $user['department_id'] ? (int)$user['department_id'] : null,
                    'faculty_id'        => $facultyId,
                    'faculty_name'      => $facultyName,
                    'enrollment_number' => $user['enrollment_number'] ?? null,
                    'contact'           => null,
                ],
            ], 'Registration successful');

        } catch (\Exception $e) {
            $db->rollBack();
            Response::error('Failed to register user: ' . $e->getMessage(), 500);
        }
    }
}
