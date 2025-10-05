<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Destinations_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getDestinations($limit = 1000){
		$this->db->select('
			d.*,
			(SELECT COUNT(*) FROM rates r WHERE r.destination_id = d.id) as total_rates,
			(SELECT COUNT(DISTINCT r.rate_card_id) FROM rates r WHERE r.destination_id = d.id) as rate_cards_count
		',FALSE);
        $this->db->from('destinations as d');
		$this->db->order_by('d.country_name', 'ASC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function addDestination($data = array()){
		$dataArray = $data;
		$dataArray['created_at'] = date('Y-m-d H:i:s');
		
		// Auto-generate prefix pattern if not provided
		if(empty($dataArray['prefix_pattern'])){
			$dataArray['prefix_pattern'] = $dataArray['code'];
		}
		
		$this->db->insert('destinations',$dataArray);
		return $this->db->insert_id();
	}
	
	function getDestination($id=0){
		$this->db->select('
			d.*,
			(SELECT COUNT(*) FROM rates r WHERE r.destination_id = d.id) as total_rates,
			(SELECT COUNT(DISTINCT r.rate_card_id) FROM rates r WHERE r.destination_id = d.id) as rate_cards_count,
			(SELECT AVG(r.rate) FROM rates r WHERE r.destination_id = d.id) as average_rate,
			(SELECT MIN(r.rate) FROM rates r WHERE r.destination_id = d.id) as min_rate,
			(SELECT MAX(r.rate) FROM rates r WHERE r.destination_id = d.id) as max_rate
		',FALSE);
        $this->db->from('destinations as d');
		$this->db->where('d.id',$id);
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return array();
        }	
	}
	
	function getDestinationByCode($code){
		$this->db->where('code', $code);
        $query=$this->db->get('destinations');
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return null;
        }	
	}
	
	function editDestination($data=array(), $id=0){
		$dataArray = $data;
		$dataArray['updated_at'] = date('Y-m-d H:i:s');
		
		$this->db->where('id', $id); 
        $this->db->update('destinations', $dataArray);
		return true;
	}
	
	function deleteDestination($data=array()){
		// Check if destination has associated rates
		$this->db->where('destination_id', $data['id']);
		$rates_count = $this->db->count_all_results('rates');
		
		if($rates_count > 0){
			return array('success' => false, 'error' => 'Cannot delete destination. It has ' . $rates_count . ' associated rates.');
		}
		
		$this->db->where('id',$data['id']); 
        $this->db->delete('destinations');
		return array('success' => true);
	}
	
	function findDestinationByNumber($destination_number){
		// Find the best matching destination for a phone number
		$this->db->select('*');
        $this->db->from('destinations');
		$this->db->where("'{$destination_number}' LIKE CONCAT(code, '%')", NULL, FALSE);
		$this->db->order_by('LENGTH(code)', 'DESC'); // Longest match first (most specific)
		$this->db->limit(1);
		
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->row();
        }else{
            return null;
        }	
	}
	
	function getDestinationsByRegion($region = null){
		$this->db->select('*');
        $this->db->from('destinations');
		
		if($region){
			$this->db->where('region', $region);
		}
		
		$this->db->order_by('region', 'ASC');
		$this->db->order_by('name', 'ASC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getDestinationsByCountry($country = null){
		$this->db->select('*');
        $this->db->from('destinations');
		
		if($country){
			$this->db->where('country', $country);
		}
		
		$this->db->order_by('country', 'ASC');
		$this->db->order_by('name', 'ASC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getUniqueRegions(){
		$this->db->select('region');
        $this->db->from('destinations');
		$this->db->where('region IS NOT NULL');
		$this->db->group_by('region');
		$this->db->order_by('region', 'ASC');
		
        $query=$this->db->get();
        return array_column($query->result_array(), 'region');
	}
	
	function getUniqueCountries(){
		$this->db->select('country');
        $this->db->from('destinations');
		$this->db->where('country IS NOT NULL');
		$this->db->group_by('country');
		$this->db->order_by('country', 'ASC');
		
        $query=$this->db->get();
        return array_column($query->result_array(), 'country');
	}
	
	function searchDestinations($search_term, $limit = 100){
		$this->db->select('
			d.*,
			(SELECT COUNT(*) FROM rates r WHERE r.destination_id = d.id) as total_rates
		',FALSE);
        $this->db->from('destinations as d');
		
		$this->db->group_start();
		$this->db->like('d.code', $search_term);
		$this->db->or_like('d.country_name', $search_term);
		$this->db->or_like('d.description', $search_term);
		$this->db->group_end();
		
		$this->db->order_by('d.country_name', 'ASC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function importDestinationsFromCSV($file_path){
		$result = array('success' => false, 'imported' => 0, 'error' => '');
		
		if (!file_exists($file_path)) {
			$result['error'] = 'File not found';
			return $result;
		}
		
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
			
			if (count($data) < 2) {
				continue; // Skip incomplete rows
			}
			
			// Expected CSV format: code, name, country, region, prefix_pattern
			$code = trim($data[0]);
			$name = isset($data[1]) ? trim($data[1]) : '';
			$country = isset($data[2]) ? trim($data[2]) : '';
			$region = isset($data[3]) ? trim($data[3]) : '';
			$prefix_pattern = isset($data[4]) ? trim($data[4]) : $code;
			
			if (empty($code) || empty($name)) {
				continue; // Skip invalid rows
			}
			
			// Check if destination already exists
			$existing = $this->getDestinationByCode($code);
			if (!$existing) {
				$dest_data = array(
					'code' => $code,
					'name' => $name,
					'country' => $country,
					'region' => $region,
					'prefix_pattern' => $prefix_pattern
				);
				
				if($this->addDestination($dest_data)){
					$imported_count++;
				}
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
	
	function getDestinationStats(){
		$stats = array();
		
		// Total destinations
		$stats['total_destinations'] = $this->db->count_all('destinations');
		
		// Destinations with rates
		$this->db->select('COUNT(DISTINCT destination_id) as count');
		$this->db->from('rates');
		$query = $this->db->get();
		$stats['destinations_with_rates'] = $query->row()->count;
		
		// Destinations without rates
		$stats['destinations_without_rates'] = $stats['total_destinations'] - $stats['destinations_with_rates'];
		
		// Countries count
		$this->db->select('COUNT(DISTINCT country) as count');
		$this->db->from('destinations');
		$this->db->where('country IS NOT NULL');
		$query = $this->db->get();
		$stats['total_countries'] = $query->row()->count;
		
		// Regions count
		$this->db->select('COUNT(DISTINCT region) as count');
		$this->db->from('destinations');
		$this->db->where('region IS NOT NULL');
		$query = $this->db->get();
		$stats['total_regions'] = $query->row()->count;
		
		return $stats;
	}
	
	function getDestinationsWithoutRates(){
		$this->db->select('d.*');
        $this->db->from('destinations as d');
		$this->db->join('rates as r', 'r.destination_id = d.id', 'left');
		$this->db->where('r.destination_id IS NULL');
		$this->db->order_by('d.country_name', 'ASC');
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function getPopularDestinations($limit = 10){
		$this->db->select('
			d.*,
			COUNT(cd.id) as total_calls,
			SUM(cd.cost) as total_revenue,
			SUM(cd.duration) as total_duration
		',FALSE);
        $this->db->from('destinations as d');
		$this->db->join('call_details as cd', 'cd.destination_id = d.id', 'inner');
		$this->db->group_by('d.id');
		$this->db->order_by('total_calls', 'DESC');
		$this->db->limit($limit);
		
        $query=$this->db->get();
        return $query->result();
	}
	
	function validateDestinationCode($code, $exclude_id = null){
		$this->db->where('code', $code);
		if($exclude_id){
			$this->db->where('id !=', $exclude_id);
		}
		
		$query = $this->db->get('destinations');
		return ($query->num_rows() == 0); // Returns true if code is unique
	}
}