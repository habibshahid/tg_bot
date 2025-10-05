<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Dids_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getDIDs(){
		$this->db->select('
			d.id
			, d.did
			, d.type
			, case when d.type = "forwarding" then fl.list_name when d.type = "switchboard" then fl.list_name end as destination
		',FALSE);
        $this->db->from('dids as d');
		$this->db->join('fwd_lists as fl','fl.id = d.destination','left outer');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addDID($data = array()){
		$dataArray['did'] = $data['did'];
		$dataArray['type'] = $data['type'];
		$dataArray['destination'] = $data['destination'];
		$this->db->insert('dids',$dataArray);
		return $this->db->insert_id();
	}
	
	function getDID($id=0){
		$this->db->select('
			d.id
			, d.did
			, d.type
			, case when d.type = "forwarding" then fl.list_name when d.type = "switchboard" then fl.list_name end as destination
			, fl.id as list_id
		',FALSE);
        $this->db->from('dids as d');
		$this->db->join('fwd_lists as fl','fl.id = d.destination','left outer');
		$this->db->where('d.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function editDID($data=array()){
		$dataArray['did'] = $data['did'];
		$dataArray['type'] = $data['type'];
		$dataArray['destination'] = $data['destination'];
		
		$this->db->where('id',$data['id']); 
        $this->db->update('dids', $dataArray);
		return true;
	}
	
	function deleteDID($data=array()){
		$this->db->where('id',$data['id']); 
        $this->db->delete('dids');
		return true;
	}
}
