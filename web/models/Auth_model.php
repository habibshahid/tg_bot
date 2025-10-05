<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Auth_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function login($creds = array()){
		$this->db->select('*',FALSE);
        $this->db->from('users_web');
        $this->db->where('username',$creds['login']);
		$this->db->where('password',$creds['password']);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
			$newdata = array(
				'username'  => $query->row()->username,
				'email'     => $query->row()->email,
				'type'     => $query->row()->type,
				'logged_in' => TRUE
			);
			$this->session->set_userdata($newdata);
            return true;
        }else{
            return false;
        }	
	}
}
