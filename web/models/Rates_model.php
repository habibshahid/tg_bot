<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Rates_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getRates($rate_card_id = null, $limit = 1000){
		$this->db->select('
			r.*,
			rc.name as rate_card_name,
			rc.currency,
			d.prefix as destination_code,
			d.country_name as destination_name,
			d.description as country,
			d.region,
			p.name as provider_name
		',FALSE);
        $this->db->from('rates as r');
		$this->db->join('rate_cards as rc', 'rc.id = r.rate_card_id', 'left');
		$this->db->join('destinations as d', 'd.id = r.destination_id', 'left');
		$this->db->join('providers as p', 'p.id = rc.provider_id', 'left');
		
		if($rate_card_id){
			$this->db->where('r.rate_card_id', $rate_card_id);
		}
		
		$this->db->order_by('d.country_name', 'ASC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addRate($data = array()){
		$dataArray = $data;
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		$dataArray['effective_from'] = isset($dataArray['effective_from']) ? $dataArray['effective_from'] : date('Y-m-d');
		$dataArray['sell_price'] = isset($dataArray['sell_price']) ? $dataArray['sell_price'] : 0.0000;
		$dataArray['billing_increment'] = isset($dataArray['billing_increment']) ? $dataArray['billing_increment'] : 60;
		$dataArray['minimum_duration'] = isset($dataArray['minimum_duration']) ? $dataArray['minimum_duration'] : 60;
		
		$this->db->insert('rates',$dataArray);
		return $this->db->insert_id();
	}
	
	function getRate($id=0){
		$this->db->select('
			r.*,
			rc.name as rate_card_name,
			rc.currency,
			d.prefix as destination_code,
			d.country_name as destination_name,
			d.description as country,
			d.region
		',FALSE);
        $this->db->from('rates as r');
		$this->db->join('rate_cards as rc', 'rc.id = r.rate_card_id', 'left');
		$this->db->join('destinations as d', 'd.id = r.destination_id', 'left');
		$this->db->where('r.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function editRate($data=array(), $id=0){
		$dataArray = $data;
		$dataArray['updated_at'] = date('Y-m-d H:i:s');
		unset($dataArray['rate_id']);
		$this->db->where('id', $id); 
        $this->db->update('rates', $dataArray);
		return true;
	}
	
	function deleteRate($data=array()){
		$this->db->where('id',$data['id']); 
        $this->db->delete('rates');
		return true;
	}
	
	function getRateByDestination($rate_card_id, $destination_number){
		// Find the best matching rate for a destination number
		$this->db->select('
			r.*,
			d.prefix as destination_code,
			d.country name as destination_name,
			d.prefix as prefix_pattern
		',FALSE);
        $this->db->from('rates as r');
		$this->db->join('destinations as d', 'd.id = r.destination_id', 'left');
		$this->db->where('r.rate_card_id', $rate_card_id);
		$this->db->where('r.effective_date <=', date('Y-m-d'));
		$this->db->where('(r.expiry_date IS NULL OR r.expiry_date >=', date('Y-m-d') . ')', NULL, FALSE);
		
		// Find destinations where the number starts with the destination code
		$this->db->where("'{$destination_number}' LIKE CONCAT(d.prefix, '%')", NULL, FALSE);
		$this->db->order_by('LENGTH(d.prefix)', 'DESC'); // Longest match first
		$this->db->limit(1);
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return null;
        }	
	}
	
	function getRatesForExport($rate_card_id){
		$this->db->select('
			d.prefix as destination_code,
			d.country_name as destination_name,
			r.cost,
			r.billing_increment,
			r.minimum_duration
		',FALSE);
        $this->db->from('rates as r');
		$this->db->join('destinations as d', 'd.id = r.destination_id', 'left');
		$this->db->where('r.rate_card_id', $rate_card_id);
		$this->db->order_by('d.country_name', 'ASC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function importRatesFromCSV($file_path, $rate_card_id){
		$result = array('success' => false, 'imported' => 0, 'error' => '');
		
		if (!file_exists($file_path)) {
			$result['error'] = 'File not found';
			return $result;
		}
		
		$this->load->model('destinations_model');
		
		$handle = fopen($file_path, 'r');
		if ($handle === FALSE) {
			$result['error'] = 'Unable to open file';
			return $result;
		}
		
		$header = fgetcsv($handle); // Skip header row
		$imported_count = 0;
		$line_number = 1;
		
		$this->db->trans_start();
		
		while (($data = fgetcsv($handle)) !== FALSE) {
			$line_number++;
			
			if (count($data) < 3) {
				continue; // Skip incomplete rows
			}
			
			// Expected CSV format: destination_code, destination_name, rate, connect_fee, increment, minimum_duration
			$destination_code = trim($data[0]);
			$destination_name = isset($data[1]) ? trim($data[1]) : '';
			$rate = isset($data[2]) ? floatval($data[2]) : 0;
			$connect_fee = isset($data[3]) ? floatval($data[3]) : 0;
			$increment = isset($data[4]) ? intval($data[4]) : 60;
			$minimum_duration = isset($data[5]) ? intval($data[5]) : 60;
			
			if (empty($destination_code) || $rate <= 0) {
				continue; // Skip invalid rows
			}
			
			// Find or create destination
			$destination = $this->destinations_model->getDestinationByCode($destination_code);
			if (!$destination) {
				// Create new destination
				$dest_data = array(
					'code' => $destination_code,
					'name' => $destination_name ?: $destination_code,
					'prefix_pattern' => $destination_code
				);
				$destination_id = $this->destinations_model->addDestination($dest_data);
			} else {
				$destination_id = $destination->id;
			}
			
			if ($destination_id) {
				// Check if rate already exists for this rate card and destination
				$this->db->where('rate_card_id', $rate_card_id);
				$this->db->where('destination_id', $destination_id);
				$existing_rate = $this->db->get('rates')->row();
				
				if ($existing_rate) {
					// Update existing rate
					$rate_data = array(
						'rate' => $rate,
						'connect_fee' => $connect_fee,
						'increment' => $increment,
						'minimum_duration' => $minimum_duration,
						'updated_at' => date('Y-m-d H:i:s')
					);
					$this->db->where('id', $existing_rate->id);
					$this->db->update('rates', $rate_data);
				} else {
					// Insert new rate
					$rate_data = array(
						'rate_card_id' => $rate_card_id,
						'destination_id' => $destination_id,
						'rate' => $rate,
						'connect_fee' => $connect_fee,
						'increment' => $increment,
						'minimum_duration' => $minimum_duration,
						'effective_date' => date('Y-m-d'),
						'created_at' => date('Y-m-d H:i:s')
					);
					$this->db->insert('rates', $rate_data);
				}
				
				$imported_count++;
			}
		}
		
		fclose($handle);
		
		$this->db->trans_complete();
		
		if ($this->db->trans_status() === FALSE) {
			$result['error'] = 'Database transaction failed';
			return $result;
		}
		
		$result['success'] = true;
		$result['imported'] = $imported_count;
		return $result;
	}
	
	function getRateStats($rate_card_id = null){
		$stats = array();
		
		$this->db->from('rates as r');
		if($rate_card_id){
			$this->db->where('r.rate_card_id', $rate_card_id);
		}
		$stats['total_rates'] = $this->db->count_all_results('');
		
		// Average rate
		$this->db->select_avg('rate');
		$this->db->from('rates as r');
		if($rate_card_id){
			$this->db->where('r.rate_card_id', $rate_card_id);
		}
		$query = $this->db->get();
		$stats['average_rate'] = $query->row()->rate ?: 0;
		
		// Min and Max rates
		$this->db->select_min('rate');
		$this->db->from('rates as r');
		if($rate_card_id){
			$this->db->where('r.rate_card_id', $rate_card_id);
		}
		$query = $this->db->get();
		$stats['min_rate'] = $query->row()->rate ?: 0;
		
		$this->db->select_max('rate');
		$this->db->from('rates as r');
		if($rate_card_id){
			$this->db->where('r.rate_card_id', $rate_card_id);
		}
		$query = $this->db->get();
		$stats['max_rate'] = $query->row()->rate ?: 0;
		
		return $stats;
	}
	
	function bulkUpdateRates($rate_card_id, $update_type, $value, $destination_ids = array()){
		if(empty($destination_ids)){
			return false;
		}
		
		$this->db->trans_start();
		
		foreach($destination_ids as $destination_id){
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
					$this->db->set('rate', 'GREATEST(rate - ' . $value . ', 0)', FALSE); // Prevent negative rates
					break;
				case 'set_fixed':
					$update_data['rate'] = $value;
					break;
				case 'update_connect_fee':
					$update_data['connect_fee'] = $value;
					break;
				case 'update_increment':
					$update_data['increment'] = $value;
					break;
				case 'update_minimum_duration':
					$update_data['minimum_duration'] = $value;
					break;
			}
			
			$this->db->where('rate_card_id', $rate_card_id);
			$this->db->where('destination_id', $destination_id);
			$this->db->update('rates', $update_data);
		}
		
		$this->db->trans_complete();
		
		return ($this->db->trans_status() !== FALSE);
	}
	
	function duplicateRates($source_rate_card_id, $target_rate_card_id){
		$sql = "INSERT INTO rates (rate_card_id, destination_id, rate, connect_fee, increment, minimum_duration, effective_date, created_at)
				SELECT ?, destination_id, rate, connect_fee, increment, minimum_duration, ?, NOW()
				FROM rates 
				WHERE rate_card_id = ?";
		
		$this->db->query($sql, array($target_rate_card_id, date('Y-m-d'), $source_rate_card_id));
		
		return ($this->db->affected_rows() > 0);
	}
	
	function searchRates($search_term, $rate_card_id = null, $limit = 100){
		$this->db->select('
			r.*,
			rc.name as rate_card_name,
			d.prefix as destination_code,
			d.country_name as destination_name,
			d.description as country
		',FALSE);
        $this->db->from('rates as r');
		$this->db->join('rate_cards as rc', 'rc.id = r.rate_card_id', 'left');
		$this->db->join('destinations as d', 'd.id = r.destination_id', 'left');
		
		if($rate_card_id){
			$this->db->where('r.rate_card_id', $rate_card_id);
		}
		
		$this->db->group_start();
		$this->db->like('d.prefix', $search_term);
		$this->db->or_like('d.coutry_name', $search_term);
		$this->db->or_like('d.description', $search_term);
		$this->db->group_end();
		
		$this->db->order_by('d.country_name', 'ASC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        return $query->result();
	}
}