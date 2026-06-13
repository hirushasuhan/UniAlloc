<?php
namespace App\Dao;

use App\Helpers\Db;
use PDO;

class UserDao
{
    /** List users scoped by role claims */
    public static function list(array $auth, array $filters = []): array
    {
        $db   = Db::connection();
        $where = ['u.is_active = 1'];
        $bind  = [];

        // Scope: dean → faculty; dept_head → dept; lecturer/student → own only (handled in controller)
        if (isset($filters['department_id'])) {
            $where[] = 'u.department_id = :dept_id';
            $bind[':dept_id'] = $filters['department_id'];
        }
        if (isset($filters['faculty_id'])) {
            $where[] = '(d.faculty_id = :faculty_id OR (r.role_name = \'dean\' AND f_dean.id = :faculty_id))';
            $bind[':faculty_id'] = $filters['faculty_id'];
        }
        if (isset($filters['role_name'])) {
            $where[] = 'r.role_name = :role_name';
            $bind[':role_name'] = $filters['role_name'];
        }

        $sql = 'SELECT u.id, u.full_name, u.email, u.role_id, r.role_name,
                       u.department_id, d.dept_name,
                       COALESCE(d.faculty_id, f_dean.id) AS faculty_id,
                       COALESCE(f.faculty_name, f_dean.faculty_name) AS faculty_name,
                       u.capacity_hours, u.contact, u.enrollment_number, u.is_active, u.created_at
                FROM users u
                JOIN roles r ON r.id = u.role_id
                LEFT JOIN departments d ON d.id = u.department_id
                LEFT JOIN faculties f ON f.id = d.faculty_id
                LEFT JOIN faculties f_dean ON f_dean.dean_id = u.id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY r.id, u.full_name';

        $stmt = $db->prepare($sql);
        $stmt->execute($bind);
        return $stmt->fetchAll();
    }

    public static function findById(int $id): ?array
    {
        $db   = Db::connection();
        $stmt = $db->prepare(
            'SELECT u.id, u.full_name, u.email, u.role_id, r.role_name,
                    u.department_id, d.dept_name,
                    COALESCE(d.faculty_id, f_dean.id) AS faculty_id,
                    COALESCE(f.faculty_name, f_dean.faculty_name) AS faculty_name,
                    u.capacity_hours, u.contact, u.enrollment_number, u.is_active, u.created_at
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN faculties f ON f.id = d.faculty_id
             LEFT JOIN faculties f_dean ON f_dean.dean_id = u.id
             WHERE u.id = :id'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findWithPassword(int $id): ?array
    {
        $db = Db::connection();
        $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(array $data): int
    {
        $db   = Db::connection();
        $stmt = $db->prepare(
            'INSERT INTO users (full_name, email, password_hash, role_id, department_id,
                                enrollment_number, contact, capacity_hours)
             VALUES (:full_name, :email, :password_hash, :role_id, :department_id,
                     :enrollment_number, :contact, :capacity_hours)'
        );
        $stmt->execute([
            ':full_name'         => $data['full_name'],
            ':email'             => $data['email'],
            ':password_hash'     => password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]),
            ':role_id'           => $data['role_id'],
            ':department_id'     => $data['department_id'] ?? null,
            ':enrollment_number' => $data['enrollment_number'] ?? null,
            ':contact'           => $data['contact'] ?? null,
            ':capacity_hours'    => $data['capacity_hours'] ?? 40.00,
        ]);
        return (int)$db->lastInsertId();
    }

    public static function update(int $id, array $data): bool
    {
        $db     = Db::connection();
        $fields = [];
        $bind   = [':id' => $id];

        foreach (['full_name','contact','capacity_hours','department_id','is_active'] as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "$col = :$col";
                $bind[":$col"] = $data[$col];
            }
        }
        if (isset($data['password'])) {
            $fields[] = 'password_hash = :password_hash';
            $bind[':password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }
        if (empty($fields)) return false;

        $sql  = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $db->prepare($sql);
        $stmt->execute($bind);
        return $stmt->rowCount() > 0;
    }

    public static function roleIdByName(string $name): ?int
    {
        $stmt = Db::connection()->prepare('SELECT id FROM roles WHERE role_name = :name');
        $stmt->execute([':name' => $name]);
        $row = $stmt->fetch();
        return $row ? (int)$row['id'] : null;
    }
}
