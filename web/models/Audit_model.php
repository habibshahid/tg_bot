<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Audit_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getLogs(){
		$this->db->select('
			*
		',FALSE);
        $this->db->from('audit_log');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addLog($data = array()){
		$this->db->insert('audit_log',$data);
		return $this->db->insert_id();
	}
}
