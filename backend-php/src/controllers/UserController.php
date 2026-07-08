<?php
namespace App\Controllers;

use App\Dao\UserDao;
use App\Dao\AuditLogDao;
use App\Helpers\Response;
use App\Middleware\JwtMiddleware;

class UserController
{
    public function index(array $params = []): void
    {
        $auth    = JwtMiddleware::handle();
        $filters = [];

        switch ($auth['role']) {
            case 'system_admin':
                // Admin can include deactivated accounts (to reactivate or delete them)
                if (!empty($_GET['include_inactive'])) {
                    $filters['include_inactive'] = true;
                }
                break; // all users
            case 'dean':
                if (empty($_GET['all_faculties'])) {
                    $filters['faculty_id'] = $auth['faculty'];
                }
                break;
            case 'department_head':
                // Own department by default, but cross-department / cross-faculty
                // request targeting needs a wider staff directory
                if (empty($_GET['all_faculties']) && empty($_GET['faculty_id'])) {
                    $filters['department_id'] = $auth['dept'];
                }
                break;
            default:
                Response::error('Forbidden', 403);
        }

        // Optional query string filters
        if (!empty($_GET['role']))       $filters['role_name']    = $_GET['role'];
        if (!empty($_GET['dept_id']))    $filters['department_id'] = (int)$_GET['dept_id'];
        // Allow overriding faculty filter (dean requesting users from another faculty for cross-faculty requests)
        if (!empty($_GET['faculty_id']) && in_array($auth['role'], ['system_admin', 'dean', 'department_head'])) {
            $filters['faculty_id'] = (int)$_GET['faculty_id'];
        }

        Response::success(UserDao::list($auth, $filters));
    }

    public function show(array $params = []): void
    {
        $auth = JwtMiddleware::handle();
        $id   = (int)($params['id'] ?? 0);
        $user = UserDao::findById($id);

        if (!$user) Response::error('User not found', 404);

        // Scope check
        if ($auth['role'] === 'dean'             && (int)$user['faculty_id'] !== $auth['faculty']) Response::error('Forbidden', 403);
        if ($auth['role'] === 'department_head'  && (int)$user['department_id'] !== $auth['dept']) Response::error('Forbidden', 403);
        if ($auth['role'] === 'lecturer'         && (int)$user['id'] !== $auth['sub'])             Response::error('Forbidden', 403);
        if ($auth['role'] === 'student'          && (int)$user['id'] !== $auth['sub'])             Response::error('Forbidden', 403);

        Response::success($user);
    }

    public function store(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin', 'dean', 'department_head']);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        foreach (['full_name','email','password','role_id'] as $req) {
            if (empty($body[$req])) Response::error("Field '$req' is required", 422);
        }

        if (!empty($body['position']) && !in_array($body['position'], UserDao::POSITIONS, true)) {
            Response::error('Invalid position value', 422);
        }

        $targetRoleId = (int)$body['role_id'];

        if ($auth['role'] === 'department_head') {
            if ($targetRoleId !== 4) {
                Response::error('Department heads can only create Lecturer accounts.', 403);
            }
            $body['department_id'] = $auth['dept'];
        } elseif ($auth['role'] === 'dean') {
            if (!in_array($targetRoleId, [3, 4], true)) {
                Response::error('Deans can only create Lecturers or Department Heads.', 403);
            }
            if (empty($body['department_id'])) {
                Response::error('Department ID is required.', 422);
            }
            $db = \App\Helpers\Db::connection();
            $stmt = $db->prepare('SELECT faculty_id FROM departments WHERE id = :did');
            $stmt->execute([':did' => (int)$body['department_id']]);
            $dept = $stmt->fetch();
            if (!$dept || (int)$dept['faculty_id'] !== (int)$auth['faculty']) {
                Response::error('You can only create users in departments within your own faculty.', 403);
            }
        }

