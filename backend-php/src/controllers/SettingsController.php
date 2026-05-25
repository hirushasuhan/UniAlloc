<?php
namespace App\Controllers;

use App\Helpers\Db;
use App\Helpers\Response;
use App\Middleware\JwtMiddleware;

class SettingsController
{
    public function index(array $params = []): void
    {
        JwtMiddleware::handle(['system_admin']);
        $stmt = Db::connection()->query('SELECT setting_key, setting_value FROM settings ORDER BY setting_key');
        Response::success($stmt->fetchAll());
    }

    public function update(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin']);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $db   = Db::connection();

        foreach ($body as $key => $value) {
            $stmt = $db->prepare(
                'INSERT INTO settings (setting_key, setting_value, updated_by) VALUES (:k, :v, :uid)
                 ON DUPLICATE KEY UPDATE setting_value = :v2, updated_by = :uid2'
            );
            $stmt->execute([':k' => $key, ':v' => $value, ':uid' => $auth['sub'], ':v2' => $value, ':uid2' => $auth['sub']]);
        }

        Response::success(null, 'Settings updated');
    }
}
