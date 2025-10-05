<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Providers_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getProviders(){
		$this->db->select('
			p.*,
			(SELECT COUNT(*) FROM rate_cards rc WHERE rc.provider_id = p.id) as total_rate_cards,
			(SELECT COUNT(*) FROM rate_cards rc WHERE rc.provider_id = p.id AND rc.status = "active") as active_rate_cards
		',FALSE);
        $this->db->from('providers as p');
		$this->db->order_by('p.created_at', 'DESC');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addProvider($data = array()){
		$dataArray = $data;
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		$dataArray['status'] = isset($dataArray['status']) ? $dataArray['status'] : 'active';
		$dataArray['currency'] = isset($dataArray['currency']) ? $dataArray['currency'] : 'USD';
		$dataArray['billing_increment'] = isset($dataArray['billing_increment']) ? $dataArray['billing_increment'] : 60;
		$dataArray['minimum_duration'] = isset($dataArray['minimum_duration']) ? $dataArray['minimum_duration'] : 60;
		
		$this->db->insert('providers',$dataArray);
		return $this->db->insert_id();
	}
	
	function getProvider($id=0){
		$this->db->select('
			p.*,
			(SELECT COUNT(*) FROM rate_cards rc WHERE rc.provider_id = p.id) as total_rate_cards,
			(SELECT COUNT(*) FROM rate_cards rc WHERE rc.provider_id = p.id AND rc.status = "active") as active_rate_cards,
			(SELECT COUNT(*) FROM users u JOIN rate_cards rc ON u.rate_card_id = rc.id WHERE rc.provider_id = p.id) as total_users
		',FALSE);
        $this->db->from('providers as p');
		$this->db->where('p.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function editProvider($data=array(), $id=0){
		$dataArray = $data;
		$dataArray['updated_at'] = date('Y-m-d H:i:s');
		unset($dataArray['provider_id']);
		$this->db->where('id', $id); 
        $this->db->update('providers', $dataArray);
		return true;
	}
	
	function deleteProvider($data=array()){
		// Check if provider has associated rate cards
		$this->db->where('provider_id', $data['id']);
		$rate_cards_count = $this->db->count_all_results('rate_cards');
		
		if($rate_cards_count > 0){
			return array('success' => false, 'error' => 'Cannot delete provider. It has ' . $rate_cards_count . ' associated rate cards.');
		}
		
		$this->db->where('id',$data['id']); 
        $this->db->delete('providers');
		return array('success' => true);
	}
	
	function getActiveProviders(){
		$this->db->select('id, name, currency, billing_increment, minimum_duration');
		$this->db->where('status', 'active');
		$this->db->order_by('name', 'ASC');
		$query = $this->db->get('providers');
		return $query->result();
	}
	
	function getProviderRateCards($provider_id){
		$this->db->select('
			rc.*,
			(SELECT COUNT(*) FROM rates r WHERE r.rate_card_id = rc.id) as total_rates,
			(SELECT COUNT(*) FROM users u WHERE u.rate_card_id = rc.id) as assigned_users
		',FALSE);
        $this->db->from('rate_cards as rc');
		$this->db->where('rc.provider_id', $provider_id);
		$this->db->order_by('rc.created_at', 'DESC');
        $query=$this->db->get();
        return $query->result();
	}
	
	function getProviderStats($provider_id = null){
		$stats = array();
		
		$this->db->from('providers as p');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$stats['total_providers'] = $this->db->count_all_results('');
		
		// Active providers
		$this->db->from('providers as p');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$this->db->where('p.status', 'active');
		$stats['active_providers'] = $this->db->count_all_results('');
		
		// Total rate cards
		$this->db->select('COUNT(rc.id) as count');
		$this->db->from('rate_cards as rc');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'inner');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$query = $this->db->get();
		$stats['total_rate_cards'] = $query->row()->count;
		
		// Active rate cards
		$this->db->select('COUNT(rc.id) as count');
		$this->db->from('rate_cards as rc');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'inner');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$this->db->where('rc.status', 'active');
		$query = $this->db->get();
		$stats['active_rate_cards'] = $query->row()->count;
		
		// Total rates
		$this->db->select('COUNT(r.id) as count');
		$this->db->from('rates as r');
		$this->db->join('rate_cards as rc', 'rc.id = r.rate_card_id', 'inner');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'inner');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$query = $this->db->get();
		$stats['total_rates'] = $query->row()->count;
		
		// Total users (through rate cards)
		$this->db->select('COUNT(DISTINCT u.id) as count');
		$this->db->from('users as u');
		$this->db->join('rate_cards as rc', 'rc.id = u.rate_card_id', 'inner');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'inner');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$query = $this->db->get();
		$stats['total_users'] = $query->row()->count;
		
		// Total revenue (through call details)
		$this->db->select('SUM(cd.cost_price) as revenue');
		$this->db->from('call_details as cd');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'inner');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'inner');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$query = $this->db->get();
		$stats['total_revenue'] = $query->row()->revenue ?: 0;
		
		// Total calls
		$this->db->select('COUNT(cd.id) as count');
		$this->db->from('call_details as cd');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'inner');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'inner');
		if($provider_id){
			$this->db->where('p.id', $provider_id);
		}
		$query = $this->db->get();
		$stats['total_calls'] = $query->row()->count;
		
		return $stats;
	}
	
	function searchProviders($search_term, $limit = 100){
		$this->db->select('
			p.*,
			(SELECT COUNT(*) FROM rate_cards rc WHERE rc.provider_id = p.id) as total_rate_cards
		',FALSE);
        $this->db->from('providers as p');
		
		$this->db->group_start();
		$this->db->like('p.name', $search_term);
		$this->db->or_like('p.description', $search_term);
		$this->db->or_like('p.currency', $search_term);
		$this->db->group_end();
		
		$this->db->order_by('p.name', 'ASC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getProvidersByCurrency($currency = null){
		$this->db->select('*');
        $this->db->from('providers');
		
		if($currency){
			$this->db->where('currency', $currency);
		}
		
		$this->db->where('status', 'active');
		$this->db->order_by('name', 'ASC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getUniqueCurrencies(){
		$this->db->select('currency');
        $this->db->from('providers');
		$this->db->where('currency IS NOT NULL');
		$this->db->where('status', 'active');
		$this->db->group_by('currency');
		$this->db->order_by('currency', 'ASC');
		
        $query=$this->db->get();
        return array_column($query->result_array(), 'currency');
	}
	
	function getProviderPerformance($provider_id, $start_date, $end_date){
		$performance = array();
		
		// Call volume
		$this->db->select('COUNT(cd.id) as total_calls, SUM(cd.cost) as total_revenue, SUM(cd.duration) as total_duration');
		$this->db->from('call_details as cd');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'inner');
		$this->db->where('rc.provider_id', $provider_id);
		$this->db->where('DATE(cd.call_date) >=', $start_date);
		$this->db->where('DATE(cd.call_date) <=', $end_date);
		$query = $this->db->get();
		$result = $query->row();
		
		$performance['total_calls'] = $result->total_calls ?: 0;
		$performance['total_revenue'] = $result->total_revenue ?: 0;
		$performance['total_duration'] = $result->total_duration ?: 0;
		
		// Success rate
		$this->db->select('COUNT(cd.id) as answered_calls');
		$this->db->from('call_details as cd');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'inner');
		$this->db->where('rc.provider_id', $provider_id);
		$this->db->where('cd.status', 'answered');
		$this->db->where('DATE(cd.call_date) >=', $start_date);
		$this->db->where('DATE(cd.call_date) <=', $end_date);
		$query = $this->db->get();
		$performance['answered_calls'] = $query->row()->answered_calls ?: 0;
		
		$performance['success_rate'] = $performance['total_calls'] > 0 ? 
			round(($performance['answered_calls'] / $performance['total_calls']) * 100, 2) : 0;
		
		// Average rates
		$this->db->select('AVG(r.rate) as avg_rate, MIN(r.rate) as min_rate, MAX(r.rate) as max_rate');
		$this->db->from('rates as r');
		$this->db->join('rate_cards as rc', 'rc.id = r.rate_card_id', 'inner');
		$this->db->where('rc.provider_id', $provider_id);
		$query = $this->db->get();
		$rates = $query->row();
		
		$performance['avg_rate'] = $rates->avg_rate ?: 0;
		$performance['min_rate'] = $rates->min_rate ?: 0;
		$performance['max_rate'] = $rates->max_rate ?: 0;
		
		return $performance;
	}
	
	function getTopDestinations($provider_id, $limit = 10){
		$this->db->select('
			d.name as destination_name,
			d.code as destination_code,
			d.country,
			COUNT(cd.id) as total_calls,
			SUM(cd.cost) as total_revenue,
			AVG(cd.duration) as avg_duration
		');
		$this->db->from('call_details as cd');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'inner');
		$this->db->join('destinations as d', 'd.id = cd.destination_id', 'left');
		$this->db->where('rc.provider_id', $provider_id);
		$this->db->group_by('cd.destination_id');
		$this->db->order_by('total_calls', 'DESC');
		$this->db->limit($limit);
		
		return $this->db->get()->result();
	}
	
	function validateProviderName($name, $exclude_id = null){
		$this->db->where('name', $name);
		if($exclude_id){
			$this->db->where('id !=', $exclude_id);
		}
		
		$query = $this->db->get('providers');
		return ($query->num_rows() == 0); // Returns true if name is unique
	}
	
	function getProvidersWithoutRateCards(){
		$this->db->select('p.*');
        $this->db->from('providers as p');
		$this->db->join('rate_cards as rc', 'rc.provider_id = p.id', 'left');
		$this->db->where('rc.provider_id IS NULL');
		$this->db->order_by('p.name', 'ASC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getDailyCallVolume($provider_id, $start_date, $end_date){
		$this->db->select('
			DATE(cd.call_date) as call_date,
			COUNT(cd.id) as total_calls,
			SUM(cd.cost) as total_revenue,
			COUNT(CASE WHEN cd.status = "answered" THEN 1 END) as answered_calls
		');
		$this->db->from('call_details as cd');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'inner');
		$this->db->where('rc.provider_id', $provider_id);
		$this->db->where('DATE(cd.call_date) >=', $start_date);
		$this->db->where('DATE(cd.call_date) <=', $end_date);
		$this->db->group_by('DATE(cd.call_date)');
		$this->db->order_by('call_date', 'ASC');
		
		return $this->db->get()->result();
	}
}