<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Moh_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getMOHs(){
		$this->db->select('*',FALSE);
        $this->db->from('musiconholds');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getMOH($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('musiconholds');
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
        $this->db->from('moh_files');
		$this->db->where('moh_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addMOH($data=array()){
		$data['directory'] = FCPATH.'assets/sounds/moh/'.$data['name'];
		$this->db->insert('musiconholds',$data);
		
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
		$this->db->insert('moh_files',$data);
	}
	
	function getFile($data=0){
		$this->db->select('*',FALSE);
        $this->db->from('moh_files');
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
		$this->db->delete('moh_files');
			
		$filepath = $file->filepath.'.'.$file->extension;
		unlink($filepath);
		return $file->moh_id;
	}
	
	function deleteMOH($data=array()){
		$moh = $this->getMOH($data['id']);

		$this->db->where('id',$data['id']); 
        $this->db->delete('musiconholds');
		
		$files = $this->getFiles($data['id']);
		if(count($files) > 0){			
			foreach($files as $file){
				$filepath = $file->filepath.'.'.$file->extension;
				unlink($filepath);
			}
			$this->db->where('moh_id',$data['id']); 
			$this->db->delete('moh_files');
		}

		rmdir($moh->directory);
		return true;
	}
}
