<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Lists_model extends CI_Model
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
	
	function getAgent($id = ''){
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
	
	function getQueueAgent($member = '', $queue = ''){
		$this->db->select('
			*
		',FALSE);
        $this->db->from('queue_members as d');
		$this->db->where('d.membername',$member);
		$this->db->where('d.queue_name',$queue);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return false;
        }	
	}
	
	function addAgent($data = array()){
		$dataArray['membername'] = $data['agent']->name;
		$dataArray['queue_name'] = $data['fields']->list_name;
		$dataArray['interface'] = 'SIP/' . $data['agent']->name;
		$dataArray['penalty'] = 0;
		$dataArray['paused'] = 0;
		if(!$this->getQueueAgent($dataArray['membername'], $dataArray['queue_name'])){
		$this->db->insert('queue_members',$dataArray);
			if($this->db->insert_id() > 0 ){
				return true;
			}else{
				return array();
			}
		}
		else{
			return array();
		}
	}
	
	function deleteAgent($id = '', $queue = ''){
		$this->db->where('uniqueid',$id);
        $this->db->delete('queue_members');
		return true;
	}
	
	function getQueueAgents($queue = ''){
		$this->db->select('
			*
		',FALSE);
        $this->db->from('queue_members as d');
		$this->db->where('d.queue_name', $queue);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getLists(){
		$this->db->select('fl.*, i.ivr_name',FALSE);
        $this->db->from('fwd_lists as fl');
		$this->db->join('ivrs as i','i.id=fl.ivr_id','left outer');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addList($data=array()){
		$data['list_name'] = str_replace([' ', '-'], '_', $data['list_name']);
		$this->db->insert('fwd_lists',$data);
        if($this->db->insert_id() > 0 ){
			return true;
        }else{
            return array();
        }
	}
	
	function addQueue($data=array()){
		$queueData = array();
		$queueData['name'] = str_replace([' ', '-'], '_', $data['list_name']);
		$queueData['musiconhold'] = $data['moh_name'];
		$queueData['context'] = 'toOut';
		$queueData['timeout'] = 120;
		
		$this->db->insert('queues',$queueData);
        if($this->db->insert_id() > 0 ){
			return true;
        }else{
            return array();
        }
	}
	
	function startDialer($id = ''){
		$this->db->where('id', $id); 
        $this->db->update('fwd_lists', array('status' => 1));
		return true;
	}
	
	function stopDialer($id = ''){
		$this->db->where('id', $id); 
        $this->db->update('fwd_lists', array('status' => 0));
		return true;
	}
	
	function editList($data=array()){
		$dataArray['list_name'] = str_replace([' ', '-'], '_', $data['list_name']);
		$dataArray['moh_name'] = $data['moh_name'];
		$dataArray['branch_number'] = $data['branch_number'];
		$dataArray['callerid'] = $data['callerid'];
		$dataArray['gateway_name'] = $data['gateway_name'];
		$dataArray['route_queue'] = $data['route_queue'];
		$dataArray['dial_ratio'] = $data['dial_ratio'];
		$dataArray['ivr_id'] = $data['ivr_id'];
		$this->db->where('id',$data['id']); 
        $this->db->update('fwd_lists', $dataArray);
		
		if($this->getQueue($dataArray['list_name'])){
			$queue = array('musiconhold' => $dataArray['moh_name']);
			$this->db->where('name', $dataArray['list_name']); 
			$this->db->update('queues', $queue);
		}
		else{
			$queueData = array();
			$queueData['name'] = $dataArray['list_name'];
			$queueData['musiconhold'] = $dataArray['moh_name'];
			$queueData['context'] = 'toOut';
			$queueData['timeout'] = 120;
			
			$this->db->insert('queues',$queueData);
		}
		return true;
	}
	
	function getQueue($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('queues');
		$this->db->where('name',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return false;
        }
	}
	function getList($id=0){
		$this->db->select('fl.*',FALSE);
        $this->db->from('fwd_lists as fl');
		$this->db->join('ivrs as i','i.id=fl.ivr_id','left outer');
		$this->db->where('fl.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function getNumbers($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('list_numbers');
		$this->db->where('list_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getAllNumbers($id=0){
		$this->db->select('count(*) as totalCount',FALSE);
        $this->db->from('list_numbers');
		$this->db->where('list_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function getAllAdminNumbers($id=0){
		$this->db->select('count(*) as totalCount',FALSE);
        $this->db->from('admin_numbers');
		$this->db->where('list_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function deleteAllNumber($id){
		$this->db->where('list_id', $id); 
        $this->db->delete('list_numbers');
		return true;
	}
	
	function deleteAllAdminNumber($id){
		$this->db->where('list_id', $id); 
        $this->db->delete('admin_numbers');
		return true;
	}
	
	function getAdminNumbers($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('admin_numbers');
		$this->db->where('list_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getFwdNumbers($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('fwd_list_numbers');
		$this->db->where('list_id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addNumber($data=array()){
		unset($data['submit']);
		$this->db->insert('list_numbers',$data);
        if($this->db->insert_id() > 0 ){
			return true;
        }else{
            return array();
        }
	}
	
	function addFwdNumber($data=array()){
		unset($data['submit']);
		//echo '<pre>';print_r($data);die;
		$this->db->insert('fwd_list_numbers',$data);
        if($this->db->insert_id() > 0 ){
			return true;
        }else{
            return array();
        }
	}
	
	function addAdminNumber($data=array()){
		unset($data['submit']);
		$this->db->insert('admin_numbers',$data);
        if($this->db->insert_id() > 0 ){
			return true;
        }else{
            return array();
        }
	}
	
	function getFwdNumber($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('fwd_list_numbers');
		$this->db->where('id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }
	}
	
	function getNumber($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('list_numbers');
		$this->db->where('id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }
	}
	
	function getAdminNumber($id=0){
		$this->db->select('*',FALSE);
        $this->db->from('admin_numbers');
		$this->db->where('id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }
	}
	
	function deleteFwdNumber($data=array()){
		$number = $this->getFwdNumber($data['id']);
		$queue = $this->getList($data['list_id']);
		
		$this->db->where('id',$data['id']); 
        $this->db->delete('fwd_list_numbers');
		
		$this->db->where('queue_name',$queue->list_name); 
		$this->db->where('membername',$number->number); 
        $this->db->delete('queue_members');
		return true;
	}
	
	function deleteNumber($data=array()){
		$number = $this->getNumber($data['id']);
		$queue = $this->getList($data['list_id']);
		
		$this->db->where('id',$data['id']); 
        $this->db->delete('list_numbers');
		
		//$this->db->where('queue_name',$queue->list_name); 
		//$this->db->where('membername',$number->number); 
        //$this->db->delete('queue_members');
		return true;
	}
	
	function deleteAdminNumber($data=array()){
		$number = $this->getAdminNumber($data['id']);
		$queue = $this->getList($data['list_id']);
		
		$this->db->where('id',$data['id']); 
        $this->db->delete('admin_numbers');
		
		$this->db->where('queue_name',$queue->list_name); 
		$this->db->where('membername',$number->number); 
        $this->db->delete('queue_members');
		return true;
	}
	
	function deleteList($data=array()){
		$this->db->where('list_id',$data['id']); 
        $this->db->delete('list_numbers');
		
		$this->db->where('id',$data['id']); 
        $this->db->delete('fwd_lists');
		return true;
	}
	
	function addNumbers($data=array()){
        $this->db->insert_batch('list_numbers', $data);

		return true;
	}
	
	function addAdminNumbers($data=array()){
        $this->db->insert_batch('admin_numbers', $data);

		return true;
	}
	
	function resetDialer($id = ''){
		$this->db->where('list_id', $id);
		$this->db->update('list_numbers', array('status' => 1, 'admin_number' => ''));
		$this->db->update('admin_numbers', array('status' => 0, 'customer_number' => ''));
		return true;
	}
}
