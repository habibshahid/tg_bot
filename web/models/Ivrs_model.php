<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Ivrs_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getIVRs(){
		$this->db->select('*',FALSE);
        $this->db->from('ivrs');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getIVR($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('ivrs');
		$this->db->where('id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function getFiles($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('ivr_files');
		$this->db->where('ivr_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addIVR($data=array()){
		$data['directory'] = FCPATH.'assets/sounds/ivrs/'.$data['ivr_name'];
		$this->db->insert('ivrs',$data);
		
        if($this->db->insert_id() > 0 ){
			if(!is_dir($data['directory'])){ //create the folder if it's not already exists
				mkdir($data['directory'],0755,TRUE);
			}
			return true;
        }else{
            return array();
        }
	}
	
	function addFile($data=array()){
		$this->db->insert('ivr_files',$data);
	}
	
	function getFile($data=0){
		$this->db->select('*',FALSE);
        $this->db->from('ivr_files');
		$this->db->where('id',$data);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }
	}
	
	function deleteFile($data=array()){
		$file = $this->getFile($data['id']);
        $this->db->where('id',$data['id']); 
		$this->db->delete('ivr_files');
			
		$filepath = $file->filepath.'.'.$file->extension;
		unlink($filepath);
		return $file->ivr_id;
	}
	
	function deleteIVR($data=array()){
		$ivr = $this->getIVR($data['id']);

		$this->db->where('id',$data['id']); 
        $this->db->delete('ivrs');
		
		$files = $this->getFiles($data['id']);
		if(count($files) > 0){			
			foreach($files as $file){
				$filepath = $file->filepath.'.'.$file->extension;
				unlink($filepath);
			}
			$this->db->where('ivr_id',$data['id']); 
			$this->db->delete('ivr_files');
		}

		rmdir($ivr->directory);
		return true;
	}
}