        // Rule: a department can only have ONE department head
        if ($targetRoleId === 3 && !empty($body['department_id'])) {
            $db  = \App\Helpers\Db::connection();
            $chk = $db->prepare(
                "SELECT COUNT(*) AS c
                 FROM users u
                 JOIN roles r ON r.id = u.role_id
                 WHERE u.department_id = :did
                   AND r.role_name = 'department_head'
                   AND u.is_active = 1"
            );
            $chk->execute([':did' => (int)$body['department_id']]);
            if ((int)$chk->fetch()['c'] > 0) {
                Response::error('This department already has a Department Head. A department can only have one head.', 422);
            }
        }

        $userId = UserDao::create($body);

        // Keep departments.head_id in sync when a Department Head account is created
        if ($targetRoleId === 3 && !empty($body['department_id'])) {
            \App\Helpers\Db::connection()
                ->prepare('UPDATE departments SET head_id = :uid WHERE id = :did')
                ->execute([':uid' => $userId, ':did' => (int)$body['department_id']]);
        }

        AuditLogDao::log($auth['sub'], 'create_user', 'users', $userId);
        Response::success(['id' => $userId], 'User created', 201);
    }

    public function update(array $params = []): void
    {
        $auth = JwtMiddleware::handle();
        $id   = (int)($params['id'] ?? 0);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // Only admin can update anyone; others can only update themselves
        if ($auth['role'] !== 'system_admin' && $auth['sub'] !== $id) {
            Response::error('Forbidden', 403);
        }

        if (!empty($body['position']) && !in_array($body['position'], UserDao::POSITIONS, true)) {
            Response::error('Invalid position value', 422);
        }

        $ok = UserDao::update($id, $body);
        AuditLogDao::log($auth['sub'], 'update_user', 'users', $id);
        Response::success(['updated' => $ok]);
    }

    public function destroy(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin']);
        $id   = (int)($params['id'] ?? 0);

        if ($id === (int)$auth['sub']) {
            Response::error('You cannot deactivate or delete your own account.', 422);
        }

        // ?permanent=1 → hard delete: remove the user AND everything related to them
        if (!empty($_GET['permanent'])) {
            AuditLogDao::log($auth['sub'], 'delete_user_permanent', 'users', $id);
            $ok = UserDao::hardDelete($id);
            Response::success(['deleted' => $ok], 'User and all related data permanently deleted');
        }

        $ok = UserDao::update($id, ['is_active' => 0]);
        AuditLogDao::log($auth['sub'], 'deactivate_user', 'users', $id);
        Response::success(['deactivated' => $ok]);
    }

    public function resetPassword(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin']);
        $id   = (int)($params['id'] ?? 0);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        
        $defaultPass = substr(str_shuffle('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 8);
        $newPassword = !empty($body['password']) ? $body['password'] : $defaultPass;
        
        $ok = UserDao::update($id, ['password' => $newPassword]);
        if ($ok) {
            AuditLogDao::log($auth['sub'], 'reset_password', 'users', $id);
            Response::success([
                'message' => 'Password reset successfully',
                'new_password' => $newPassword
            ]);
        } else {
            Response::error('Failed to reset password. User may not exist or internal error.', 500);
        }
    }

    public function changePassword(array $params = []): void
    {
        $auth = JwtMiddleware::handle();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        
        if (empty($body['current_password']) || empty($body['new_password'])) {
            Response::error('Current and new passwords are required', 400);
        }
        
        $user = UserDao::findWithPassword($auth['sub']);
        if (!$user || !password_verify($body['current_password'], $user['password_hash'])) {
            Response::error('Incorrect current password', 401);
        }
        
        $ok = UserDao::update($auth['sub'], ['password' => $body['new_password']]);
        if ($ok) {
            AuditLogDao::log($auth['sub'], 'change_password', 'users', $auth['sub']);
            Response::success(['message' => 'Password changed successfully']);
        } else {
            Response::error('Failed to change password.', 500);
        }
    }
}
