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
        } elseif ($auth['role'] === 'department_head') {
            $filters['department_id'] = $auth['dept'];
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

        $db = Db::connection();

        // Student chooses the target faculty & department.
        // Fall back to the student's own department's faculty if not provided.
        $facultyId    = !empty($body['faculty_id'])    ? (int)$body['faculty_id']    : null;
        $departmentId = !empty($body['department_id']) ? (int)$body['department_id'] : null;

        if (!$facultyId) {
            $stmt = $db->prepare(
                'SELECT d.faculty_id FROM users u JOIN departments d ON d.id = u.department_id WHERE u.id = :uid'
            );
            $stmt->execute([':uid' => $auth['sub']]);
            $row = $stmt->fetch();
            $facultyId = isset($row['faculty_id']) ? (int)$row['faculty_id'] : null;
        }

        if (!$facultyId) Response::error('Could not determine faculty. Set faculty_id in request body.', 422);

        // Validate the chosen department belongs to the chosen faculty
        if ($departmentId) {
            $chk = $db->prepare('SELECT faculty_id FROM departments WHERE id = :did');
            $chk->execute([':did' => $departmentId]);
            $dept = $chk->fetch();
            if (!$dept) {
                Response::error('Department not found.', 422);
            }
            if ((int)$dept['faculty_id'] !== $facultyId) {
                Response::error('The selected department does not belong to the selected faculty.', 422);
            }
        }

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

        $id = StudentRequestDao::create($auth['sub'], $facultyId, $body['title'], $body['description'] ?? null, $departmentId);

        // Notify the Dean of this faculty
        $f = $db->prepare('SELECT dean_id FROM faculties WHERE id = :fid');
        $f->execute([':fid' => $facultyId]);
        $frow = $f->fetch();
        if ($frow && $frow['dean_id']) {
            NotificationDao::create((int)$frow['dean_id'], "New student supervisor request: \"{$body['title']}\"", 'request');
        }

        // Notify the Department Head of the chosen department
        if ($departmentId) {
            $headId = \App\Dao\UserDao::departmentHeadId($departmentId);
            if ($headId) {
                NotificationDao::create($headId, "New student supervisor request: \"{$body['title']}\"", 'request');
            }
        }

        AuditLogDao::log($auth['sub'], 'submit_student_request', 'student_requests', $id);
        Response::success(['id' => $id], 'Request submitted', 201);
    }

    public function update(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['dean', 'department_head', 'system_admin']);
        $id   = (int)($params['id'] ?? 0);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // Accept either {status: assigned|rejected} or the legacy {action: approve|reject}
        $status = $body['status'] ?? '';
        if (!$status && !empty($body['action'])) {
            $status = $body['action'] === 'approve' ? 'assigned' : ($body['action'] === 'reject' ? 'rejected' : '');
        }

        if (!in_array($status, ['assigned','rejected'], true)) {
            Response::error("status must be 'assigned' or 'rejected'", 422);
        }

        $sr = StudentRequestDao::findById($id);
        if (!$sr) Response::error('Student request not found', 404);

        // Scope: dean → own faculty only; dept head → own department only
        if ($auth['role'] === 'dean' && (int)$sr['faculty_id'] !== (int)$auth['faculty']) {
            Response::error('Forbidden — this request belongs to another faculty.', 403);
        }
        if ($auth['role'] === 'department_head' && (int)($sr['department_id'] ?? 0) !== (int)$auth['dept']) {
            Response::error('Forbidden — this request belongs to another department.', 403);
        }

        // Already handled? Don't let it be resolved twice (e.g. dean approved, then dept head)
        if ($sr['status'] !== 'pending') {
            Response::error('This request has already been ' . $sr['status'] . '.', 409);
        }

        $assignedTo = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;

        if ($status === 'assigned' && !$assignedTo) {
            Response::error('assigned_to (supervisor) is required when approving a request.', 422);
        }

        // Validate the deadline (if provided) is not in the past
        if (!empty($body['deadline']) && $body['deadline'] < date('Y-m-d')) {
            Response::error('Deadline cannot be a past date.', 422);
        }

        $ok = StudentRequestDao::update($id, $status, $auth['sub'], $assignedTo);

        // Approving creates a REAL assignment so the supervision shows up in the
        // lecturer's My Work / assignments, with priority, hours & deadline like any task.
        if ($status === 'assigned' && $assignedTo) {
            $assignee = \App\Dao\UserDao::findById($assignedTo);

            $assignmentId = \App\Dao\AssignmentDao::create([
                'title'           => 'Student Supervision: ' . $sr['title'],
                'description'     => trim(
                    "Supervisor allocation for student {$sr['student_name']}"
                    . (!empty($sr['student_enrollment']) ? " ({$sr['student_enrollment']})" : '')
                    . (!empty($sr['description']) ? "\n\n{$sr['description']}" : '')
                ),
                'assigned_to'     => $assignedTo,
                'assigned_by'     => $auth['sub'],
                'department_id'   => $sr['department_id'] ?? ($assignee['department_id'] ?? null),
                'priority'        => in_array($body['priority'] ?? '', ['low','medium','high','urgent'], true)
                                        ? $body['priority'] : 'medium',
                'estimated_hours' => !empty($body['estimated_hours']) ? (float)$body['estimated_hours'] : 4,
                'deadline'        => $body['deadline'] ?? null,
            ]);

            // Same follow-ups as a normal assignment
            \App\Services\WorkloadService::checkAndNotifyOverload($assignedTo, $assignmentId, $auth['sub']);
            NotificationDao::create(
                $assignedTo,
                "You have been assigned a new task: \"Student Supervision: {$sr['title']}\"",
                'assignment'
            );
            AuditLogDao::log($auth['sub'], 'create_assignment', 'assignments', $assignmentId);
        }

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
