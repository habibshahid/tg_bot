<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Agents_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getAgents(){
		$this->db->select('
			*
		',FALSE);
        $this->db->from('sippeers as d');
		$this->db->where('d.category !=','trunk');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addAgent($data = array()){
		$dataArray = $data;
		if($dataArray['username'] != ''){
			$dataArray['defaultuser'] = str_replace(' ', '', ($dataArray['username']));
			$dataArray['name'] = $dataArray['defaultuser'];
		}
		$dataArray['register_string'] = '';
		$dataArray['category'] = 'sip';
		$this->db->insert('sippeers',$dataArray);
		return $this->db->insert_id();
	}
	
	function getAgent($id=0){
		$this->db->select('
			*
		',FALSE);
        $this->db->from('sippeers as d');
		$this->db->where('d.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function editAgent($data=array()){
		$dataArray = $data;
		if($dataArray['username'] != ''){
			$dataArray['defaultuser'] = str_replace(' ', '', ($dataArray['username']));
			$dataArray['name'] = $dataArray['defaultuser'];
		}
		
		$id = $dataArray['agent_id'];
		unset($dataArray['agent_id']);
		$dataArray['category'] = 'sip';
		
		$this->db->where('id', $id); 
        $this->db->update('sippeers', $dataArray);
		return true;
	}
	
	function deleteSip($data=array()){
		$this->db->where('id',$data['id']); 
        $this->db->delete('sippeers');
		return true;
	}

	function deleteAgent($data=array()){
                $this->db->where('id',$data['id']);
        $this->db->delete('sippeers');
                return true;
        }
}
