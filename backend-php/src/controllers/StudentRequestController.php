<?php
namespace App\Controllers;

use App\Dao\StudentRequestDao;
use App\Dao\AuditLogDao;
use App\Dao\NotificationDao;
use App\Helpers\Db;
use App\Helpers\Response;
use App\Middleware\JwtMiddleware;

class StudentRequestController
{
    public function index(array $params = []): void
    {
        $auth    = JwtMiddleware::handle();
        $filters = [];

        if ($auth['role'] === 'student') {
            $filters['student_id'] = $auth['sub'];
        } elseif ($auth['role'] === 'dean') {
            $filters['faculty_id'] = $auth['faculty'];
        }

        Response::success(StudentRequestDao::list($filters));
    }

    public function show(array $params = []): void
    {
        JwtMiddleware::handle();
        $sr = StudentRequestDao::findById((int)($params['id'] ?? 0));
        if (!$sr) Response::error('Student request not found', 404);
        Response::success($sr);
    }

    public function store(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['student']);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['title'])) Response::error('title is required', 422);

        // Resolve faculty_id from student's department
        $db   = Db::connection();
        $stmt = $db->prepare(
            'SELECT d.faculty_id FROM users u JOIN departments d ON d.id = u.department_id WHERE u.id = :uid'
        );
        $stmt->execute([':uid' => $auth['sub']]);
        $row = $stmt->fetch();
        $facultyId = $row['faculty_id'] ?? ($body['faculty_id'] ?? null);

        if (!$facultyId) Response::error('Could not determine faculty. Set faculty_id in request body.', 422);

        // Update student profile details (name, enrollment_number, contact) in active users table if provided
        $updateFields = [];
        $updateParams = [];
        if (!empty($body['name'])) {
            $updateFields[] = 'full_name = :name';
            $updateParams[':name'] = $body['name'];
        }
        if (!empty($body['enrollment_number'])) {
            $updateFields[] = 'enrollment_number = :enrollment';
            $updateParams[':enrollment'] = $body['enrollment_number'];
        }
        if (!empty($body['contact'])) {
            $updateFields[] = 'contact = :contact';
            $updateParams[':contact'] = $body['contact'];
        }
        if (!empty($updateFields)) {
            $updateParams[':uid'] = $auth['sub'];
            $db->prepare('UPDATE users SET ' . implode(', ', $updateFields) . ' WHERE id = :uid')->execute($updateParams);
        }

        $id = StudentRequestDao::create($auth['sub'], (int)$facultyId, $body['title'], $body['description'] ?? null);

        // Notify the Dean of this faculty
        $f = $db->prepare('SELECT dean_id FROM faculties WHERE id = :fid');
        $f->execute([':fid' => $facultyId]);
        $frow = $f->fetch();
        if ($frow && $frow['dean_id']) {
            NotificationDao::create((int)$frow['dean_id'], "New student supervisor request: \"{$body['title']}\"", 'request');
        }

        AuditLogDao::log($auth['sub'], 'submit_student_request', 'student_requests', $id);
        Response::success(['id' => $id], 'Request submitted', 201);
    }

    public function update(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['dean', 'system_admin']);
        $id   = (int)($params['id'] ?? 0);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $body['status'] ?? '';

        if (!in_array($status, ['assigned','rejected'], true)) {
            Response::error("status must be 'assigned' or 'rejected'", 422);
        }

        $ok = StudentRequestDao::update($id, $status, $auth['sub'], $body['assigned_to'] ?? null);

        $sr = StudentRequestDao::findById($id);
        if ($sr) {
            NotificationDao::create(
                (int)$sr['student_id'],
                "Your supervisor request \"{$sr['title']}\" was $status.",
                'request'
            );
        }

        AuditLogDao::log($auth['sub'], "student_request_$status", 'student_requests', $id);
        Response::success(['updated' => $ok]);
    }
}
