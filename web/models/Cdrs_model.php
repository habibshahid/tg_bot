<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Cdrs_model extends CI_Model
{
	function __construct()
	{
		parent::__construct();
	}
	
	function getCDRs(){
		$this->db->select('c.*, fl.list_name, i.ivr_name',FALSE);
        $this->db->from('customer_calls as c');
		$this->db->join('fwd_lists as fl','fl.id = c.listId','left outer');
		$this->db->join('ivrs as i','i.id=c.ivrId','left outer');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
            return $query->result();
        }else{
            return array();
        }	
	}
	
	function getCDRsExport(){
		$res = array();

		$delimiter = ",";  // pipe delimited
		$newline = "\r\n";
		$enclosure = '"';

		$this->load->dbutil(); // call db utility library
		$this->load->helper('download'); // call download helper

		$filename = 'cdrs-report-'.date('Y-m-d-H-i-s').'.csv'; // name of csv file to download with data
		
		$this->db->select('c.*, fl.list_name, i.ivr_name',FALSE);
        $this->db->from('customer_calls as c');
		$this->db->join('fwd_lists as fl','fl.id = c.listId','left outer');
		$this->db->join('ivrs as i','i.id=c.ivrId','left outer');
        $query=$this->db->get();
        if($query->num_rows() > 0 ){
			force_download($filename, $this->dbutil->csv_from_result($query, $delimiter, $newline, $enclosure)); // download file
            return $query->result();
        }else{
            return array();
        }	
	}
}
