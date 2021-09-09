<?php
ini_set('display_errors', 'stderr');
[$_, $format, $input] = $argv;
$result = unserialize($input, ['allowed_classes'=> false]);
if ($result === false) {
    exit(1);
} else {
    switch ($format) {
        case 'json':
            echo json_encode($result, JSON_PRETTY_PRINT);
            break;
            case 'php':
                echo var_export($result, true);
                break;
    }
}
