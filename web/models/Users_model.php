<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Users_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getUsers(){
		$this->db->select('
			u.*
		',FALSE);
        $this->db->from('users_web as u');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addUser($data = array()){
		$dataArray['username'] = $data['username'];
		$dataArray['password'] = $data['password'];
		$dataArray['email'] = $data['email'];
		$dataArray['type'] = $data['type'];
		$this->db->insert('users_web',$dataArray);
		return $this->db->insert_id();
	}
	
	function getUser($id=0){
		$this->db->select('
			d.*
		',FALSE);
        $this->db->from('users_web as d');
		$this->db->where('d.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function editUser($data=array()){
		$dataArray['username'] = $data['username'];
		$dataArray['password'] = $data['password'];
		$dataArray['email'] = $data['email'];
		$dataArray['type'] = $data['type'];
		
		$this->db->where('id',$data['id']); 
        $this->db->update('users_web', $dataArray);
		return true;
	}
	
	function deleteUser($data=array()){
		$this->db->where('id',$data['id']); 
        $this->db->delete('users_web');
		return true;
	}
}
