<?php
$entityName = $argv[1] ?? null;
if (!$entityName) {
    echo json_encode(null);
    exit;
}

// Proceed with loading Xenforo (takes a while)

$xenforoPath = '/Users/4ev3rm0re/Projects/verticalscope/vs-migration-tool/connected-xenforo/connected-xenforo_2.1.1/src/';
require_once($xenforoPath . 'XF.php');
XF::start($xenforoPath);
$app = XF::setupApp('XF\Pub\App');

$data = $app->em()->getEntityStructure($entityName);

echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
