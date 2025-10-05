<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Gateways_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getGateways(){
		$this->db->select('
			*
		',FALSE);
        $this->db->from('sippeers as d');
		$this->db->where('d.category','trunk');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addGateway($data = array()){
		$dataArray = $data;
		$dataArray['name'] = str_replace(' ', '', ($dataArray['name']));
		if($dataArray['username'] != ''){
			$dataArray['defaultuser'] = $dataArray['username'];
		}
		if($dataArray['register_trunk'] == 'yes' && $dataArray['username'] != '' && $dataArray['secret']){
			$dataArray['register_string'] = $dataArray['username'] . ':' . $dataArray['secret'] . '@' . $dataArray['name'] . ':' . $dataArray['port'];
		}
		unset($dataArray['register_trunk']);
		$dataArray['category'] = 'trunk';
		$this->db->insert('sippeers',$dataArray);
		return $this->db->insert_id();
	}
	
	function getGateway($id=0){
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
	
	function editGateway($data=array()){
		$dataArray = $data;
		$dataArray['name'] = str_replace(' ', '', ($dataArray['name']));
		if($dataArray['username'] != ''){
			$dataArray['defaultuser'] = $dataArray['username'];
		}
		if($dataArray['register_trunk'] == 'yes' && $dataArray['username'] != '' && $dataArray['secret']){
			$dataArray['register_string'] = $dataArray['username'] . ':' . $dataArray['secret'] . '@' . $dataArray['name'] . ':' . $dataArray['port'];
		}
		else{
			$dataArray['register_string'] = '';
		}
		$id = $dataArray['gateway_id'];
		unset($dataArray['register_trunk']);
		unset($dataArray['gateway_id']);
		$dataArray['category'] = 'trunk';
		
		$this->db->where('id', $id); 
        $this->db->update('sippeers', $dataArray);
		return true;
	}
	
	function deleteGateway($data=array()){
		$this->db->where('id',$data['id']); 
        $this->db->delete('sippeers');
		return true;
	}
}
