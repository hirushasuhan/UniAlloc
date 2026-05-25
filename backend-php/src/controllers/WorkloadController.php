<?php
namespace App\Controllers;

use App\Helpers\Db;
use App\Helpers\Response;
use App\Middleware\JwtMiddleware;
use App\Services\WorkloadService;

class WorkloadController
{
    public function show(array $params = []): void
    {
        $auth   = JwtMiddleware::handle(['system_admin', 'dean', 'department_head', 'lecturer']);
        $userId = (int)($params['userId'] ?? $auth['sub']);

        // Lecturers can only see their own
        if ($auth['role'] === 'lecturer' && $userId !== $auth['sub']) {
            Response::error('Forbidden', 403);
        }

        $cap          = WorkloadService::getCapacity($userId);
        $alternatives = [];
        if ($cap['is_overloaded']) {
            $alternatives = WorkloadService::suggestAlternatives($userId);
        }

        Response::success([
            'capacity'     => $cap,
            'alternatives' => $alternatives,
        ]);
    }

    public function index(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin', 'dean', 'department_head']);

        $db    = Db::connection();
        $where = '';
        $bind  = [];

        if ($auth['role'] === 'dean') {
            $where = 'AND d.faculty_id = :fid';
            $bind[':fid'] = $auth['faculty'];
        } elseif ($auth['role'] === 'department_head') {
            $where = 'AND u.department_id = :did';
            $bind[':did'] = $auth['dept'];
        }

        $stmt = $db->prepare(
            "SELECT u.id FROM users u
             LEFT JOIN departments d ON d.id = u.department_id
             JOIN roles r ON r.id = u.role_id
             WHERE r.role_name IN ('lecturer','department_head') AND u.is_active = 1
             $where"
        );
        $stmt->execute($bind);
        $ids = $stmt->fetchAll(\PDO::FETCH_COLUMN);

        $results = [];
        foreach ($ids as $uid) {
            $results[] = WorkloadService::getCapacity((int)$uid);
        }

        Response::success($results);
    }
}
