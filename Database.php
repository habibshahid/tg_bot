<?php

class Database extends PDO {
//http://www.php.net/manual/en/pdo.prepared-statements.php
//http://prash.me/php-pdo-and-prepared-statements/

 	public function __construct($config = array()) {
		try {
			parent::__construct('mysql:host='.$config['host'].';port='.$config['port'].';dbname='.$config['db'],
				$config['user'], $config['password'], null);
			$this->setAttribute(PDO::ATTR_TIMEOUT, 10000000000); // to show error
			$this->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); // to show error
			$this->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);	// defend sql injection
			$this->setAttribute(PDO::ATTR_PERSISTENT, false);	// defend sql injection
	
		} catch(PDOException $e){                
			die('Uncaught exception: '. $e->getMessage());
			
		}
	}

	public function queryWithParams($query){ //secured query with prepare and execute
		$args = func_get_args();
        	array_shift($args); //first element is not an argument but the query itself, should removed

        	$stmt = parent::prepare($query);
		 
        	$stmt->execute($args);
        	return $stmt;
    	}
	
	public function queryWithParamsArray($query, $argArray){ //secured query with prepare and execute
        	$stmt = parent::prepare($query);
        	$stmt->execute($argArray);
        	return $stmt;
	}
}

?>
