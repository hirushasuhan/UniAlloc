<?php
namespace App\Dao;

use App\Helpers\Crypto;
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

        foreach (['full_name','email','contact','capacity_hours','department_id','is_active'] as $col) {
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
<<<<<<< Updated upstream
=======

    // ------------------------------------------------------------
    // TOTP self-service password recovery
    // ------------------------------------------------------------

    // ------------------------------------------------------------
    // Session security
    // ------------------------------------------------------------

    /**
     * Everything JwtMiddleware needs to re-authorise a request against the
     * live database rather than trusting stale claims inside the token:
     * account status, current role/scope, token version and TOTP enrollment.
     */
    public static function findSecurityState(int $id): ?array
    {
        $stmt = Db::connection()->prepare(
            'SELECT u.id, u.is_active, u.department_id, u.token_version, u.totp_enabled,
                    r.role_name,
                    COALESCE(d.faculty_id, f_dean.id) AS faculty_id
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN faculties f_dean ON f_dean.dean_id = u.id
             WHERE u.id = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Uniqueness guard for profile email edits (the column is UNIQUE in MySQL). */
    public static function emailTakenByOther(string $email, int $excludeUserId): bool
    {
        $stmt = Db::connection()->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
        $stmt->execute([':email' => $email, ':id' => $excludeUserId]);
        return (bool)$stmt->fetch();
    }

    /**
     * Invalidates every JWT already issued to this user. Called whenever the
     * password changes, so a stolen token dies with the old credential.
     */
    public static function bumpTokenVersion(int $id): void
    {
        Db::connection()
          ->prepare('UPDATE users SET token_version = token_version + 1 WHERE id = :id')
          ->execute([':id' => $id]);
    }

    /** Auth-only lookup for the TOTP setup/verify endpoints (already-logged-in user). */
    public static function findAuthById(int $id): ?array
    {
        $stmt = Db::connection()->prepare('SELECT id, email, totp_secret, totp_enabled FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['totp_secret'] = Crypto::decrypt($row['totp_secret']);
        return $row;
    }

    /** Public lookup by email for the (unauthenticated) forgot-password flow. */
    public static function findByEmailForRecovery(string $email): ?array
    {
        $stmt = Db::connection()->prepare(
            'SELECT id, email, is_active, totp_secret, totp_enabled, totp_failed_attempts, totp_locked_until
             FROM users WHERE email = :email LIMIT 1'
        );
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['totp_secret'] = Crypto::decrypt($row['totp_secret']);
        return $row;
    }

    /** Stores a freshly generated (unconfirmed) secret — not active until verified. */
    public static function saveTotpSecret(int $id, string $secret): void
    {
        Db::connection()->prepare(
            'UPDATE users SET totp_secret = :secret, totp_enabled = 0, totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = :id'
        )->execute([':secret' => Crypto::encrypt($secret), ':id' => $id]);
    }

    /** Confirms enrollment once the user has proven they hold the secret. */
    public static function enableTotp(int $id): void
    {
        Db::connection()->prepare(
            'UPDATE users SET totp_enabled = 1, totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = :id'
        )->execute([':id' => $id]);
    }

    /**
     * Wipes TOTP enrollment entirely. Used when an admin resets a user's
     * password (lost-phone fallback) — the old secret can no longer be
     * trusted, so the user is routed back through the enrollment wizard.
     */
    public static function disableTotp(int $id): void
    {
        Db::connection()->prepare(
            'UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = :id'
        )->execute([':id' => $id]);
    }

    /** Records a wrong code on the public reset endpoint; locks out after too many. */
    public static function registerTotpFailure(int $id, int $maxAttempts = 5, int $lockMinutes = 15): void
    {
        $db = Db::connection();
        $db->prepare('UPDATE users SET totp_failed_attempts = totp_failed_attempts + 1 WHERE id = :id')
           ->execute([':id' => $id]);

        $stmt = $db->prepare('SELECT totp_failed_attempts FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $attempts = (int)($stmt->fetch()['totp_failed_attempts'] ?? 0);

        if ($attempts >= $maxAttempts) {
            // $lockMinutes is a trusted internal int (not user input), so it's safe to
            // inline directly — MySQL's INTERVAL clause is picky about bound params
            // when PDO::ATTR_EMULATE_PREPARES is off, as configured in Db::connection().
            $mins = (int)$lockMinutes;
            $db->prepare("UPDATE users SET totp_locked_until = DATE_ADD(NOW(), INTERVAL $mins MINUTE), totp_failed_attempts = 0 WHERE id = :id")
               ->execute([':id' => $id]);
        }
    }

    public static function clearTotpFailures(int $id): void
    {
        Db::connection()->prepare(
            'UPDATE users SET totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = :id'
        )->execute([':id' => $id]);
    }
>>>>>>> Stashed changes
}
