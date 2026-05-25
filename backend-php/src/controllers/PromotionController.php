<?php
namespace App\Controllers;

use App\Dao\PromotionDao;
use App\Dao\UserDao;
use App\Dao\AuditLogDao;
use App\Dao\NotificationDao;
use App\Helpers\Response;
use App\Middleware\JwtMiddleware;

class PromotionController
{
    public function index(array $params = []): void
    {
        JwtMiddleware::handle(['system_admin', 'dean']);
        Response::success(PromotionDao::list());
    }

    public function store(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['dean', 'system_admin']);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        foreach (['user_id','new_role'] as $req) {
            if (empty($body[$req])) Response::error("Field '$req' is required", 422);
        }

        $user = UserDao::findById((int)$body['user_id']);
        if (!$user) Response::error('User not found', 404);

        $oldRoleId = (int)$user['role_id'];
        $newRoleId = UserDao::roleIdByName($body['new_role']);
        if (!$newRoleId) Response::error('Invalid role name', 422);

        $id = PromotionDao::create((int)$body['user_id'], $oldRoleId, $newRoleId, $auth['sub']);

        // Dean can directly promote lecturer→dept_head without admin approval
        // System admin can directly promote/change roles for anyone immediately
        if (
            ($auth['role'] === 'dean' && $body['new_role'] === 'department_head') ||
            ($auth['role'] === 'system_admin')
        ) {
            PromotionDao::approve($id, $auth['sub']);
            NotificationDao::create((int)$body['user_id'], 'Your user role has been changed to ' . ucwords(str_replace('_', ' ', $body['new_role'])), 'promotion');
        }

        AuditLogDao::log($auth['sub'], 'initiate_promotion', 'role_promotions', $id);
        Response::success(['id' => $id], 'Promotion completed', 201);
    }

    public function update(array $params = []): void
    {
        $auth = JwtMiddleware::handle(['system_admin']);
        $id   = (int)($params['id'] ?? 0);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $action = $body['action'] ?? '';

        if ($action === 'approve') {
            $ok = PromotionDao::approve($id, $auth['sub']);
            AuditLogDao::log($auth['sub'], 'approve_promotion', 'role_promotions', $id);
            Response::success(['approved' => $ok]);
        } elseif ($action === 'reject') {
            $ok = PromotionDao::reject($id, $auth['sub']);
            AuditLogDao::log($auth['sub'], 'reject_promotion', 'role_promotions', $id);
            Response::success(['rejected' => $ok]);
        } else {
            Response::error("action must be 'approve' or 'reject'", 422);
        }
    }
}
