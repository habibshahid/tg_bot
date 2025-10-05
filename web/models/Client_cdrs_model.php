<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Client_cdrs_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getCdrs($filters = array(), $limit = 500){
		$this->db->select('
			cd.*,
			u.username,
			u.first_name,
			u.last_name,
			rc.name as rate_card_name,
			d.name as destination_name,
			d.country
		',FALSE);
        $this->db->from('call_details as cd');
		$this->db->join('users as u', 'u.id = cd.user_id', 'left');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'left');
		$this->db->join('destinations as d', 'd.id = cd.destination_id', 'left');
		
		// Apply filters
		if(!empty($filters['start_date'])){
			$this->db->where('DATE(cd.call_date) >=', $filters['start_date']);
		}
		if(!empty($filters['end_date'])){
			$this->db->where('DATE(cd.call_date) <=', $filters['end_date']);
		}
		if(!empty($filters['user_id'])){
			$this->db->where('cd.user_id', $filters['user_id']);
		}
		if(!empty($filters['destination'])){
			$this->db->like('cd.destination', $filters['destination']);
		}
		if(!empty($filters['status'])){
			$this->db->where('cd.status', $filters['status']);
		}
		
		$this->db->order_by('cd.call_date', 'DESC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getCdr($id){
		$this->db->select('
			cd.*,
			u.username,
			u.first_name,
			u.last_name,
			u.email,
			rc.name as rate_card_name,
			rc.currency,
			d.name as destination_name,
			d.country,
			sp.name as trunk_name,
			sp.host as trunk_host
		',FALSE);
        $this->db->from('call_details as cd');
		$this->db->join('users as u', 'u.id = cd.user_id', 'left');
		$this->db->join('rate_cards as rc', 'rc.id = cd.rate_card_id', 'left');
		$this->db->join('destinations as d', 'd.id = cd.destination_id', 'left');
		$this->db->join('sippeers as sp', 'sp.id = cd.trunk_id', 'left');
		$this->db->where('cd.id', $id);
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function getCdrStats($filters = array()){
		$stats = array();
		
		// Build base query
		$this->db->from('call_details as cd');
		
		// Apply filters
		if(!empty($filters['start_date'])){
			$this->db->where('DATE(cd.call_date) >=', $filters['start_date']);
		}
		if(!empty($filters['end_date'])){
			$this->db->where('DATE(cd.call_date) <=', $filters['end_date']);
		}
		if(!empty($filters['user_id'])){
			$this->db->where('cd.user_id', $filters['user_id']);
		}
		if(!empty($filters['destination'])){
			$this->db->like('cd.destination', $filters['destination']);
		}
		if(!empty($filters['status'])){
			$this->db->where('cd.status', $filters['status']);
		}
		
		// Total calls
		$stats['total_calls'] = $this->db->count_all_results('');
		
		// Reset query for next calculation
		$this->db->from('call_details as cd');
		if(!empty($filters['start_date'])){
			$this->db->where('DATE(cd.call_date) >=', $filters['start_date']);
		}
		if(!empty($filters['end_date'])){
			$this->db->where('DATE(cd.call_date) <=', $filters['end_date']);
		}
		if(!empty($filters['user_id'])){
			$this->db->where('cd.user_id', $filters['user_id']);
		}
		if(!empty($filters['destination'])){
			$this->db->like('cd.destination', $filters['destination']);
		}
		if(!empty($filters['status'])){
			$this->db->where('cd.status', $filters['status']);
		}
		
		// Answered calls
		$this->db->where('cd.status', 'answered');
		$stats['answered_calls'] = $this->db->count_all_results('');
		
		// Calculate other stats
		$stats['failed_calls'] = $stats['total_calls'] - $stats['answered_calls'];
		$stats['success_rate'] = $stats['total_calls'] > 0 ? round(($stats['answered_calls'] / $stats['total_calls']) * 100, 2) : 0;
		
		// Revenue and duration stats
		$this->db->select('
			SUM(cd.cost) as total_revenue,
			SUM(cd.duration) as total_duration,
			SUM(cd.billable_duration) as total_billable_duration,
			AVG(cd.duration) as avg_duration,
			AVG(cd.cost) as avg_cost
		');
		$this->db->from('call_details as cd');
		
		// Apply filters again
		if(!empty($filters['start_date'])){
			$this->db->where('DATE(cd.call_date) >=', $filters['start_date']);
		}
		if(!empty($filters['end_date'])){
			$this->db->where('DATE(cd.call_date) <=', $filters['end_date']);
		}
		if(!empty($filters['user_id'])){
			$this->db->where('cd.user_id', $filters['user_id']);
		}
		if(!empty($filters['destination'])){
			$this->db->like('cd.destination', $filters['destination']);
		}
		if(!empty($filters['status'])){
			$this->db->where('cd.status', $filters['status']);
		}
		
		$query = $this->db->get();
		$revenue_stats = $query->row();
		
		$stats['total_revenue'] = $revenue_stats->total_revenue ?: 0;
		$stats['total_duration'] = $revenue_stats->total_duration ?: 0;
		$stats['total_billable_duration'] = $revenue_stats->total_billable_duration ?: 0;
		$stats['avg_duration'] = $revenue_stats->avg_duration ?: 0;
		$stats['avg_cost'] = $revenue_stats->avg_cost ?: 0;
		
		return $stats;
	}
	
	function getCdrsForExport($filters = array()){
		$this->db->select('
			cd.call_date,
			u.username,
			cd.caller_id,
			cd.destination,
			cd.duration,
			cd.billable_duration,
			cd.rate,
			cd.cost,
			cd.status,
			cd.hangup_cause
		',FALSE);
        $this->db->from('call_details as cd');
		$this->db->join('users as u', 'u.id = cd.user_id', 'left');
		
		// Apply filters
		if(!empty($filters['start_date'])){
			$this->db->where('DATE(cd.call_date) >=', $filters['start_date']);
		}
		if(!empty($filters['end_date'])){
			$this->db->where('DATE(cd.call_date) <=', $filters['end_date']);
		}
		if(!empty($filters['user_id'])){
			$this->db->where('cd.user_id', $filters['user_id']);
		}
		if(!empty($filters['destination'])){
			$this->db->like('cd.destination', $filters['destination']);
		}
		if(!empty($filters['status'])){
			$this->db->where('cd.status', $filters['status']);
		}
		
		$this->db->order_by('cd.call_date', 'DESC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getDashboardData($start_date, $end_date){
		$data = array();
		
		// Daily call volume
		$this->db->select('DATE(call_date) as date, COUNT(*) as calls, SUM(cost) as revenue');
		$this->db->where('DATE(call_date) >=', $start_date);
		$this->db->where('DATE(call_date) <=', $end_date);
		$this->db->group_by('DATE(call_date)');
		$this->db->order_by('DATE(call_date)', 'ASC');
		$data['daily_calls'] = $this->db->get('call_details')->result();
		
		// Top destinations
		$this->db->select('d.name as destination, COUNT(*) as calls, SUM(cd.cost) as revenue');
		$this->db->from('call_details as cd');
		$this->db->join('destinations as d', 'd.id = cd.destination_id', 'left');
		$this->db->where('DATE(cd.call_date) >=', $start_date);
		$this->db->where('DATE(cd.call_date) <=', $end_date);
		$this->db->group_by('cd.destination_id');
		$this->db->order_by('calls', 'DESC');
		$this->db->limit(10);
		$data['top_destinations'] = $this->db->get()->result();
		
		// Top users by calls
		$this->db->select('u.username, COUNT(*) as calls, SUM(cd.cost) as revenue');
		$this->db->from('call_details as cd');
		$this->db->join('users as u', 'u.id = cd.user_id', 'left');
		$this->db->where('DATE(cd.call_date) >=', $start_date);
		$this->db->where('DATE(cd.call_date) <=', $end_date);
		$this->db->group_by('cd.user_id');
		$this->db->order_by('calls', 'DESC');
		$this->db->limit(10);
		$data['top_users'] = $this->db->get()->result();
		
		// Call status distribution
		$this->db->select('status, COUNT(*) as count');
		$this->db->where('DATE(call_date) >=', $start_date);
		$this->db->where('DATE(call_date) <=', $end_date);
		$this->db->group_by('status');
		$data['status_distribution'] = $this->db->get('call_details')->result();
		
		return $data;
	}
	
	function getUserStats($user_id, $start_date, $end_date){
		$stats = array();
		
		// Total calls
		$this->db->where('user_id', $user_id);
		$this->db->where('DATE(call_date) >=', $start_date);
		$this->db->where('DATE(call_date) <=', $end_date);
		$stats['total_calls'] = $this->db->count_all_results('call_details');
		
		// Answered calls
		$this->db->where('user_id', $user_id);
		$this->db->where('DATE(call_date) >=', $start_date);
		$this->db->where('DATE(call_date) <=', $end_date);
		$this->db->where('status', 'answered');
		$stats['answered_calls'] = $this->db->count_all_results('call_details');
		
		// Revenue and duration
		$this->db->select('
			SUM(cost) as total_cost,
			SUM(duration) as total_duration,
			AVG(duration) as avg_duration,
			AVG(cost) as avg_cost
		');
		$this->db->where('user_id', $user_id);
		$this->db->where('DATE(call_date) >=', $start_date);
		$this->db->where('DATE(call_date) <=', $end_date);
		$query = $this->db->get('call_details');
		$result = $query->row();
		
		$stats['total_cost'] = $result->total_cost ?: 0;
		$stats['total_duration'] = $result->total_duration ?: 0;
		$stats['avg_duration'] = $result->avg_duration ?: 0;
		$stats['avg_cost'] = $result->avg_cost ?: 0;
		$stats['success_rate'] = $stats['total_calls'] > 0 ? round(($stats['answered_calls'] / $stats['total_calls']) * 100, 2) : 0;
		
		return $stats;
	}
	
	function getDestinationStats($start_date, $end_date){
		$this->db->select('
			d.name as destination,
			d.country,
			COUNT(cd.id) as total_calls,
			SUM(CASE WHEN cd.status = "answered" THEN 1 ELSE 0 END) as answered_calls,
			SUM(cd.cost) as total_revenue,
			SUM(cd.duration) as total_duration,
			AVG(cd.rate) as avg_rate
		');
		$this->db->from('call_details as cd');
		$this->db->join('destinations as d', 'd.id = cd.destination_id', 'left');
		$this->db->where('DATE(cd.call_date) >=', $start_date);
		$this->db->where('DATE(cd.call_date) <=', $end_date);
		$this->db->group_by('cd.destination_id');
		$this->db->order_by('total_calls', 'DESC');
		
		return $this->db->get()->result();
	}
	
	function getHourlyStats($date){
		$this->db->select('
			HOUR(call_date) as hour,
			COUNT(*) as total_calls,
			SUM(CASE WHEN status = "answered" THEN 1 ELSE 0 END) as answered_calls,
			SUM(cost) as revenue
		');
		$this->db->where('DATE(call_date)', $date);
		$this->db->group_by('HOUR(call_date)');
		$this->db->order_by('hour', 'ASC');
		
		return $this->db->get('call_details')->result();
	}
}