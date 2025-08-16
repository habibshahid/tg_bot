#!/usr/bin/php -q
<?php

set_time_limit(30);
//PHP Error Reporting
error_reporting(E_ALL);

global $db;
require_once('Database.php');

$config = array(
	'mysql' => array(
		'host' => 'localhost',
		'port' => '3306',
		'db' => 'switchboard',
		'user' => 'root',
		'password' => 'zPFv6XIPyrvFTEAYwY',
	)
);

$db=new Database($config['mysql']);

truncateCall();

function truncateCall(){
    global $db;

    $query = "truncate table calls";
	return $db->prepare($query);
}
?>


