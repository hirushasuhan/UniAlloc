<?php
namespace App\Dao;

use App\Helpers\Db;

class StudentRequestDao
{
    public static function list(array $filters = []): array
    {
        $where = ['1=1'];
        $bind  = [];

        if (!empty($filters['student_id'])) {
            $where[] = 'sr.student_id = :sid';
            $bind[':sid'] = $filters['student_id'];
        }
        if (!empty($filters['faculty_id'])) {
            $where[] = 'sr.faculty_id = :fid';
            $bind[':fid'] = $filters['faculty_id'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'sr.status = :status';
            $bind[':status'] = $filters['status'];
        }

        $stmt = Db::connection()->prepare(
            'SELECT sr.*,
                    us.full_name AS student_name,
                    us.enrollment_number AS student_enrollment,
                    us.contact AS student_contact,
                    f.faculty_name,
                    ua.full_name AS assigned_to_name
             FROM student_requests sr
             JOIN users us ON us.id = sr.student_id
             JOIN faculties f ON f.id = sr.faculty_id
             LEFT JOIN users ua ON ua.id = sr.assigned_to
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY sr.created_at DESC'
        );
        $stmt->execute($bind);
        return $stmt->fetchAll();
    }

    public static function findById(int $id): ?array
    {
        $stmt = Db::connection()->prepare(
            'SELECT sr.*,
                    us.full_name AS student_name,
                    us.enrollment_number AS student_enrollment,
                    us.contact AS student_contact,
                    f.faculty_name
             FROM student_requests sr
             JOIN users us ON us.id = sr.student_id
             JOIN faculties f ON f.id = sr.faculty_id
             WHERE sr.id = :id'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(int $studentId, int $facultyId, string $title, ?string $description): int
    {
        $db   = Db::connection();
        $stmt = $db->prepare(
            'INSERT INTO student_requests (student_id, faculty_id, title, description)
             VALUES (:sid, :fid, :title, :desc)'
        );
        $stmt->execute([':sid' => $studentId, ':fid' => $facultyId, ':title' => $title, ':desc' => $description]);
        return (int)$db->lastInsertId();
    }

    public static function update(int $id, string $status, int $reviewedBy, ?int $assignedTo): bool
    {
        $stmt = Db::connection()->prepare(
            'UPDATE student_requests
             SET status = :status, reviewed_by = :rb, assigned_to = :at
             WHERE id = :id'
        );
        $stmt->execute([':status' => $status, ':rb' => $reviewedBy, ':at' => $assignedTo, ':id' => $id]);
        return $stmt->rowCount() > 0;
    }
}
