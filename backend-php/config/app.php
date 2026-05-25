<?php
// ============================================================
// UniAlloc — Application Settings
// ============================================================

return [
    'app_name'               => 'UniAlloc',
    'app_url'                => 'http://localhost:8000',
    'debug'                  => true,   // set false in production
    'jwt_secret'             => '7d4f9b8c2e1a3d6f5a7c8e9b0d1a2c3f4e5b6d7a8f9c0e1b2d3a4c5b6e7f8a9b',
    'jwt_ttl'                => 1440,   // minutes (24 hours)
    'cors_origins'           => ['http://localhost:3000'],
    'overload_threshold_pct' => 90,     // % of capacity_hours that triggers overload alert
];
