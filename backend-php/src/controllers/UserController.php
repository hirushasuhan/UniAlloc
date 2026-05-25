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
                break; // all users
            case 'dean':
                if (empty($_GET['all_faculties'])) {
                    $filters['faculty_id'] = $auth['faculty'];
                }
                break;
            case 'department_head':
                $filters['department_id'] = $auth['dept'];
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

        $userId = UserDao::create($body);
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

        $ok = UserDao::update($id, $body);
        AuditLogDao::log($auth['sub'], 'update_user', 'users', $id);
        Response::success(['updated' => $ok]);
    }

    public function destroy(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin']);
        $id   = (int)($params['id'] ?? 0);
        $ok   = UserDao::update($id, ['is_active' => 0]);
        AuditLogDao::log($auth['sub'], 'deactivate_user', 'users', $id);
        Response::success(['deactivated' => $ok]);
    }
}
