<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Rate_cards_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getRateCards(){
		$this->db->select('
			rc.*,
			p.name as provider_name,
			(SELECT COUNT(*) FROM rates r WHERE r.rate_card_id = rc.id) as total_rates,
			(SELECT COUNT(*) FROM users u WHERE u.rate_card_id = rc.id) as assigned_users
		',FALSE);
        $this->db->from('rate_cards as rc');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'left');
		$this->db->order_by('rc.created_at', 'DESC');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addRateCard($data = array()){
		$dataArray = $data;
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		$dataArray['status'] = isset($dataArray['status']) ? $dataArray['status'] : 'active';
		
		$this->db->insert('rate_cards',$dataArray);
		return $this->db->insert_id();
	}
	
	function getRateCard($id=0){
		$this->db->select('
			rc.*,
			p.name as provider_name,
			p.description as provider_description
		',FALSE);
        $this->db->from('rate_cards as rc');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'left');
		$this->db->where('rc.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function editRateCard($data=array(), $id=0){
		$dataArray = $data;
		$dataArray['updated_at'] = date('Y-m-d H:i:s');
		unset($dataArray['rate_card_id']);
		unset($dataArray['no_expiry']);
		$this->db->where('id', $id); 
        $this->db->update('rate_cards', $dataArray);
		return true;
	}
	
	function deleteRateCard($data=array()){
		// First delete all associated rates
		$this->db->where('rate_card_id', $data['id']);
		$this->db->delete('rates');
		
		// Then delete the rate card
		$this->db->where('id',$data['id']); 
        $this->db->delete('rate_cards');
		return true;
	}
	
	function getUsersWithRateCard($rate_card_id){
		$this->db->where('rate_card_id', $rate_card_id);
		return $this->db->count_all_results('users');
	}
	
	function getRateCardRates($rate_card_id, $limit = null){
		$this->db->select('
			r.*,
			d.prefix as destination_code,
			d.country_name as destination_name,
			d.description as country
		',FALSE);
        $this->db->from('rates as r');
		$this->db->join('destinations as d', 'd.id = r.destination_id', 'left');
		$this->db->where('r.rate_card_id', $rate_card_id);
		$this->db->order_by('d.country_name', 'ASC');
		
		if($limit){
			$this->db->limit($limit);
		}
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getRateCardUsers($rate_card_id){
		$this->db->select('
			u.id,
			u.username,
			u.first_name,
			u.last_name,
			u.email,
			u.balance,
			u.status
		',FALSE);
        $this->db->from('users as u');
		$this->db->where('u.rate_card_id', $rate_card_id);
		$this->db->order_by('u.username', 'ASC');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getRateCardStats($rate_card_id){
		$stats = array();
		
		// Total rates
		$this->db->where('rate_card_id', $rate_card_id);
		$stats['total_rates'] = $this->db->count_all_results('rates');
		
		// Assigned users
		$this->db->where('rate_card_id', $rate_card_id);
		$stats['assigned_users'] = $this->db->count_all_results('users');
		
		// Average rate
		$this->db->select_avg('sell_price');
		$this->db->where('rate_card_id', $rate_card_id);
		$query = $this->db->get('rates');
		$stats['average_rate'] = $query->row()->sell_price ?: 0;
		
		// Min and Max rates
		$this->db->select_min('sell_price');
		$this->db->where('rate_card_id', $rate_card_id);
		$query = $this->db->get('rates');
		$stats['min_rate'] = $query->row()->sell_price ?: 0;
		
		$this->db->select_max('sell_price');
		$this->db->where('rate_card_id', $rate_card_id);
		$query = $this->db->get('rates');
		$stats['max_rate'] = $query->row()->sell_price ?: 0;
		
		// Total calls using this rate card
		$this->db->where('rate_card_id', $rate_card_id);
		$stats['total_calls'] = $this->db->count_all_results('call_details');
		
		// Total revenue from this rate card
		$this->db->select_sum('cost_price');
		$this->db->where('rate_card_id', $rate_card_id);
		$query = $this->db->get('call_details');
		$stats['total_revenue'] = $query->row()->cost_price ?: 0;
		
		return $stats;
	}
	
	function cloneRateCard($source_id, $data = array()){
		// Start transaction
		$this->db->trans_start();
		
		// Create new rate card
		$dataArray = $data;
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		$dataArray['status'] = 'draft'; // New cloned rate cards start as draft
		
		$this->db->insert('rate_cards', $dataArray);
		$new_rate_card_id = $this->db->insert_id();
		
		if($new_rate_card_id){
			// Copy all rates from source rate card
			$sql = "INSERT INTO rates (rate_card_id, destination_id, cost_price, sell_price, billing_increment, minimum_duration, effective_from, created_at)
					SELECT ?, destination_id, cost_price, sell_price, billing_increment, minimum_duration, ?, NOW()
					FROM rates 
					WHERE rate_card_id = ?";
			
			$this->db->query($sql, array($new_rate_card_id, $dataArray['effective_date'], $source_id));
		}
		
		// Complete transaction
		$this->db->trans_complete();
		
		if ($this->db->trans_status() === FALSE) {
			return false;
		}
		
		return $new_rate_card_id;
	}
	
	function bulkUpdateRates($rate_card_id, $update_type, $value, $destinations){
		$this->db->trans_start();
		
		foreach($destinations as $destination_id){
			$update_data = array('updated_at' => date('Y-m-d H:i:s'));
			
			switch($update_type){
				case 'increase_percentage':
					$this->db->set('rate', 'rate * (1 + ' . ($value/100) . ')', FALSE);
					break;
				case 'decrease_percentage':
					$this->db->set('rate', 'rate * (1 - ' . ($value/100) . ')', FALSE);
					break;
				case 'increase_fixed':
					$this->db->set('rate', 'rate + ' . $value, FALSE);
					break;
				case 'decrease_fixed':
					$this->db->set('rate', 'rate - ' . $value, FALSE);
					break;
				case 'set_fixed':
					$update_data['rate'] = $value;
					break;
				case 'update_connect_fee':
					$update_data['connect_fee'] = $value;
					break;
			}
			
			$this->db->where('rate_card_id', $rate_card_id);
			$this->db->where('destination_id', $destination_id);
			$this->db->update('rates', $update_data);
		}
		
		$this->db->trans_complete();
		
		return ($this->db->trans_status() !== FALSE);
	}
	
	function getActiveRateCards(){
		$this->db->select('id, name, currency');
		$this->db->where('status', 'active');
		$this->db->order_by('name', 'ASC');
		$query = $this->db->get('rate_cards');
		return $query->result();
	}
}